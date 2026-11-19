/**
 * world.ts — Estado mutable centralizado de la simulación (Struct-of-Arrays y TypedArrays)
 *
 * REGLA DE ORO DEL TDD:
 * React y Zustand NO participan en el bucle a 60 Hz. Todas las posiciones,
 * velocidades, proyectiles, orbes y enemigos residen en arrays tipados contiguos
 * dentro de este World singleton mutable.
 */

import { SpatialGrid } from './grid';
import { createProjectilePool, type ProjectilePool } from '../game/projectiles';
import { createOrbPool, spawnOrb, type OrbPool } from '../game/orbs';
import { EnemyPoolSim, RADIUS, TANK_HP, type EnemyKind } from '../game/enemies/pool';
import { Director } from '../game/director';
import { baseModifiers, type Modifiers } from '../game/upgrades';
import { mulberry32 } from './rng';
import { feel } from './feel';
import { onTankKilled } from '../game/enemies/tank';


/** Duración del destello de impacto (s) */
export const HIT_FLASH = 0.12;

/** Puntos por toxina eliminada (se multiplican por región) */
const KILL_POINTS: Record<EnemyKind, number> = { swarmer: 10, tank0: 60, tank1: 30, tank2: 15, homing: 25 };

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  aimX: number;
  aimZ: number;
  /** Punto del suelo bajo el ratón y segundos desde su último movimiento */
  mouseWX: number;
  mouseWZ: number;
  mouseIdle: number;
  aimTargetId: number;
  dirX: number;
  dirZ: number;
  baseSpeed: number;
  brainPower: number; // 0..100
  vitality: number; // 0..maxVitality
  maxVitality: number;
  dashCooldown: number;
  dashActiveTimer: number;
  invulnerableTimer: number;
  inertiaDrag: number; // Deriva por alcohol
  fatigue: number; // Fatiga cognitiva por ultraprocesados
  smokeSlowTimer: number; // Lentitud por tabaco
  shieldActive: boolean;
  shieldTimer: number;
  /** Segundos en los que el impulso no necesita recarga (carta Impulso saltatorio) */
  dashFreeTimer: number;
  ultCharge: number; // 0..100
  ultActiveTimer: number;
  mods: Modifiers;
}

export interface EnemyRef {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  threat: number;
  kind: EnemyKind;
  index: number;
  hp: number;
  dmgMult: number;
}

export interface EnemyMirror {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vz: Float32Array;
  r: Float32Array;
  id: Int32Array;
  threat: Float32Array;
  kind: EnemyKind[];
  poolIndex: Int32Array;
  alive: Uint8Array;
  hp: Float32Array;
  dmgMult: Float32Array;
  ref: (i: number) => EnemyRef;
}

export interface TelegraphPool {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  timer: Float32Array;
  duration: Float32Array;
  onComplete: Array<() => void>;
  add: (x: number, z: number, duration: number, cb: () => void) => void;
  update: (dt: number) => void;
}

export interface ShockwavePool {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  radius: Float32Array;
  maxRadius: Float32Array;
  age: Float32Array;
  add: (x: number, z: number, maxRadius?: number) => void;
  update: (dt: number) => void;
}

export interface DendritePool {
  count: number;
  max: number;
  x1: Float32Array;
  z1: Float32Array;
  x2: Float32Array;
  z2: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  add: (x1: number, z1: number, x2: number, z2: number, life?: number) => void;
  update: (dt: number) => void;
}

export interface RanvierNodesPool {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  fuse: Float32Array;
  spawn: (x: number, z: number, fuse?: number) => void;
  update: (dt: number, w: World) => void;
}

export interface RippleState {
  x: number;
  y: number; // Coordenada Z en espacio 3D
  time: number;
  strength: number;
}

export class World {
  player: PlayerState = {
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    aimX: 0,
    aimZ: -1,
    mouseWX: 0,
    mouseWZ: 0,
    mouseIdle: 999,
    aimTargetId: -1,
    dirX: 0,
    dirZ: 0,
    baseSpeed: 6.8,
    brainPower: 100,
    vitality: 3,
    maxVitality: 3,
    dashCooldown: 0,
    dashActiveTimer: 0,
    invulnerableTimer: 0,
    inertiaDrag: 0,
    fatigue: 0,
    smokeSlowTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    dashFreeTimer: 0,
    ultCharge: 0,
    ultActiveTimer: 0,
    mods: baseModifiers(),
  };

