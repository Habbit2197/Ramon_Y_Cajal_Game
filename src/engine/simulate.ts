/**
 * simulate.ts — Paso fijo de simulación pura determinista (1/60s)
 *
 * Ejecuta en orden estricto:
 * 1. Director de spawn (presupuesto e intensidad)
 * 2. Telegrafías y nodos de Ranvier
 * 3. Espejo contiguo de enemigos (EnemyMirror) y SpatialGrid
 * 4. IA de dirección (Steering Boids, Homing, Tank)
 * 5. Sistema de armas y proyectiles (Arborización y rebotes)
 * 6. Magnetismo de neurotrofinas (BDNF / XP)
 * 7. Colisiones jugador-toxina y debuffs educativos
 * 8. División diferida de Tanks (flushSplits)
 */

import { World, type EnemyMirror } from './world';
import { BASE_WEAPON, onProjectileHit } from '../game/weapons';
import { spawnProjectile, stepProjectiles } from '../game/projectiles';
import { stepOrbs } from '../game/orbs';
import { steer, swarmerDesired, homingDesired, type Vec2 } from '../game/enemies/steering';
import { flushSplits } from '../game/enemies/tank';
import { feel } from './feel';
import { useRunStore } from '../store/useRunStore';
import { pickAimTarget, AIM_MOBILE } from '../game/aim';

const _steerOut: Vec2 = { x: 0, z: 0 };
const ULT_RADIUS = 9;
const ULT_DAMAGE = 70;

