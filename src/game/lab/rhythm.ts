/**
 * rhythm.ts — Minijuego «Sinapsis rítmica».
 *
 * Bajan vesículas por tres carriles (acetilcolina, dopamina y serotonina) hacia la
 * membrana de la otra neurona. Pulsar a tiempo suelta el mensajero y sube el potencial
 * de la neurona; al llegar al umbral, dispara (potencial de acción). Las notas de GABA
 * son frenos: si las pulsas, el potencial baja. Hay que dejarlas pasar.
 */
import { mulberry32 } from '../../engine/rng';

export type Lane = 0 | 1 | 2;
export const LANES = [
  { name: 'Acetilcolina', card: 'acetilcolina', color: '#7fb8ff', freq: 523.25 },
  { name: 'Dopamina', card: 'dopamina', color: '#ffd166', freq: 659.25 },
  { name: 'Serotonina', card: 'serotonina', color: '#c9a3ff', freq: 783.99 },
] as const;

export interface Note {
  t: number; // segundos desde el inicio
  lane: Lane;
  gaba: boolean;
  /** null: sin juzgar; 'perfect' | 'good' | 'miss' (vesícula); 'avoided' | 'tapped' (GABA) */
  result: null | 'perfect' | 'good' | 'miss' | 'avoided' | 'tapped';
}

export const RHYTHM_RULES = {
  bars: 24,
  beatsPerBar: 4,
  /** Ventanas de acierto en segundos (se multiplican por la tolerancia) */
  perfect: 0.06,
  good: 0.13,
  /** Potencial que suma cada acierto y que quita un GABA pulsado */
  gainPerfect: 13,
  gainGood: 8,
  gabaPenalty: 25,
  /** Pérdida de potencial por segundo (fuga de la membrana) */
  leak: 5,
  threshold: 100,
  fireBonus: 500,
  lead: 2, // segundos de espera antes de la primera nota
};

/** Partitura de una partida. Función pura: misma semilla, mismas notas. */
export function makeChart(seed: number, bpm: number): Note[] {
  const rng = mulberry32(seed);
  const beat = 60 / bpm;
  const R = RHYTHM_RULES;
  const notes: Note[] = [];
  let lastLane: Lane = 1;
  for (let bar = 0; bar < R.bars; bar++) {
    const section = bar < 8 ? 0 : bar < 16 ? 1 : 2;
    for (let b = 0; b < R.beatsPerBar; b++) {
      const subs = section === 0 ? [0] : section === 1 ? (rng() < 0.5 ? [0, 0.5] : [0]) : rng() < 0.7 ? [0, 0.5] : [0];
      for (const sub of subs) {
        if (section === 0 && b % 2 === 1 && rng() < 0.5) continue; // al principio, con calma
        // carriles con pocos saltos grandes, para que sea cómodo con tres dedos
        let lane = Math.floor(rng() * 3) as Lane;
        if (Math.abs(lane - lastLane) === 2 && rng() < 0.6) lane = 1;
        lastLane = lane;
        const gaba = bar >= 2 && rng() < (section === 0 ? 0.08 : 0.14);
        notes.push({ t: R.lead + (bar * R.beatsPerBar + b + sub) * beat, lane, gaba, result: null });
      }
    }
  }
  return notes;
}

export const songLength = (bpm: number) => RHYTHM_RULES.lead + (RHYTHM_RULES.bars * RHYTHM_RULES.beatsPerBar * 60) / bpm + 1.5;

export interface RhythmState {
  notes: Note[];
  potential: number;
  fires: number;
  combo: number;
  bestCombo: number;
  score: number;
  laneHits: [number, number, number];
  gabaAvoided: number;
  /** Último juicio para mostrar en pantalla */
  last: { kind: Note['result'] | 'fire'; at: number; lane: Lane } | null;
}

export const newRhythm = (notes: Note[]): RhythmState => ({
  notes,
  potential: 0,
  fires: 0,
  combo: 0,
  bestCombo: 0,
  score: 0,
  laneHits: [0, 0, 0],
  gabaAvoided: 0,
  last: null,
});

function addPotential(s: RhythmState, v: number, now: number, lane: Lane) {
  s.potential = Math.max(0, s.potential + v);
  if (s.potential >= RHYTHM_RULES.threshold) {
    s.potential = 0;
    s.fires++;
    s.score += RHYTHM_RULES.fireBonus;
    s.last = { kind: 'fire', at: now, lane };
    return true;
  }
  return false;
}

/** Pulsación en un carril en el instante `now`. Devuelve el juicio y si la neurona disparó. */
export function tap(s: RhythmState, lane: Lane, now: number, tolerance = 1): { result: Note['result'] | 'empty'; fired: boolean } {
  const R = RHYTHM_RULES;
  const win = R.good * tolerance;
  let best: Note | null = null;
  for (const n of s.notes) {
    if (n.result !== null || n.lane !== lane) continue;
    if (n.t - now > win) break; // las notas están ordenadas por tiempo
    if (Math.abs(n.t - now) <= win && (!best || Math.abs(n.t - now) < Math.abs(best.t - now))) best = n;
  }
  if (!best) return { result: 'empty', fired: false };
  if (best.gaba) {
    best.result = 'tapped';
    s.combo = 0;
    s.potential = Math.max(0, s.potential - R.gabaPenalty);
    s.last = { kind: 'tapped', at: now, lane };
    return { result: 'tapped', fired: false };
  }
  const perfect = Math.abs(best.t - now) <= R.perfect * tolerance;
  best.result = perfect ? 'perfect' : 'good';
  s.combo++;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.laneHits[lane]++;
  s.score += (perfect ? 100 : 60) + Math.min(s.combo, 30) * 2;
  s.last = { kind: best.result, at: now, lane };
  const fired = addPotential(s, perfect ? R.gainPerfect : R.gainGood, now, lane);
  return { result: best.result, fired };
}

/** Avanza el tiempo: fuga de potencial y notas que pasan sin pulsar */
export function advance(s: RhythmState, now: number, dt: number, tolerance = 1) {
  const R = RHYTHM_RULES;
  s.potential = Math.max(0, s.potential - R.leak * dt);
  const win = R.good * tolerance;
  for (const n of s.notes) {
    if (n.t > now) break;
    if (n.result !== null || now - n.t <= win) continue;
    if (n.gaba) {
      n.result = 'avoided';
      s.gabaAvoided++;
      s.score += 40;
    } else {
      n.result = 'miss';
      s.combo = 0;
      s.last = { kind: 'miss', at: now, lane: n.lane };
    }
  }
}

/** Porcentaje de aciertos: vesículas a tiempo (perfecto 1, bien 0,6) y frenos esquivados */
export function accuracy(s: RhythmState): number {
  const total = s.notes.length;
  if (!total) return 0;
  let pts = 0;
  for (const n of s.notes) {
    if (n.result === 'perfect' || n.result === 'avoided') pts += 1;
    else if (n.result === 'good') pts += 0.6;
  }
  return (pts / total) * 100;
}

/** Fichas que se descubren en la partida */
export function rhythmCards(s: RhythmState): string[] {
  const cards: string[] = [];
  s.laneHits.forEach((h, i) => { if (h >= 8) cards.push(LANES[i].card); });
  if (s.fires > 0) cards.push('umbral');
  if (s.gabaAvoided >= 5) cards.push('gaba');
  return cards;
}
