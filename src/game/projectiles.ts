/**
 * projectiles.ts — Simulación de proyectiles en SoA sin sobrecarga de Rapier
 */

import { arenaWallNormal, reflect } from './weapons';

export interface ProjectilePool {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vz: Float32Array;
  life: Float32Array;
  damage: Float32Array;
  bounces: Int32Array;
  falloff: Float32Array;
  pierce: Int32Array;
  speed: Float32Array;
  lastHit: Int32Array;
  prevHit: Int32Array;
}

export function createProjectilePool(max = 512): ProjectilePool {
  return {
    count: 0,
    max,
    x: new Float32Array(max),
    z: new Float32Array(max),
    vx: new Float32Array(max),
    vz: new Float32Array(max),
    life: new Float32Array(max),
    damage: new Float32Array(max),
    bounces: new Int32Array(max),
    falloff: new Float32Array(max),
    pierce: new Int32Array(max),
    speed: new Float32Array(max),
    lastHit: new Int32Array(max),
    prevHit: new Int32Array(max),
  };
}

export function spawnProjectile(
  p: ProjectilePool,
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  speed = 26,
  damage = 10,
  bounces = 0,
  pierce = 0,
  falloff = 0.8,
  life = 2.0
): number {
  if (p.count >= p.max) return -1;
  const i = p.count++;
  p.x[i] = x;
  p.z[i] = z;
  p.vx[i] = dirX * speed;
  p.vz[i] = dirZ * speed;
  p.speed[i] = speed;
  p.damage[i] = damage;
  p.bounces[i] = bounces;
  p.pierce[i] = pierce;
  p.falloff[i] = falloff;
  p.life[i] = life;
  p.lastHit[i] = -1;
  p.prevHit[i] = -1;
  return i;
}

export function removeProjectileAt(p: ProjectilePool, i: number) {
  const last = --p.count;
  if (i === last) return;
  p.x[i] = p.x[last];
  p.z[i] = p.z[last];
  p.vx[i] = p.vx[last];
  p.vz[i] = p.vz[last];
  p.speed[i] = p.speed[last];
  p.damage[i] = p.damage[last];
  p.bounces[i] = p.bounces[last];
  p.pierce[i] = p.pierce[last];
  p.falloff[i] = p.falloff[last];
  p.life[i] = p.life[last];
  p.lastHit[i] = p.lastHit[last];
  p.prevHit[i] = p.prevHit[last];
}

/**
 * Encuentra el primer t ∈ [0,1] en que el segmento toca el círculo, o −1.
 */
export function segmentCircleT(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  r: number
): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const fx = x0 - cx;
  const fz = z0 - cz;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;

  if (c <= 0) return 0; // Ya está dentro
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return -1;

  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

export interface EnemyCollisionData {
  count: number;
  id: Int32Array;
  x: Float32Array;
  z: Float32Array;
  r: Float32Array;
  alive: Uint8Array;
}

export function stepProjectiles(
  p: ProjectilePool,
  enemies: EnemyCollisionData,
  dt: number,
  onHit: (pIdx: number, enemyIdx: number) => boolean,
  arenaBounds = { x: 14.5, z: 10.5 }
) {
  for (let i = 0; i < p.count; i++) {
    const x0 = p.x[i];
    const z0 = p.z[i];
    const x1 = x0 + p.vx[i] * dt;
    const z1 = z0 + p.vz[i] * dt;
    p.life[i] -= dt;

    let hit = -1;
    let bestT = 2;

    // Comprobación de colisiones continuas contra enemigos vivos
    for (let j = 0; j < enemies.count; j++) {
      if (!enemies.alive[j]) continue;
      if (enemies.id[j] === p.lastHit[i]) continue;

      const t = segmentCircleT(x0, z0, x1, z1, enemies.x[j], enemies.z[j], enemies.r[j] + 0.14);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = j;
      }
    }

    if (hit >= 0) {
      const keepsGoing = onHit(i, hit);
      if (!keepsGoing) {
        removeProjectileAt(p, i);
        i--;
        continue;
      }
    } else {
      p.x[i] = x1;
      p.z[i] = z1;

      // Colisión y rebote contra los muros
      const wall = arenaWallNormal(x1, z1, arenaBounds.x, arenaBounds.z);
      if (wall && p.bounces[i] > 0) {
        const [rvx, rvz] = reflect(p.vx[i], p.vz[i], wall.nx, wall.nz);
        p.vx[i] = rvx;
        p.vz[i] = rvz;
        p.bounces[i]--;
      } else if (wall || p.life[i] <= 0) {
        removeProjectileAt(p, i);
        i--;
        continue;
      }
    }
  }
}
