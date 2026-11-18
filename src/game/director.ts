/**
 * director.ts — Director de apariciones e IA de ritmo con presupuesto de amenaza
 *
 * Basado en el AI Director (Left 4 Dead):
 * - Presupuesto de amenaza por oleada: 20 + 12w + 25r
 * - Intervalo de compra dinámico: max(0.6, 2.2 - 0.12w)
 * - Seguimiento de intensidad: +0.35 por daño recibido, +0.02/s por enemigo cercano (<4u)
 * - Fase de respiro de 4 s cuando intensidad > 1.0
 * - Aviso de telemetría/telegrafía de 0.8 s en el suelo antes de materializar el enemigo
 */

import type { World } from '../engine/world';
import { TANK_HP } from './enemies/pool';

export interface SpawnOption {
  id: string;
  minWave: number;
  cost: number;
  weight: number;
  spawn: (w: World, x: number, z: number) => void;
}

export const REGION_MENU: SpawnOption[][] = [
  // Región 0: Corteza prefrontal
  [
    {
      id: 'swarmer_group',
      minWave: 0,
      cost: 2,
      weight: 10,
      spawn: (w, x, z) => {
        // Genera 1 a 3 swarmers
        const count = 1 + Math.floor(w.rng() * 2);
        for (let i = 0; i < count; i++) {
          const ox = (w.rng() - 0.5) * 1.2;
          const oz = (w.rng() - 0.5) * 1.2;
          w.pools.swarmer.spawn(x + ox, z + oz, 8 * w.diff.hpMult);
        }
      },
    },
    {
      id: 'homing_single',
      minWave: 3,
      cost: 5,
      weight: 5,
      spawn: (w, x, z) => {
        w.pools.homing.spawn(x, z, 14 * w.diff.hpMult);
      },
    },
  ],
  // Región 1: Hipocampo
  [
    {
      id: 'swarmer_group',
      minWave: 0,
      cost: 2,
      weight: 8,
      spawn: (w, x, z) => {
        const count = 2;
        for (let i = 0; i < count; i++) {
          const ox = (w.rng() - 0.5) * 1.5;
          const oz = (w.rng() - 0.5) * 1.5;
          w.pools.swarmer.spawn(x + ox, z + oz, 9 * w.diff.hpMult);
        }
      },
    },
    {
      id: 'homing_single',
      minWave: 0,
      cost: 5,
      weight: 6,
      spawn: (w, x, z) => {
        w.pools.homing.spawn(x, z, 15 * w.diff.hpMult);
      },
    },
    {
      id: 'tank_heavy',
      minWave: 2,
      cost: 9,
      weight: 4,
      spawn: (w, x, z) => {
        w.pools.tank0.spawn(x, z, (TANK_HP[0] ?? 60) * w.diff.hpMult, 0);
      },
    },
  ],
  // Región 2: Cerebelo
  [
    {
      id: 'swarmer_group',
      minWave: 0,
      cost: 2,
      weight: 6,
      spawn: (w, x, z) => {
        for (let i = 0; i < 3; i++) {
          const ox = (w.rng() - 0.5) * 1.5;
          const oz = (w.rng() - 0.5) * 1.5;
          w.pools.swarmer.spawn(x + ox, z + oz, 10 * w.diff.hpMult);
        }
      },
    },
    {
      id: 'homing_single',
      minWave: 0,
      cost: 5,
      weight: 6,
      spawn: (w, x, z) => {
        w.pools.homing.spawn(x, z, 16 * w.diff.hpMult);
      },
    },
    {
      id: 'tank_heavy',
      minWave: 0,
      cost: 9,
      weight: 6,
      spawn: (w, x, z) => {
        w.pools.tank0.spawn(x, z, (TANK_HP[0] ?? 60) * w.diff.hpMult, 0);
      },
    },
  ],
];

export function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight;
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Calcula un punto fuera del área central del jugador pero contenido en los muros de la arena.
 */
export function offscreenPoint(w: World): [number, number] {
  const px = w.player.x;
  const pz = w.player.z;
  const boundX = 12.5;
  const boundZ = 8.5;

  // Elegir un ángulo aleatorio y una distancia de 7 a 11 unidades del jugador
  const angle = w.rng() * Math.PI * 2;
  const dist = 7 + w.rng() * 4;

  let x = px + Math.cos(angle) * dist;
  let z = pz + Math.sin(angle) * dist;

  // Si se sale de los límites de la arena, rebotar hacia adentro
  if (x > boundX) x = boundX - (w.rng() * 2);
  if (x < -boundX) x = -boundX + (w.rng() * 2);
  if (z > boundZ) z = boundZ - (w.rng() * 2);
  if (z < -boundZ) z = -boundZ + (w.rng() * 2);

  return [x, z];
}

export class Director {
  budget = 0;
  cd = 0;
  intensity = 0;
  relax = 0;
  interval = 2.2;
  waveActive = false;

  startWave(w: number, r: number, world: World) {
    this.budget = 20 + 12 * w + 25 * r;
    world.diff.hpMult = 1 + 0.05 * w + 0.15 * r;
    this.interval = Math.max(0.6, 2.2 - 0.12 * w);
    this.cd = 0.5;
    this.intensity = 0;
    this.relax = 0;
    this.waveActive = true;
  }

  step(dt: number, w: World) {
    if (!this.waveActive) return;

    // Decaimiento natural y acumulación por enemigos cercanos a menos de 4 unidades
    const nearCount = w.grid.countNear(w.player.x, w.player.z, 4);
    this.intensity = Math.max(0, this.intensity - 0.15 * dt) + 0.02 * nearCount * dt;

    // Fase de respiro si la tensión supera el umbral crítico
    if (this.intensity > 1 && this.relax <= 0) {
      this.relax = 4;
    }

    if (this.relax > 0) {
      this.relax -= dt;
      return;
    }

    if ((this.cd -= dt) > 0 || this.budget <= 0) return;
    if (w.enemyCount >= w.maxEnemies) return;

    const regionMenu = REGION_MENU[Math.min(w.region, REGION_MENU.length - 1)] ?? REGION_MENU[0];
    const available = regionMenu.filter((opt) => opt.minWave <= w.wave && opt.cost <= this.budget);
    if (available.length === 0) return;

    const pick = weightedPick(available, w.rng);
    const [x, z] = offscreenPoint(w);

    // Aviso telegrafiado en suelo antes del spawn (0.8s)
    w.telegraphs.add(x, z, 0.8, () => {
      pick.spawn(w, x, z);
    });

    this.budget -= pick.cost;
    this.cd = this.interval;
  }

  onPlayerHurt() {
    this.intensity += 0.35;
  }
}
