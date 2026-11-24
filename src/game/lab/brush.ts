/**
 * brush.ts — Minijuego «Cepíllate los dientes».
 *
 * Como recomiendan los dentistas: pasta con flúor del tamaño de un guisante, dos minutos
 * repartidos en cuatro zonas de la boca (30 s cada una), por fuera, por dentro y la parte
 * de arriba de las muelas, con movimientos cortos de vaivén, y al final escupir sin enjuagar.
 *
 * La placa es una rejilla por cara: se acumula sobre todo junto a la encía y entre los dientes.
 * Frotar con vaivén corto limpia mucho; pasar el cepillo de largo, deprisa, limpia poco.
 */
import { mulberry32 } from '../../engine/rng';

export type Face = 'fuera' | 'dentro' | 'arriba';
export const FACES: Face[] = ['fuera', 'dentro', 'arriba'];
export const FACE_LABEL: Record<Face, string> = { fuera: 'Por fuera', dentro: 'Por dentro', arriba: 'Por arriba (donde masticas)' };

export interface Quadrant {
  id: string;
  label: string;
  upper: boolean;
}
/** Orden habitual: arriba a la derecha, arriba a la izquierda, abajo a la izquierda, abajo a la derecha */
export const QUADRANTS: Quadrant[] = [
  { id: 'sd', label: 'Arriba a la derecha', upper: true },
  { id: 'si', label: 'Arriba a la izquierda', upper: true },
  { id: 'ii', label: 'Abajo a la izquierda', upper: false },
  { id: 'id', label: 'Abajo a la derecha', upper: false },
];

export type ToothKind = 'incisivo' | 'canino' | 'premolar' | 'molar';
/** Dientes de medio arco (del centro hacia el fondo): 2 incisivos, canino, 2 premolares, 2 molares */
export const HALF_ARCH: ToothKind[] = ['incisivo', 'incisivo', 'canino', 'premolar', 'premolar', 'molar', 'molar'];
const WIDTH: Record<ToothKind, number> = { incisivo: 0.8, canino: 0.85, premolar: 0.9, molar: 1.25 };

/** Segundos por zona en Científico (4 × 30 s = los 2 minutos que recomiendan los dentistas) */
export const QUADRANT_SECONDS = 30;
/** Reparto del tiempo de cada zona entre sus tres caras */
export const FACE_SHARE: Record<Face, number> = { fuera: 0.4, dentro: 0.35, arriba: 0.25 };

export const GRID_W = 70;
export const GRID_H = 28;

export interface ToothBox {
  kind: ToothKind;
  /** Posición en la cara, de 0 a 1 */
  x0: number;
  x1: number;
}

/** Dientes que se ven en una cara: en «arriba» solo premolares y molares (las caras que mastican) */
export function teethFor(face: Face): ToothBox[] {
  const kinds = face === 'arriba' ? HALF_ARCH.filter((k) => k === 'premolar' || k === 'molar') : HALF_ARCH;
  const total = kinds.reduce((a, k) => a + WIDTH[k], 0);
  let x = 0;
  return kinds.map((kind) => {
    const w = WIDTH[kind] / total;
    const box = { kind, x0: x, x1: x + w };
    x += w;
    return box;
  });
}

export interface FaceState {
  face: Face;
  /** Placa por celda (0 limpio, 1 mucha), solo sobre diente */
  plaque: Float32Array;
  /** 1 si la celda es diente */
  tooth: Uint8Array;
  initial: number;
}

/** Zona de diente dentro de la cara (en altura): el resto es encía o lengua */
export const TOOTH_TOP = 0.18;
export const TOOTH_BOTTOM = 0.92;

/** Cara con su placa. Función pura con semilla. `upper`: la encía está arriba (dientes de arriba). */
export function makeFace(face: Face, seed: number, upper: boolean): FaceState {
  const rng = mulberry32(seed);
  const teeth = teethFor(face);
  const plaque = new Float32Array(GRID_W * GRID_H);
  const tooth = new Uint8Array(GRID_W * GRID_H);
  // manchas de placa al azar, además de la acumulación junto a la encía y entre dientes
  const spots = Array.from({ length: 7 }, () => ({ x: rng(), y: TOOTH_TOP + rng() * (TOOTH_BOTTOM - TOOTH_TOP), r: 0.05 + rng() * 0.08 }));
  let initial = 0;
  for (let gy = 0; gy < GRID_H; gy++) {
    const y = (gy + 0.5) / GRID_H;
    if (y < TOOTH_TOP || y > TOOTH_BOTTOM) continue;
    // distancia a la encía (0 junto a ella, 1 en el borde que muerde)
    const v = (y - TOOTH_TOP) / (TOOTH_BOTTOM - TOOTH_TOP);
    const fromGum = face === 'arriba' ? 0.5 : upper ? v : 1 - v;
    for (let gx = 0; gx < GRID_W; gx++) {
      const x = (gx + 0.5) / GRID_W;
      const t = teeth.find((b) => x >= b.x0 && x < b.x1);
      if (!t) continue;
      const edge = Math.min(x - t.x0, t.x1 - x) / (t.x1 - t.x0); // 0 en el borde entre dientes
      if (edge < 0.04) continue; // hueco entre dientes
      const i = gy * GRID_W + gx;
      tooth[i] = 1;
      let p = 0.04 + 0.8 * Math.exp(-fromGum * 4.5) + 0.4 * Math.exp(-edge * 12);
      if (face === 'arriba') p = 0.25 + 0.55 * Math.exp(-Math.abs(v - 0.5) * 6) * (0.6 + 0.4 * Math.sin(x * 60)); // surcos de las muelas
      for (const s of spots) if (Math.hypot(x - s.x, (y - s.y) * 2.5) < s.r) p += 0.5;
      p = Math.min(1, p * (0.75 + rng() * 0.5));
      plaque[i] = p;
      initial += p;
    }
  }
  return { face, plaque, tooth, initial };
}

