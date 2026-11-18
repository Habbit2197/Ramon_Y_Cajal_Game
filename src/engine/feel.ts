/**
 * feel.ts — Bus central de feedback visceral (hit-stop, screenshake por trauma, zoom punch, aberración)
 */

import { hitStop } from './clock';

export type FeelEvent = 'hit' | 'kill' | 'split' | 'playerHurt' | 'perfectDash' | 'ultimate';

interface FeelAction {
  stop: number;
  trauma: number;
  zoom: number;
  vib?: number;
}

const TABLE: Record<FeelEvent, FeelAction> = {
  hit:         { stop: 0,   trauma: 0.08, zoom: 0 },
  kill:        { stop: 35,  trauma: 0.18, zoom: 0.15, vib: 12 },
  split:       { stop: 70,  trauma: 0.4,  zoom: 0.3,  vib: 25 },
  playerHurt:  { stop: 90,  trauma: 0.6,  zoom: -0.2, vib: 60 },
  perfectDash: { stop: 0,   trauma: 0.1,  zoom: 0.35 },
  ultimate:    { stop: 120, trauma: 0.8,  zoom: 0.5,  vib: 80 },
};

export const feelSettings = {
  shakeScale: 1.0,
  haptics: true,
  reducedFlashes: false,
};

export const feel = {
  trauma: 0,
  zoom: 0,
  aberration: 0,
  killsThisFrame: 0,

  emit(e: FeelEvent) {
    const t = TABLE[e];
    if (e === 'kill' && ++this.killsThisFrame > 1) {
      // Evita acumulación excesiva de hit-stops en multi-bajas
      return;
    }
    hitStop(t.stop);
    this.trauma = Math.min(1, this.trauma + t.trauma);
    this.zoom += t.zoom;
    if (e === 'playerHurt') {
      this.aberration = 1;
    }
    if (t.vib && feelSettings.haptics && typeof navigator !== 'undefined') {
      try {
        navigator.vibrate?.(t.vib);
      } catch {
        // Ignorado si no soportado
      }
    }
  },

  update(dt: number) {
    this.killsThisFrame = 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.zoom *= Math.exp(-8 * dt);
    this.aberration = Math.max(0, this.aberration - dt * 4);
  },

  reset() {
    this.trauma = 0;
    this.zoom = 0;
    this.aberration = 0;
    this.killsThisFrame = 0;
  },
};
