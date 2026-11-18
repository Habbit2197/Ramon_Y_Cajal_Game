/**
 * tank.ts — Lógica de muerte y división diferida del Tank (3 generaciones)
 *
 * REGLA CRÍTICA: La creación y modificación de cuerpos físicos NUNCA debe
 * ocurrir dentro de un paso de física o un callback de colisión directo.
 * La muerte de un Tank encola la división en `splitQueue` y se procesa tras `step()`.
 */

import { feel } from '../../engine/feel';
import { TANK_HP, type EnemyKind } from './pool';
import type { World } from '../../engine/world';

export interface SplitRequest {
  x: number;
  z: number;
  gen: number;
  dirX: number;
  dirZ: number;
}

export const splitQueue: SplitRequest[] = [];

/**
 * Procesa la muerte de un Tank. Desactiva el cuerpo actual y encola la división
 * perpendicular a la dirección del proyectil impactante.
 */
export function onTankKilled(
  i: number,
  gen: number,
  w: World,
  hitDirX = 1,
  hitDirZ = 0
) {
  const kind = `tank${gen}` as EnemyKind;
  const pool = w.pools[kind];
  if (!pool || !pool.bodies[i]) return;

  const p = pool.bodies[i].translation();
  pool.park(i);

  feel.emit('split');
  w.shockwaves.add(p.x, p.z, 0.9);

  // Normalizar vector de dirección
  const len = Math.hypot(hitDirX, hitDirZ) || 1;
  const ndx = hitDirX / len;
  const ndz = hitDirZ / len;

  if (gen < 2) {
    splitQueue.push({
      x: p.x,
      z: p.z,
      gen: gen + 1,
      dirX: ndx,
      dirZ: ndz,
    });
  }
}

/**
 * Se llama en simulate() inmediatamente después de step() de Rapier.
 * Genera los 2 tanks de la siguiente generación en trayectorias perpendiculares.
 */
export function flushSplits(w: World) {
  if (splitQueue.length === 0) return;

  for (let idx = 0; idx < splitQueue.length; idx++) {
    const s = splitQueue[idx];
    const px = -s.dirZ; // Vector perpendicular
    const pz = s.dirX;

    const childKind = `tank${s.gen}` as EnemyKind;
    const pool = w.pools[childKind];
    if (!pool) continue;

    for (const sign of [1, -1]) {
      const sx = s.x + px * sign * 0.6;
      const sz = s.z + pz * sign * 0.6;
      const hp = (TANK_HP[s.gen] ?? 10) * w.diff.hpMult;
      const j = pool.spawn(sx, sz, hp, s.gen);

      if (j >= 0 && pool.bodies[j]) {
        pool.bodies[j].applyImpulse(
          { x: px * sign * 4, y: 0, z: pz * sign * 4 },
          true
        );
      }
    }
  }

  splitQueue.length = 0;
}