export const cleanliness = (f: FaceState) => {
  let left = 0;
  for (let i = 0; i < f.plaque.length; i++) left += f.plaque[i];
  return f.initial > 0 ? 1 - left / f.initial : 1;
};

/**
 * Seguimiento del gesto: premia el vaivén corto (como recomiendan) y penaliza pasar deprisa.
 * Guarda la dirección anterior para detectar los cambios de sentido.
 */
export interface Stroke {
  lastX: number;
  lastY: number;
  dirX: number;
  dirY: number;
  /** Cambios de sentido recientes (decae con el tiempo) */
  wiggle: number;
  has: boolean;
}
export const newStroke = (): Stroke => ({ lastX: 0, lastY: 0, dirX: 0, dirY: 0, wiggle: 0, has: false });

export const BRUSH_W = 0.12; // ancho del cabezal en la cara (0..1)
export const BRUSH_H = 0.22;

/**
 * Mueve el cepillo a (x, y) en coordenadas de la cara (0..1). `dt` en segundos.
 * Devuelve cuánto ha limpiado y la calidad del gesto (0..1) para dar consejos.
 */
export function scrub(f: FaceState, s: Stroke, x: number, y: number, dt: number, tolerance = 1): { cleaned: number; quality: number; tooFast: boolean } {
  if (!s.has) {
    Object.assign(s, { lastX: x, lastY: y, has: true });
    return { cleaned: 0, quality: 0, tooFast: false };
  }
  const dx = x - s.lastX, dy = y - s.lastY;
  const dist = Math.hypot(dx, dy);
  s.lastX = x;
  s.lastY = y;
  s.wiggle *= Math.exp(-dt * 2.5);
  if (dist < 0.002) return { cleaned: 0, quality: Math.min(1, s.wiggle / 3), tooFast: false };
  const nx = dx / dist, ny = dy / dist;
  if (s.dirX * nx + s.dirY * ny < -0.3) s.wiggle = Math.min(6, s.wiggle + 1); // cambio de sentido: vaivén
  s.dirX = nx;
  s.dirY = ny;
  const speed = dist / Math.max(dt, 1 / 120); // caras por segundo
  const tooFast = speed > 3.2;
  const quality = Math.min(1, s.wiggle / 3) * (tooFast ? 0.35 : 1);
  // eficacia: algo siempre limpia; el vaivén corto limpia hasta 4 veces más
  const power = (0.18 + 0.82 * quality) * 2.2 * tolerance * Math.min(dist, 0.06) / 0.06;
  let cleaned = 0;
  const gx0 = Math.max(0, Math.floor((x - BRUSH_W / 2) * GRID_W));
  const gx1 = Math.min(GRID_W - 1, Math.floor((x + BRUSH_W / 2) * GRID_W));
  const gy0 = Math.max(0, Math.floor((y - BRUSH_H / 2) * GRID_H));
  const gy1 = Math.min(GRID_H - 1, Math.floor((y + BRUSH_H / 2) * GRID_H));
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const i = gy * GRID_W + gx;
      if (!f.tooth[i] || f.plaque[i] <= 0) continue;
      const before = f.plaque[i];
      f.plaque[i] = Math.max(0, before - power * 0.35);
      cleaned += before - f.plaque[i];
    }
  }
  return { cleaned, quality, tooFast };
}

// ── Pasta de dientes: del tamaño de un guisante ──
/** Cantidad de pasta (0..1) según el tiempo apretando el tubo */
export const pasteAmount = (seconds: number) => Math.min(1, seconds / 2.2);
export const PEA = { min: 0.2, max: 0.42 };
export type PasteVerdict = 'poca' | 'guisante' | 'mucha';
export const pasteVerdict = (a: number): PasteVerdict => (a < PEA.min ? 'poca' : a > PEA.max ? 'mucha' : 'guisante');

// ── Final: ¿qué haces después de cepillarte? ──
export const AFTER_OPTIONS = [
  { id: 'escupir', text: 'Escupir la espuma y no enjuagarme', correct: true },
  { id: 'enjuagar', text: 'Enjuagarme bien con mucha agua', correct: false },
  { id: 'tragar', text: 'Tragarme la pasta', correct: false },
] as const;

/** Puntos: limpieza de cada cara, la pasta justa y el final correcto */
export function brushScore(faces: number[], paste: PasteVerdict, afterOk: boolean): number {
  const clean = faces.reduce((a, c) => a + Math.max(0, c), 0);
  return Math.round(clean * 100 + (paste === 'guisante' ? 200 : 0) + (afterOk ? 150 : 0));
}

/** Fichas del Museo que se descubren según cómo ha ido */
export function brushCards(avgClean: number, paste: PasteVerdict, afterOk: boolean, quadrantsDone: number): string[] {
  const cards = ['placa'];
  if (paste === 'guisante') cards.push('pasta-guisante');
  if (afterOk) cards.push('escupir');
  if (quadrantsDone >= 4) cards.push('dos-minutos');
  if (avgClean >= 0.8) cards.push('caries');
  return cards;
}
