import { describe, it, expect } from 'vitest';
import { pickAimTarget, AIM_MOBILE, type AimEnemyData } from './aim';

const enemies = (list: { x: number; z: number; id?: number; threat?: number; alive?: boolean }[]): AimEnemyData => ({
  count: list.length,
  id: Int32Array.from(list.map((e, i) => e.id ?? i)),
  x: Float32Array.from(list.map((e) => e.x)),
  z: Float32Array.from(list.map((e) => e.z)),
  threat: Float32Array.from(list.map((e) => e.threat ?? 1)),
  alive: Uint8Array.from(list.map((e) => (e.alive === false ? 0 : 1))),
});

describe('Auto-aim táctil (pickAimTarget)', () => {
  it('sin toxinas no apunta a nada', () => {
    expect(pickAimTarget(0, 0, 0, -1, enemies([]), -1, AIM_MOBILE)).toBe(-1);
  });

  it('ignora toxinas fuera de alcance o eliminadas', () => {
    const e = enemies([{ x: 0, z: -30 }, { x: 1, z: -1, alive: false }]);
    expect(pickAimTarget(0, 0, 0, -1, e, -1, AIM_MOBILE)).toBe(-1);
  });

  it('prefiere una toxina cercana que amenaza aunque la lejana fuera el objetivo anterior', () => {
    // lejana delante (objetivo anterior, id 7) y cercana a un lado
    const e = enemies([{ x: 0, z: -10, id: 7 }, { x: 2, z: 0.5, id: 8 }]);
    expect(pickAimTarget(0, 0, 0, -1, e, 7, AIM_MOBILE)).toBe(1);
  });

  it('entre dos casi iguales mantiene el objetivo anterior (no parpadea)', () => {
    const e = enemies([{ x: 3, z: -4, id: 1 }, { x: -3, z: -4.05, id: 2 }]);
    expect(pickAimTarget(0, 0, 0, -1, e, 2, AIM_MOBILE)).toBe(1);
    expect(pickAimTarget(0, 0, 0, -1, e, 1, AIM_MOBILE)).toBe(0);
  });

  it('sin objetivo anterior, elige la más cercana', () => {
    const e = enemies([{ x: 0, z: -9 }, { x: 0, z: -4 }, { x: 6, z: -6 }]);
    expect(pickAimTarget(0, 0, 0, -1, e, -1, AIM_MOBILE)).toBe(1);
  });
});
