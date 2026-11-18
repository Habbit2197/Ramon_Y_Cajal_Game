/**
 * orbs.ts — Magnetismo y física de neurotrofinas (BrainPower / BDNF) en SoA
 */

export interface OrbPool {
  count: number;
  max: number;
  x: Float32Array;
  z: Float32Array;
  vx: Float32Array;
  vz: Float32Array;
  age: Float32Array;
  homing: Uint8Array;
  pull: Float32Array;
  value: Float32Array;
}

export function createOrbPool(max = 256): OrbPool {
  return {
    count: 0,
    max,
    x: new Float32Array(max),
    z: new Float32Array(max),
    vx: new Float32Array(max),
    vz: new Float32Array(max),
    age: new Float32Array(max),
    homing: new Uint8Array(max),
    pull: new Float32Array(max),
    value: new Float32Array(max),
  };
}

export function spawnOrb(
  pool: OrbPool,
  x: number,
  z: number,
  value = 5,
  speed = 4
) {
  if (pool.count >= pool.max) return;
  const i = pool.count++;
  const ang = Math.random() * Math.PI * 2;
  const sp = speed * (0.6 + Math.random() * 0.8);

  pool.x[i] = x;
  pool.z[i] = z;
  pool.vx[i] = Math.cos(ang) * sp;
  pool.vz[i] = Math.sin(ang) * sp;
  pool.age[i] = 0;
  pool.homing[i] = 0;
  pool.pull[i] = 4;
  pool.value[i] = value;
}

export function stepOrbs(
  o: OrbPool,
  px: number,
  pz: number,
  magnetMult: number,
  dt: number,
  onCollect: (value: number) => void
) {
  const R = 3.5 * magnetMult;
  const R2 = R * R;
  const collectRadiusSq = 0.5 * 0.5;

  for (let i = 0; i < o.count; i++) {
    o.age[i] += dt;

    if (o.age[i] < 0.35) {
      // Fase de dispersión inicial explosiva
      const f = Math.exp(-7 * dt);
      o.vx[i] *= f;
      o.vz[i] *= f;
    } else {
      const dx = px - o.x[i];
      const dz = pz - o.z[i];
      const d2 = dx * dx + dz * dz;

      // Una vez enganchado por el campo de atracción, no se suelta
      if (!o.homing[i] && d2 < R2) {
        o.homing[i] = 1;
      }

      if (o.homing[i]) {
        o.pull[i] = Math.min(o.pull[i] + dt * 45, 34); // Velocidad objetivo creciente
        const inv = 1 / Math.sqrt(d2 + 1e-4);
        const b = 1 - Math.exp(-14 * dt);
        o.vx[i] += (dx * inv * o.pull[i] - o.vx[i]) * b;
        o.vz[i] += (dz * inv * o.pull[i] - o.vz[i]) * b;

        if (d2 < collectRadiusSq) {
          onCollect(o.value[i]);
          // Swap-remove para compactar arrays en O(1)
          const last = --o.count;
          o.x[i] = o.x[last];
          o.z[i] = o.z[last];
          o.vx[i] = o.vx[last];
          o.vz[i] = o.vz[last];
          o.age[i] = o.age[last];
          o.homing[i] = o.homing[last];
          o.pull[i] = o.pull[last];
          o.value[i] = o.value[last];
          i--;
          continue;
        }
      }
    }

    o.x[i] += o.vx[i] * dt;
    o.z[i] += o.vz[i] * dt;
  }
}
