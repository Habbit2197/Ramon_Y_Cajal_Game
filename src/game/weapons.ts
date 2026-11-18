/**
 * weapons.ts — Mecánicas de disparo: «Arborización» (rebotes neuroplásticos) y balance de armas
 */

export interface WeaponStats {
  fireRate: number;      // disparos/s
  speed: number;         // u/s
  damage: number;
  count: number;         // proyectiles por disparo (abanico)
  spread: number;        // rad entre proyectiles
  bounces: number;       // saltos de arborización
  bounceFalloff: number; // 0.8 = −20 % por salto
  pierce: number;        // toxinas atravesadas antes de saltar
}

export const BASE_WEAPON: WeaponStats = {
  fireRate: 6,
  speed: 26,
  damage: 10,
  count: 1,
  spread: 0.18,
  bounces: 0,
  bounceFalloff: 0.8,
  pierce: 0,
};

/**
 * Rebote especular en muros: v' = v − 2(v·n)n
 */
export function reflect(vx: number, vz: number, nx: number, nz: number): [number, number] {
  const d = vx * nx + vz * nz;
  return [vx - 2 * d * nx, vz - 2 * d * nz];
}

/**
 * Comprueba colisión con los muros de la arena (límites rectangulares)
 */
export function arenaWallNormal(x: number, z: number, boundX = 14, boundZ = 10): { nx: number; nz: number } | null {
  if (x >= boundX) return { nx: -1, nz: 0 };
  if (x <= -boundX) return { nx: 1, nz: 0 };
  if (z >= boundZ) return { nx: 0, nz: -1 };
  if (z <= -boundZ) return { nx: 0, nz: 1 };
  return null;
}

/**
 * Llamado al impactar un proyectil contra un enemigo. Devuelve false si el proyectil muere.
 * Gestiona penetración (pierce) y rebotes de arborización dendrítica hacia el enemigo más próximo.
 */
export function onProjectileHit(
  p: import('./projectiles').ProjectilePool,
  i: number,
  mirrorIdx: number,
  w: import('../engine/world').World
): boolean {
  const m = w.enemyMirror;
  const enemy = m.ref(mirrorIdx);

  w.damageEnemy(mirrorIdx, p.damage[i], p.vx[i], p.vz[i]);
  p.lastHit[i] = enemy.id;

  if (p.pierce[i] > 0) {
    p.pierce[i]--;
    return true;
  }

  if (p.bounces[i] <= 0) return false;

  // Buscar el enemigo más cercano no golpeado en radio 7 unidades
  const nextIdx = w.grid.nearest(
    enemy.x,
    enemy.z,
    7.0,
    (idx) => m.id[idx] !== enemy.id && m.id[idx] !== p.prevHit[i] && m.alive[idx] === 1
  );

  if (nextIdx < 0) return false;

  const nextX = m.x[nextIdx];
  const nextZ = m.z[nextIdx];
  const dx = nextX - enemy.x;
  const dz = nextZ - enemy.z;
  const inv = 1 / (Math.hypot(dx, dz) || 1);

  p.vx[i] = dx * inv * p.speed[i];
  p.vz[i] = dz * inv * p.speed[i];
  p.x[i] = enemy.x;
  p.z[i] = enemy.z;
  p.prevHit[i] = enemy.id;
  p.bounces[i]--;
  p.damage[i] *= p.falloff[i];

  // Línea brillante de dendrita durante 0.25 s
  w.dendrites.add(enemy.x, enemy.z, nextX, nextZ, 0.25);
  return true;
}
