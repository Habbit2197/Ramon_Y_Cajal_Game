/**
 * aim.ts — Asistencia de apuntado inteligente para ratón, gamepad y auto-aim en móvil
 */

export interface AimOpts {
  range: number;
  coneCos: number;
  stickiness: number;
}

export const AIM_MOBILE: AimOpts = {
  range: 11,
  coneCos: Math.cos(Math.PI * 0.75), // ~270° de visión periférica
  stickiness: 0.6,
};

export const AIM_GAMEPAD: AimOpts = {
  range: 13,
  coneCos: Math.cos(0.35), // Cono estrecho de ~20°
  stickiness: 0.3,
};

export interface AimEnemyData {
  count: number;
  id: Int32Array;
  x: Float32Array;
  z: Float32Array;
  threat: Float32Array;
  alive: Uint8Array;
}

export function pickAimTarget(
  px: number,
  pz: number,
  dirX: number,
  dirZ: number,
  enemies: AimEnemyData,
  prevId: number,
  o: AimOpts
): number {
  let bestIdx = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < enemies.count; i++) {
    if (!enemies.alive[i]) continue;

    const dx = enemies.x[i] - px;
    const dz = enemies.z[i] - pz;
    const d = Math.hypot(dx, dz) || 1e-3;
    if (d > o.range) continue;

    const cos = (dx * dirX + dz * dirZ) / d;
    if (cos < o.coneCos) continue;

    let s = cos * 1.5 - d / o.range + (enemies.threat[i] || 1) * 0.8;
    if (enemies.id[i] === prevId) {
      s += o.stickiness; // Histéresis para evitar parpadeo entre objetivos
    }

    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  return bestIdx;
}
