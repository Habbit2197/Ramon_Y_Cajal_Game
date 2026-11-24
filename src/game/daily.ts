/**
 * daily.ts — Desafío Diario determinista.
 *
 * La fecha local (AAAA-MM-DD) se convierte en una semilla; con ella se eligen el modo,
 * el escenario, el mapa y el modificador del día. Todos los jugadores que abran el juego
 * el mismo día reciben exactamente el mismo desafío. Sin red: solo matemáticas.
 */
import type { DailyModifier } from './difficulty';
import { mulberry32 } from '../engine/rng';

export { mulberry32 };

export type PlayId = 'story' | 'arcade' | 'maze' | 'micro' | 'build' | 'rhythm' | 'brush';
export const PLAY_IDS: PlayId[] = ['story', 'arcade', 'maze', 'micro', 'build', 'rhythm', 'brush'];

/** Hash FNV-1a de 32 bits: convierte «2026-11-24» en una semilla estable */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fecha local en formato AAAA-MM-DD (el día cambia a medianoche en el reloj del jugador) */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DailyChallenge {
  key: string;
  mode: PlayId;
  seed: number;
  /** Escenario del Modo Historia (0..2) */
  levelIndex: number;
  modifier: DailyModifier;
  /** Qué hay que conseguir para completarlo */
  goal: string;
}

const MODIFIERS: Record<PlayId, DailyModifier[]> = {
  story: ['clasico', 'veloces', 'fragil', 'contrarreloj'],
  arcade: ['clasico', 'veloces', 'fragil'],
  maze: ['clasico', 'veloces', 'fragil', 'contrarreloj'],
  micro: ['clasico', 'contrarreloj', 'fragil'],
  build: ['clasico', 'contrarreloj', 'fragil'],
  rhythm: ['clasico', 'contrarreloj', 'fragil'],
  brush: ['clasico', 'contrarreloj'],
};

export const DAILY_GOALS: Record<PlayId, string> = {
  story: 'Cruza el portal de Cajal.',
  arcade: 'Supera la región de la Corteza (5 oleadas).',
  maze: 'Activa la primera red del Laberinto.',
  micro: 'Descubre al menos 6 neuronas con la tinción.',
  build: 'Construye las tres neuronas del taller.',
  rhythm: 'Termina la canción con un 70 % de aciertos o más.',
  brush: 'Deja los dientes limpios al 80 % en los dos minutos.',
};

/** El desafío de un día. Función pura: misma fecha → mismo desafío. */
export function dailyChallenge(key: string = dateKey()): DailyChallenge {
  const seed = hashString(`cajal:${key}`);
  const rng = mulberry32(seed);
  // Los modos rotan sin repetirse dentro de cada bloque de días (uno por modo)
  const dayNumber = Math.floor(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000);
  const block = Math.floor(dayNumber / PLAY_IDS.length);
  const order = shuffle([...PLAY_IDS], mulberry32(hashString(`cajal-block:${block}`)));
  const mode = order[((dayNumber % PLAY_IDS.length) + PLAY_IDS.length) % PLAY_IDS.length];
  const mods = MODIFIERS[mode];
  const modifier = mods[Math.floor(rng() * mods.length)];
  const levelIndex = Math.floor(rng() * 3);
  return { key, mode, seed: (rng() * 2 ** 31) | 0, levelIndex, modifier, goal: DAILY_GOALS[mode] };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Días seguidos completados terminando en `today` (o ayer, si hoy aún no se ha jugado) */
export function dailyStreak(completed: string[], today: string = dateKey()): number {
  const set = new Set(completed);
  const d = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(dateKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
