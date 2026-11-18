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

export function simulate(w: World, dt: number) {
  const runStore = useRunStore.getState();
  if (runStore.phase !== 'playing') return;

  const p = w.player;

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

  // ── Asistencia de apuntado / Auto-aim (móvil o sin ratón) ─────────
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const noMouse = !p.hasMouse;

  if (isTouch || noMouse) {
    const lookDirX = p.dirX !== 0 || p.dirZ !== 0 ? p.dirX : (p.aimX || 0);
    const lookDirZ = p.dirX !== 0 || p.dirZ !== 0 ? p.dirZ : (p.aimZ || -1);
    const targetIdx = pickAimTarget(
      p.x,
      p.z,
      lookDirX,
      lookDirZ,
      m,
      p.prevTargetId ?? -1,
      AIM_MOBILE
    );
    if (targetIdx >= 0) {
      p.prevTargetId = m.id[targetIdx];
      const dx = m.x[targetIdx] - p.x;
      const dz = m.z[targetIdx] - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        p.aimX = dx / d;
        p.aimZ = dz / d;
      }
    } else if (p.dirX !== 0 || p.dirZ !== 0) {
      p.aimX = p.dirX;
      p.aimZ = p.dirZ;
    }
  }

  // ── 5. Sistema de armas y proyectiles ────────────────────────────────
  const fireRate = BASE_WEAPON.fireRate * p.mods.fireRateMult;
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
    feel.emit('hit');
  });

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
          p.invulnerableTimer = 1.0; // 1 segundo de i-frames tras golpe recibido
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
