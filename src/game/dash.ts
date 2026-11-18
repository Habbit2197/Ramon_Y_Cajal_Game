/**
 * dash.ts — «Conducción saltatoria» con i-frames de mielina y nodos de Ranvier
 */

import { slowMo } from '../engine/clock';
import { feel } from '../engine/feel';

export const DASH = {
  duration: 0.16,
  iframes: 0.28,
  cooldown: 1.2,
  speedMult: 3.2,
  perfectWindow: 0.12,
  nodes: 3,
};

export interface DashState {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  baseSpeed: number;
  dashCooldown: number;
  dashActiveTimer: number;
  invulnerableTimer: number;
  mods: {
    dashCdMult: number;
  };
}

export interface RanvierNodePool {
  spawn(x: number, z: number, fuse: number): void;
}

export function tryDash(
  p: DashState,
  threatNearby: boolean,
  ranvierPool?: RanvierNodePool
): boolean {
  if (p.dashCooldown > 0) return false;

  p.dashActiveTimer = DASH.duration;
  p.invulnerableTimer = Math.max(p.invulnerableTimer, DASH.iframes);
  p.dashCooldown = DASH.cooldown * (p.mods.dashCdMult || 1.0);

  // ¿Dash perfecto? Alguna amenaza inminente (<120ms)
  if (threatNearby) {
    slowMo(0.3, 0.35);
    p.dashCooldown = 0;
    feel.emit('perfectDash');
  }

  // Despliegue de nodos de Ranvier a lo largo de la trayectoria del salto
  if (ranvierPool) {
    for (let k = 1; k <= DASH.nodes; k++) {
      const t = k / (DASH.nodes + 1);
      const dist = DASH.speedMult * DASH.duration * p.baseSpeed * t;
      ranvierPool.spawn(p.x + p.dirX * dist, p.z + p.dirZ * dist, 0.4);
    }
  }

  return true;
}
