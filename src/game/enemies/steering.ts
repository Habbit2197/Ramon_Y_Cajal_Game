/**
 * steering.ts — Algoritmos de dirección y comportamiento cinemático/dinámico
 */

import type { RapierRigidBody } from '@react-three/rapier';
import { EnemyPoolSim } from './pool';

export interface Vec2 {
  x: number;
  z: number;
}

export function steer(
  b: RapierRigidBody,
  desiredX: number,
  desiredZ: number,
  maxAccel: number,
  dt: number
) {
  const v = b.linvel();
  const m = b.mass();
  let ax = (desiredX - v.x) / dt;
  let az = (desiredZ - v.z) / dt;
  const a = Math.hypot(ax, az);
  if (a > maxAccel) {
    ax *= maxAccel / a;
    az *= maxAccel / a;
  }
  b.applyImpulse({ x: ax * m * dt, y: 0, z: az * m * dt }, true);
}

/**
 * Swarmer: bandada de Boids (separación, alineación y cohesión) hacia el jugador
 */
export function swarmerDesired(
  i: number,
  s: EnemyPoolSim,
  px: number,
  pz: number,
  out: Vec2
) {
  const b = s.bodies[i];
  if (!b) return;
  const p = b.translation();
  const v = b.linvel();

  let sx = 0, sz = 0, ax = 0, az = 0, cx = 0, cz = 0, n = 0;

  for (let j = 0; j < s.bodies.length; j++) {
    if (j === i || !s.alive[j]) continue;
    const oj = s.bodies[j].translation();
    const dx = p.x - oj.x;
    const dz = p.z - oj.z;
    const d2 = dx * dx + dz * dz + 1e-3;
    if (d2 < 2.5) {
      sx += dx / d2;
      sz += dz / d2;
      const vj = s.bodies[j].linvel();
      ax += vj.x;
      az += vj.z;
      cx += oj.x;
      cz += oj.z;
      n++;
    }
  }

  const tx = px - p.x;
  const tz = pz - p.z;
  const td = Math.hypot(tx, tz) || 1;

  let dx = (tx / td) * 1.0 + sx * 0.9;
  let dz = (tz / td) * 1.0 + sz * 0.9;

  if (n > 0) {
    dx += (ax / n - v.x) * 0.08 + (cx / n - p.x) * 0.15;
    dz += (az / n - v.z) * 0.08 + (cz / n - p.z) * 0.15;
  }

  const l = Math.hypot(dx, dz) || 1;
  out.x = (dx / l) * 7.5;
  out.z = (dz / l) * 7.5;
}

/**
 * Homing: persecución con giro angular limitado y «bajón de azúcar» tras 6 segundos
 */
export function homingDesired(
  i: number,
  s: EnemyPoolSim,
  px: number,
  pz: number,
  dt: number,
  out: Vec2
) {
  const b = s.bodies[i];
  if (!b) return;
  const p = b.translation();
  const v = b.linvel();

  s.timer[i] += dt;
  const crashed = s.timer[i] > 6.0;
  const speed = crashed ? 2.0 : 9.0;
  const turn = crashed ? 4.0 : 2.2;

  const cur = Math.atan2(v.z || 0.01, v.x || 0.01);
  const want = Math.atan2(pz - p.z, px - p.x);
  let d = want - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d)); // [-π, π]

  const clamped = Math.min(turn * dt, Math.max(-turn * dt, d));
  const ang = cur + clamped;

  out.x = Math.cos(ang) * speed;
  out.z = Math.sin(ang) * speed;
  s.dmgMult[i] = crashed ? 2.0 : 1.0;
}
