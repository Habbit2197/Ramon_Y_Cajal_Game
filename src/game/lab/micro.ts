/**
 * micro.ts — Minijuego «Microscopio»: la tinción de Golgi.
 *
 * En cada muestra hay unas pocas neuronas teñidas escondidas (la tinción de Golgi solo
 * colorea algunas, al azar). El jugador aplica el reactivo frotando la muestra: donde lo
 * aplica, aparecen las neuronas teñidas. El reactivo es limitado: solo se gasta al cubrir
 * zona nueva. Al descubrir una neurona, hay que decir de qué tipo es.
 */
import { mulberry32 } from '../../engine/rng';
import type { CellType } from './neuronShapes';

export interface MicroRound {
  id: string;
  title: string;
  /** Tipos que pueden aparecer (también son las opciones al identificar) */
  types: CellType[];
  fact: string;
}

export const MICRO_ROUNDS: MicroRound[] = [
  { id: 'corteza', title: 'Corteza cerebral', types: ['piramidal', 'estrellada', 'astrocito'], fact: 'Cajal dibujó las capas de la corteza llenas de neuronas piramidales, con su dendrita larga apuntando hacia la superficie.' },
  { id: 'cerebelo', title: 'Cerebelo', types: ['purkinje', 'granulo', 'astrocito'], fact: 'En el cerebelo, cada célula de Purkinje recibe mensajes de muchísimas células granulares a la vez.' },
  { id: 'hipocampo', title: 'Hipocampo', types: ['piramidal', 'granulo', 'astrocito'], fact: 'El hipocampo, clave para la memoria, tiene neuronas piramidales y una zona llena de células granulares.' },
];

/** Campo de la muestra: 1 de ancho y 0,75 de alto */
export const FIELD_W = 1;
export const FIELD_H = 0.75;
export const GRID_X = 48;
export const GRID_Y = 36;
export const STAINED_PER_ROUND = 4;
export const BRUSH_R = 0.055;
export const ROUND_SECONDS = 40;

export interface SampleCell {
  id: number;
  type: CellType;
  x: number;
  y: number;
  /** Tamaño en unidades del campo */
  scale: number;
  seed: number;
  found: boolean;
  /** null: sin identificar; true/false: acierto o fallo */
  identified: boolean | null;
}

export interface MicroSample {
  round: number;
  cells: SampleCell[];
  /** Núcleos sin teñir (solo decoración): x, y, radio */
  nuclei: number[];
  /** Rejilla de zona cubierta por el reactivo */
  covered: Uint8Array;
  coveredCount: number;
  /** Celdas de rejilla que se pueden cubrir con el reactivo disponible */
  inkCells: number;
}

const SCALE: Record<CellType, number> = { piramidal: 0.36, purkinje: 0.3, granulo: 0.2, estrellada: 0.24, astrocito: 0.2 };

/** Muestra de una ronda. Función pura: misma semilla, misma muestra. */
export function generateSample(seed: number, round: number, inkFraction = 0.6): MicroSample {
  const rng = mulberry32(seed + round * 1013);
  const r = MICRO_ROUNDS[round];
  const cells: SampleCell[] = [];
  // tipos: al menos uno de cada uno de los dos primeros, el resto al azar
  const types: CellType[] = [r.types[0], r.types[1]];
  while (types.length < STAINED_PER_ROUND) types.push(r.types[Math.floor(rng() * r.types.length)]);
  let tries = 0;
  for (const type of types) {
    let x = 0, y = 0, ok = false;
    while (!ok && tries++ < 400) {
      x = 0.1 + rng() * 0.8;
      y = 0.1 + rng() * (FIELD_H - 0.2);
      ok = cells.every((c) => Math.hypot(c.x - x, c.y - y) > 0.2);
    }
    cells.push({ id: cells.length, type, x, y, scale: SCALE[type] * (0.85 + rng() * 0.3), seed: (rng() * 1e9) | 0, found: false, identified: null });
  }
  const nuclei: number[] = [];
  for (let i = 0; i < 140; i++) nuclei.push(rng() * FIELD_W, rng() * FIELD_H, 0.004 + rng() * 0.005);
  return { round, cells, nuclei, covered: new Uint8Array(GRID_X * GRID_Y), coveredCount: 0, inkCells: Math.round(GRID_X * GRID_Y * inkFraction) };
}

export const inkLeft = (s: MicroSample) => Math.max(0, 1 - s.coveredCount / s.inkCells);

/**
 * Aplica reactivo en (x, y). Solo gasta tinta en zona nueva; devuelve las neuronas
 * descubiertas en este toque (su soma queda dentro de la zona teñida).
 */
export function applyStain(s: MicroSample, x: number, y: number, r = BRUSH_R): SampleCell[] {
  if (s.coveredCount >= s.inkCells) return [];
  const gx0 = Math.max(0, Math.floor(((x - r) / FIELD_W) * GRID_X));
  const gx1 = Math.min(GRID_X - 1, Math.floor(((x + r) / FIELD_W) * GRID_X));
  const gy0 = Math.max(0, Math.floor(((y - r) / FIELD_H) * GRID_Y));
  const gy1 = Math.min(GRID_Y - 1, Math.floor(((y + r) / FIELD_H) * GRID_Y));
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const cx = ((gx + 0.5) / GRID_X) * FIELD_W, cy = ((gy + 0.5) / GRID_Y) * FIELD_H;
      if (Math.hypot(cx - x, cy - y) > r) continue;
      const i = gy * GRID_X + gx;
      if (!s.covered[i] && s.coveredCount < s.inkCells) {
        s.covered[i] = 1;
        s.coveredCount++;
      }
    }
  }
  const found: SampleCell[] = [];
  for (const c of s.cells) {
    if (c.found) continue;
    if (isCovered(s, c.x, c.y)) {
      c.found = true;
      found.push(c);
    }
  }
  return found;
}

export function isCovered(s: MicroSample, x: number, y: number) {
  const gx = Math.min(GRID_X - 1, Math.max(0, Math.floor((x / FIELD_W) * GRID_X)));
  const gy = Math.min(GRID_Y - 1, Math.max(0, Math.floor((y / FIELD_H) * GRID_Y)));
  return s.covered[gy * GRID_X + gx] === 1;
}

export const roundDone = (s: MicroSample) => s.cells.every((c) => c.found && c.identified !== null);

/** Puntos de una ronda: neuronas descubiertas, tipos acertados, tinta y tiempo sobrantes */
export function roundScore(s: MicroSample, secondsLeft: number): number {
  const found = s.cells.filter((c) => c.found).length;
  const right = s.cells.filter((c) => c.identified === true).length;
  const all = found === s.cells.length;
  return found * 150 + right * 100 + (all ? Math.round(inkLeft(s) * 200 + Math.max(0, secondsLeft) * 5) : 0);
}
