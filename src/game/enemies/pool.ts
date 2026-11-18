/**
 * pool.ts — Gestión eficiente de pools de enemigos con RapierRigidBody
 */

import type { RapierRigidBody } from '@react-three/rapier';

export type EnemyKind = 'swarmer' | 'tank0' | 'tank1' | 'tank2' | 'homing';

export const RADIUS: Record<EnemyKind, number> = {
  swarmer: 0.25,
  tank0: 0.9,
  tank1: 0.63,
  tank2: 0.44,
  homing: 0.4,
};

export const TANK_HP = [60, 24, 10];

export const PARK = { x: 0, y: -50, z: 0 };

export class EnemyPoolSim {
  bodies: RapierRigidBody[] = [];
  alive = new Uint8Array(0);
  hp = new Float32Array(0);
  gen = new Uint8Array(0);
  timer = new Float32Array(0);
  dmgMult = new Float32Array(0);

  constructor(public kind: EnemyKind) {}

  attach(b: RapierRigidBody[]) {
    this.bodies = b;
    const n = b.length;
    this.alive = new Uint8Array(n);
    this.hp = new Float32Array(n);
    this.gen = new Uint8Array(n);
    this.timer = new Float32Array(n);
    this.dmgMult = new Float32Array(n);
    this.dmgMult.fill(1);
  }

  spawn(x: number, z: number, hp: number, gen = 0, vx = 0, vz = 0): number {
    const i = this.alive.indexOf(0);
    if (i < 0) return -1; // Pool lleno

    const b = this.bodies[i];
    if (b) {
      b.setEnabled(true);
      b.setTranslation({ x, y: 0.5, z }, true);
      b.setLinvel({ x: vx, y: 0, z: vz }, true);
    }

    this.alive[i] = 1;
    this.hp[i] = hp;
    this.gen[i] = gen;
    this.timer[i] = 0;
    this.dmgMult[i] = 1;
    return i;
  }

  park(i: number) {
    const b = this.bodies[i];
    if (b) {
      b.setLinvel({ x: 0, y: 0, z: 0 }, false);
      b.setTranslation(PARK, false);
      b.setEnabled(false);
    }
    this.alive[i] = 0;
  }
}