export function simulate(w: World, dt: number) {
  const runStore = useRunStore.getState();
  if (runStore.phase !== 'playing') return;

  const p = w.player;
  w.elapsed += dt;

  // ── 1. Director de spawns e IA de ritmo ──────────────────────────────
  w.director.step(dt, w);

  // ── 2. Nodos de Ranvier, ondas y telegrafías ─────────────────────────
  w.telegraphs.update(dt);
  w.ranvierNodes.update(dt, w);
  w.shockwaves.update(dt);
  w.dendrites.update(dt);

  // ── 3. Sincronizar cuerpos Rapier al espejo SoA y rehacer SpatialGrid ──
  w.syncEnemyMirror();
  const m = w.enemyMirror;

  // ── 4. IA de dirección de toxinas ───────────────────────────────────
  for (let k = 0; k < m.count; k++) {
    const kind = m.kind[k];
    const poolIdx = m.poolIndex[k];
    const pool = w.pools[kind];
    const body = pool.bodies[poolIdx];
    if (!body || !pool.alive[poolIdx]) continue;

    if (kind === 'swarmer') {
      swarmerDesired(poolIdx, pool, p.x, p.z, _steerOut);
      steer(body, _steerOut.x, _steerOut.z, 24, dt);
    } else if (kind.startsWith('tank')) {
      const tx = p.x - m.x[k];
      const tz = p.z - m.z[k];
      const td = Math.hypot(tx, tz) || 1;
      const speed = kind === 'tank0' ? 3.5 : kind === 'tank1' ? 4.5 : 5.8;
      steer(body, (tx / td) * speed, (tz / td) * speed, 18, dt);
    } else if (kind === 'homing') {
      homingDesired(poolIdx, pool, p.x, p.z, dt, _steerOut);
      steer(body, _steerOut.x, _steerOut.z, 28, dt);
    }
  }

  // ── 5. Sistema de armas y proyectiles ────────────────────────────────
  // Apuntado: ratón si se ha movido en los últimos 2 s; si no (táctil, solo teclado), auto-aim
  p.mouseIdle += dt;
  if (p.mouseIdle < 2) {
    const dx = p.mouseWX - p.x, dz = p.mouseWZ - p.z, len = Math.hypot(dx, dz);
    if (len > 0.3) { p.aimX = dx / len; p.aimZ = dz / len; }
  } else {
    const t = pickAimTarget(p.x, p.z, p.dirX || p.aimX, p.dirZ || p.aimZ, m, p.aimTargetId, AIM_MOBILE);
    if (t >= 0) {
      const dx = m.x[t] - p.x, dz = m.z[t] - p.z, len = Math.hypot(dx, dz) || 1;
      p.aimX = dx / len; p.aimZ = dz / len; p.aimTargetId = m.id[t];
    } else {
      p.aimTargetId = -1;
      if (p.dirX || p.dirZ) { p.aimX = p.dirX; p.aimZ = p.dirZ; }
    }
  }

  // Fatiga del azúcar: dispara más despacio un rato y se recupera sola
  p.fatigue = Math.max(0, p.fatigue - 0.12 * dt);
  const fireRate = BASE_WEAPON.fireRate * p.mods.fireRateMult * (1 - 0.45 * p.fatigue);
  const fireInterval = 1 / fireRate;
  w.shootCooldown -= dt;

  if (w.shootCooldown <= 0) {
    w.shootCooldown = fireInterval;
    const count = BASE_WEAPON.count + p.mods.extraProjectiles;
    const baseDamage = BASE_WEAPON.damage * p.mods.damageMult;
    const baseSpeed = BASE_WEAPON.speed;
    const bounces = p.mods.bounces;
    const pierce = p.mods.pierce;
    const falloff = p.mods.noBounceFalloff ? 1.0 : BASE_WEAPON.bounceFalloff;

    // Disparo en abanico
    const spread = BASE_WEAPON.spread;
    const baseAngle = Math.atan2(p.aimZ, p.aimX);

    for (let c = 0; c < count; c++) {
      const offsetAngle = count === 1 ? 0 : (c - (count - 1) * 0.5) * spread;
      const finalAngle = baseAngle + offsetAngle;
      const dirX = Math.cos(finalAngle);
      const dirZ = Math.sin(finalAngle);

      spawnProjectile(
        w.projectiles,
        p.x + dirX * 0.6,
        p.z + dirZ * 0.6,
        dirX,
        dirZ,
        baseSpeed,
        baseDamage,
        bounces,
        pierce,
        falloff,
        2.2
      );
    }
  }

  // Avanzar proyectiles y resolver impactos
  stepProjectiles(
    w.projectiles,
    m as unknown as import('../game/projectiles').EnemyCollisionData,
    dt,
    (pIdx, enemyIdx) => {
      return onProjectileHit(w.projectiles, pIdx, enemyIdx, w);
    }
  );

  // ── 6. Magnetismo de neurotrofinas (BDNF) ───────────────────────────
  stepOrbs(w.orbs, p.x, p.z, p.mods.magnetMult, dt, (val) => {
    runStore.addXp(val);
    p.brainPower = Math.min(100, p.brainPower + 1.5);
    p.ultCharge = Math.min(100, p.ultCharge + 4); // la Ola de Potenciación se carga con neurotrofinas
    feel.emit('hit');
  });

  // ── 6b. Ola de Potenciación (tecla E / botón «Ola») ─────────────────
  if (w.ultRequest) {
    w.ultRequest = false;
    if (p.ultCharge >= 100) {
      p.ultCharge = 0;
      p.invulnerableTimer = Math.max(p.invulnerableTimer, 0.8);
      for (let j = 0; j < m.count; j++) {
        const dx = m.x[j] - p.x, dz = m.z[j] - p.z, d = Math.hypot(dx, dz);
        if (d <= ULT_RADIUS) w.damageEnemy(j, ULT_DAMAGE * (1 - (d / ULT_RADIUS) * 0.5), dx / (d || 1), dz / (d || 1));
      }
      w.addRipple(p.x, p.z, 1.6);
      feel.emit('ultimate');
    }
  }

  // ── 7. Colisión jugador-toxinas y debuffs educativos ─────────────────
  const playerRadius = 0.5;
  w.grid.forEachInRadius(p.x, p.z, 2.5, (idx, distSq) => {
    if (!m.alive[idx]) return;
    const totalR = playerRadius + m.r[idx];
    if (distSq <= totalR * totalR) {
      if (p.invulnerableTimer <= 0) {
        if (p.shieldActive) {
          p.shieldActive = false;
          p.invulnerableTimer = 0.6;
          feel.emit('hit');
          w.addRipple(p.x, p.z, 0.8);
        } else {
          p.vitality -= 1;
          p.brainPower = Math.max(0, p.brainPower - 18);
          p.invulnerableTimer = 1.6; // i-frames tras golpe: margen para reaccionar
          // Retroceso: las toxinas cercanas salen despedidas para no encadenar golpes
          for (let j = 0; j < m.count; j++) {
            const kx = m.x[j] - p.x, kz = m.z[j] - p.z, kd = Math.hypot(kx, kz);
            if (kd > 3.5 || kd < 1e-3) continue;
            const kb = w.pools[m.kind[j]].bodies[m.poolIndex[j]];
            if (!kb) continue;
            const f = (3.5 - kd) * 2.2 * kb.mass();
            kb.applyImpulse({ x: (kx / kd) * f, y: 0, z: (kz / kd) * f }, true);
          }
          feel.emit('playerHurt');
          w.director.onPlayerHurt();

          // Debuffs educativos según toxina
          const kind = m.kind[idx];
          if (kind === 'swarmer') {
            p.smokeSlowTimer = 2.0; // Tabaco -> daño pulmonar / lentitud
          } else if (kind.startsWith('tank')) {
            p.inertiaDrag = 2.5; // Alcohol -> cerebelo afectado / pérdida de control
          } else if (kind === 'homing') {
            p.fatigue = Math.min(1.0, p.fatigue + 0.35); // Ultraprocesados -> pico y caída
          }

          if (p.vitality <= 0) {
            runStore.setPhase('gameover');
          }
        }
      }
    }
  });

  // ── 8. División diferida de Tanks ────────────────────────────────────
  flushSplits(w);

  // ── 9. Verificación de final de oleada ────────────────────────────────
  if (w.director.budget <= 0 && w.enemyCount === 0) {
    runStore.nextWave();
  }
}