  projectiles: ProjectilePool = createProjectilePool(512);
  orbs: OrbPool = createOrbPool(384);
  grid: SpatialGrid = new SpatialGrid(-16, -12, 32, 24, 2, 512);

  pools: Record<EnemyKind, EnemyPoolSim> = {
    swarmer: new EnemyPoolSim('swarmer'),
    tank0: new EnemyPoolSim('tank0'),
    tank1: new EnemyPoolSim('tank1'),
    tank2: new EnemyPoolSim('tank2'),
    homing: new EnemyPoolSim('homing'),
  };

  enemyMirror: EnemyMirror;
  telegraphs: TelegraphPool;
  shockwaves: ShockwavePool;
  dendrites: DendritePool;
  ranvierNodes: RanvierNodesPool;

  director: Director = new Director();
  diff = { hpMult: 1.0 };
  tier: 'low' | 'mid' | 'high' = 'high';
  maxEnemies = 160;
  alpha = 0; // Factor de interpolación para el render
  rng: () => number = mulberry32(12345);
  wave = 0;
  region = 0;
  enemyCount = 0;
  shootCooldown = 0;

  // Ondas de choque en el suelo para tissue.frag (uRipples[8])
  ripples: RippleState[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, time: -100, strength: 0 }));
  rippleHead = 0;

  // Enlace a sistema de partículas GPU
  burstEmitter?: (x: number, y: number, z: number, color: [number, number, number], count: number, speed: number) => void;

  constructor() {
    const maxMirror = 512;
    const ex = new Float32Array(maxMirror);
    const ez = new Float32Array(maxMirror);
    const evx = new Float32Array(maxMirror);
    const evz = new Float32Array(maxMirror);
    const er = new Float32Array(maxMirror);
    const eid = new Int32Array(maxMirror);
    const ethreat = new Float32Array(maxMirror);
    const ekind: EnemyKind[] = new Array(maxMirror).fill('swarmer');
    const epoolIdx = new Int32Array(maxMirror);
    const ealive = new Uint8Array(maxMirror);
    const ehp = new Float32Array(maxMirror);
    const edmgMult = new Float32Array(maxMirror);

    const refCache: EnemyRef = {
      id: 0,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      r: 0.5,
      threat: 1,
      kind: 'swarmer',
      index: 0,
      hp: 10,
      dmgMult: 1,
    };

    this.enemyMirror = {
      count: 0,
      max: maxMirror,
      x: ex,
      z: ez,
      vx: evx,
      vz: evz,
      r: er,
      id: eid,
      threat: ethreat,
      kind: ekind,
      poolIndex: epoolIdx,
      alive: ealive,
      hp: ehp,
      dmgMult: edmgMult,
      ref: (i: number) => {
        refCache.id = eid[i];
        refCache.x = ex[i];
        refCache.z = ez[i];
        refCache.vx = evx[i];
        refCache.vz = evz[i];
        refCache.r = er[i];
        refCache.threat = ethreat[i];
        refCache.kind = ekind[i];
        refCache.index = epoolIdx[i];
        refCache.hp = ehp[i];
        refCache.dmgMult = edmgMult[i];
        return refCache;
      },
    };

    // Pool de telegrafías en suelo
    const maxTelegraphs = 32;
    const tx = new Float32Array(maxTelegraphs);
    const tz = new Float32Array(maxTelegraphs);
    const ttimer = new Float32Array(maxTelegraphs);
    const tduration = new Float32Array(maxTelegraphs);
    const tonComplete: Array<() => void> = new Array(maxTelegraphs);

    this.telegraphs = {
      count: 0,
      max: maxTelegraphs,
      x: tx,
      z: tz,
      timer: ttimer,
      duration: tduration,
      onComplete: tonComplete,
      add: (x, z, duration, cb) => {
        if (this.telegraphs.count >= this.telegraphs.max) return;
        const i = this.telegraphs.count++;
        tx[i] = x;
        tz[i] = z;
        ttimer[i] = duration;
        tduration[i] = duration;
        tonComplete[i] = cb;
      },
      update: (dt) => {
        for (let i = 0; i < this.telegraphs.count; i++) {
          ttimer[i] -= dt;
          if (ttimer[i] <= 0) {
            const cb = tonComplete[i];
            // Swap-remove
            const last = --this.telegraphs.count;
            tx[i] = tx[last];
            tz[i] = tz[last];
            ttimer[i] = ttimer[last];
            tduration[i] = tduration[last];
            tonComplete[i] = tonComplete[last];
            i--;
            cb?.();
          }
        }
      },
    };

    // Pool de ondas de choque instanciadas
    const maxShock = 32;
    const sx = new Float32Array(maxShock);
    const sz = new Float32Array(maxShock);
    const srad = new Float32Array(maxShock);
    const smaxRad = new Float32Array(maxShock);
    const sage = new Float32Array(maxShock);

    this.shockwaves = {
      count: 0,
      max: maxShock,
      x: sx,
      z: sz,
      radius: srad,
      maxRadius: smaxRad,
      age: sage,
      add: (x, z, maxRadius = 1.2) => {
        if (this.shockwaves.count >= this.shockwaves.max) return;
        const i = this.shockwaves.count++;
        sx[i] = x;
        sz[i] = z;
        srad[i] = 0.1;
        smaxRad[i] = maxRadius;
        sage[i] = 0;
      },
      update: (dt) => {
        for (let i = 0; i < this.shockwaves.count; i++) {
          sage[i] += dt;
          srad[i] += dt * 4.5;
          if (srad[i] >= smaxRad[i] || sage[i] > 0.4) {
            const last = --this.shockwaves.count;
            sx[i] = sx[last];
            sz[i] = sz[last];
            srad[i] = srad[last];
            smaxRad[i] = smaxRad[last];
            sage[i] = sage[last];
            i--;
          }
        }
      },
    };

    // Pool de dendritas de arborización (relámpagos sinápticos)
    const maxDendrites = 64;
    const dx1 = new Float32Array(maxDendrites);
    const dz1 = new Float32Array(maxDendrites);
    const dx2 = new Float32Array(maxDendrites);
    const dz2 = new Float32Array(maxDendrites);
    const dlife = new Float32Array(maxDendrites);
    const dmaxLife = new Float32Array(maxDendrites);

    this.dendrites = {
      count: 0,
      max: maxDendrites,
      x1: dx1,
      z1: dz1,
      x2: dx2,
      z2: dz2,
      life: dlife,
      maxLife: dmaxLife,
      add: (x1, z1, x2, z2, life = 0.25) => {
        if (this.dendrites.count >= this.dendrites.max) return;
        const i = this.dendrites.count++;
        dx1[i] = x1;
        dz1[i] = z1;
        dx2[i] = x2;
        dz2[i] = z2;
        dlife[i] = life;
        dmaxLife[i] = life;
      },
      update: (dt) => {
        for (let i = 0; i < this.dendrites.count; i++) {
          dlife[i] -= dt;
          if (dlife[i] <= 0) {
            const last = --this.dendrites.count;
            dx1[i] = dx1[last];
            dz1[i] = dz1[last];
            dx2[i] = dx2[last];
            dz2[i] = dz2[last];
            dlife[i] = dlife[last];
            dmaxLife[i] = dmaxLife[last];
            i--;
          }
        }
      },
    };

    // Nodos de Ranvier dejados tras un dash
    const maxNodes = 16;
    const rx = new Float32Array(maxNodes);
    const rz = new Float32Array(maxNodes);
    const rfuse = new Float32Array(maxNodes);

    this.ranvierNodes = {
      count: 0,
      max: maxNodes,
      x: rx,
      z: rz,
      fuse: rfuse,
      spawn: (x, z, fuse = 0.4) => {
        if (this.ranvierNodes.count >= this.ranvierNodes.max) return;
        const i = this.ranvierNodes.count++;
        rx[i] = x;
        rz[i] = z;
        rfuse[i] = fuse;
      },
      update: (dt, w) => {
        for (let i = 0; i < this.ranvierNodes.count; i++) {
          rfuse[i] -= dt;
          if (rfuse[i] <= 0) {
            const nx = rx[i];
            const nz = rz[i];
            w.shockwaves.add(nx, nz, 0.7);
            w.addRipple(nx, nz, 0.6);

            // Si tiene la carta Nodos de Ranvier, dispara 4 impulsos en cruz
            if (w.player.mods.ranvierShots > 0) {
              const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
              for (const a of angles) {
                const c = Math.cos(a);
                const s = Math.sin(a);
                w.projectiles.x[w.projectiles.count] = nx;
                w.projectiles.z[w.projectiles.count] = nz;
                w.projectiles.vx[w.projectiles.count] = c * 24;
                w.projectiles.vz[w.projectiles.count] = s * 24;
                w.projectiles.speed[w.projectiles.count] = 24;
                w.projectiles.damage[w.projectiles.count] = 8 * w.player.mods.damageMult;
                w.projectiles.bounces[w.projectiles.count] = w.player.mods.bounces;
                w.projectiles.pierce[w.projectiles.count] = w.player.mods.pierce;
                w.projectiles.falloff[w.projectiles.count] = w.player.mods.noBounceFalloff ? 1.0 : 0.8;
                w.projectiles.life[w.projectiles.count] = 1.6;
                w.projectiles.lastHit[w.projectiles.count] = -1;
                w.projectiles.prevHit[w.projectiles.count] = -1;
                if (w.projectiles.count < w.projectiles.max) w.projectiles.count++;
              }
            }

            const last = --this.ranvierNodes.count;
            rx[i] = rx[last];
            rz[i] = rz[last];
            rfuse[i] = rfuse[last];
            i--;
          }
        }
      },
    };
  }

  addRipple(x: number, z: number, strength = 1.0, currentTime = performance.now() * 0.001) {
    const r = this.ripples[this.rippleHead];
    r.x = x;
    r.y = z;
    r.time = currentTime;
    r.strength = strength;
    this.rippleHead = (this.rippleHead + 1) % 8;
  }

  /**
   * Sincroniza los cuerpos físicos de Rapier en el array espejo contiguo `enemyMirror`
   * y reconstruye el hash espacial `SpatialGrid` en O(n) con zero-allocation.
   */
  syncEnemyMirror() {
    let count = 0;
    const m = this.enemyMirror;
    const kinds: EnemyKind[] = ['swarmer', 'tank0', 'tank1', 'tank2', 'homing'];

    for (let k = 0; k < kinds.length; k++) {
      const kind = kinds[k];
      const pool = this.pools[kind];
      const bodies = pool.bodies;
      const alive = pool.alive;
      const hp = pool.hp;
      const dmgMult = pool.dmgMult;
      const r = RADIUS[kind];
      const threatWeight = kind === 'homing' ? 2.0 : kind.startsWith('tank') ? 1.5 : 0.8;

      for (let i = 0; i < alive.length; i++) {
        if (!alive[i] || !bodies[i]) continue;
        const b = bodies[i];
        const p = b.translation();
        const v = b.linvel();

        m.x[count] = p.x;
        m.z[count] = p.z;
        m.vx[count] = v.x;
        m.vz[count] = v.z;
        m.r[count] = r;
        m.id[count] = (k << 16) | i;
        m.threat[count] = threatWeight;
        m.kind[count] = kind;
        m.poolIndex[count] = i;
        m.alive[count] = 1;
        m.hp[count] = hp[i];
        m.dmgMult[count] = dmgMult[i];
        count++;
        if (count >= m.max) break;
      }
      if (count >= m.max) break;
    }

    m.count = count;
    this.enemyCount = count;
    this.grid.rebuild(m.x, m.z, count);
  }

  /**
   * Aplica daño a un enemigo identificado por su índice en `enemyMirror`.
   */
  damageEnemy(mirrorIdx: number, rawDamage: number, hitDirX = 0, hitDirZ = 0) {
    const m = this.enemyMirror;
    if (mirrorIdx < 0 || mirrorIdx >= m.count) return;

    const kind = m.kind[mirrorIdx];
    const poolIdx = m.poolIndex[mirrorIdx];
    const pool = this.pools[kind];
    if (!pool || !pool.alive[poolIdx]) return;

    const dmg = rawDamage * (pool.dmgMult[poolIdx] || 1);
    pool.hp[poolIdx] -= dmg;
    pool.flash[poolIdx] = HIT_FLASH; // destello blanco en la toxina
    feel.emit('hit');

    const x = m.x[mirrorIdx];
    const z = m.z[mirrorIdx];

    if (pool.hp[poolIdx] <= 0) {
      feel.emit('kill');
      this.kills++;
      this.score += Math.round(KILL_POINTS[kind] * (1 + this.region * 0.5));
      this.addRipple(x, z, 0.8);

      // Partículas y color temático por tipo de toxina
      if (this.burstEmitter) {
        if (kind === 'swarmer') {
          this.burstEmitter(x, 0.5, z, [1.2, 0.8, 1.6], 10, 4.0); // Humo: violeta grisáceo
        } else if (kind.startsWith('tank')) {
          this.burstEmitter(x, 0.5, z, [2.5, 1.8, 0.4], 28, 7.5); // Alcohol: ámbar
        } else if (kind === 'homing') {
          this.burstEmitter(x, 0.5, z, [2.8, 1.2, 0.3], 18, 6.0); // Ultraprocesado: naranja
        }
      }

      // Soltar neurotrofinas (orbes BDNF)
      const orbCount = kind === 'homing' ? 3 : kind.startsWith('tank') ? 4 : 2;
      for (let o = 0; o < orbCount; o++) {
        spawnOrb(this.orbs, x, z, 8);
      }

      // Manejar división del Tank
      if (kind.startsWith('tank')) {
        const gen = pool.gen[poolIdx] || 0;
        onTankKilled(poolIdx, gen, this, hitDirX, hitDirZ);
      } else {
        pool.park(poolIdx);
      }
    }
  }

  /** Petición de Ola de Potenciación pendiente (la atiende simulate) */
  ultRequest = false;
  /** Impulsos realizados en la partida (para la guía y estadísticas) */
  dashes = 0;
  /** Golpes recibidos en la región actual (para las estrellas) */
  hitsThisRegion = 0;

  /** Puntuación de la partida arcade (para la clasificación) */
  score = 0;
  kills = 0;
  elapsed = 0;

  reset(seed = 12345) {
    this.rng = mulberry32(seed);
    this.score = 0;
    this.ultRequest = false;
    this.dashes = 0;
    this.hitsThisRegion = 0;
    this.kills = 0;
    this.elapsed = 0;
    this.player.x = 0;
    this.player.z = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.brainPower = 100;
    this.player.vitality = 3;
    this.player.maxVitality = 3;
    this.player.dashCooldown = 0;
    this.player.dashActiveTimer = 0;
    this.player.invulnerableTimer = 0;
    this.player.inertiaDrag = 0;
    this.player.fatigue = 0;
    this.player.smokeSlowTimer = 0;
    this.player.shieldActive = false;
    this.player.shieldTimer = 0;
    this.player.dashFreeTimer = 0;
    this.player.ultCharge = 0;
    this.player.ultActiveTimer = 0;
    this.player.mods = baseModifiers();

    this.projectiles.count = 0;
    this.orbs.count = 0;
    this.telegraphs.count = 0;
    this.shockwaves.count = 0;
    this.dendrites.count = 0;
    this.ranvierNodes.count = 0;

    for (const pool of Object.values(this.pools)) {
      for (let i = 0; i < pool.bodies.length; i++) {
        if (pool.alive[i]) pool.park(i);
      }
    }

    this.director.startWave(0, 0, this);
    this.enemyCount = 0;
    this.wave = 0;
    this.region = 0;
    this.diff.hpMult = 1.0;
  }
}

export const world = new World();
