/**
 * difficulty.ts — Tres niveles de dificultad y los modificadores del Desafío Diario.
 *
 * Todo son números puros: cada modo lee `activeParams()` al empezar una partida.
 * El nivel elegido se guarda por alias (useProfileStore) y se copia aquí con `setActiveDifficulty`.
 * El Desafío Diario usa siempre «Científico» más el modificador del día, para que sea igual para todos.
 */

export type Difficulty = 'explorador' | 'cientifico' | 'nobel';
export const DIFFICULTIES: Difficulty[] = ['explorador', 'cientifico', 'nobel'];

export type DailyModifier = 'clasico' | 'veloces' | 'fragil' | 'contrarreloj';

export interface DifficultyParams {
  /** Multiplicador de puntos para que la clasificación sea justa entre dificultades */
  scoreMult: number;
  story: {
    /** Velocidad de ataque de las toxinas */
    hazardSpeed: number;
    /** Cuánto potencial quita cada toxina (multiplica brainDelta negativo) */
    hazardDamage: number;
    /** Segundos para la tercera estrella */
    starSeconds: number;
    /** Corazones al empezar */
    vitality: number;
  };
  arcade: {
    enemySpeed: number;
    /** Presupuesto de cada oleada (cuántas toxinas salen) */
    waveBudget: number;
    /** Segundos de invulnerabilidad tras un golpe */
    invulnerable: number;
    /** Corazones de menos al empezar (Desafío «Frágil») */
    vitalityDelta: number;
  };
  maze: {
    ghostSpeed: number;
    /** Duración del BDNF */
    powerSeconds: number;
    lives: number;
  };
  /** Minijuegos del Laboratorio */
  lab: {
    /** Tiempo disponible */
    time: number;
    /** Tolerancia de los aciertos (ritmo) y ayudas visuales */
    tolerance: number;
  };
}

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; blurb: string }> = {
  explorador: { label: 'Explorador', blurb: 'Toxinas más lentas y más margen. Para empezar.' },
  cientifico: { label: 'Científico', blurb: 'El equilibrio con el que se diseñó el juego.' },
  nobel: { label: 'Nobel', blurb: 'Toxinas rápidas y poco margen. Más puntos.' },
};

const BASE: Record<Difficulty, DifficultyParams> = {
  explorador: {
    scoreMult: 0.75,
    story: { hazardSpeed: 0.72, hazardDamage: 0.6, starSeconds: 115, vitality: 3 },
    arcade: { enemySpeed: 0.8, waveBudget: 0.75, invulnerable: 2.3, vitalityDelta: 0 },
    maze: { ghostSpeed: 0.85, powerSeconds: 1.35, lives: 4 },
    lab: { time: 1.35, tolerance: 1.4 },
  },
  cientifico: {
    scoreMult: 1,
    story: { hazardSpeed: 1, hazardDamage: 1, starSeconds: 90, vitality: 3 },
    arcade: { enemySpeed: 1, waveBudget: 1, invulnerable: 1.6, vitalityDelta: 0 },
    maze: { ghostSpeed: 1, powerSeconds: 1, lives: 3 },
    lab: { time: 1, tolerance: 1 },
  },
  nobel: {
    scoreMult: 1.4,
    story: { hazardSpeed: 1.25, hazardDamage: 1.3, starSeconds: 72, vitality: 3 },
    arcade: { enemySpeed: 1.15, waveBudget: 1.3, invulnerable: 1.15, vitalityDelta: 0 },
    maze: { ghostSpeed: 1.08, powerSeconds: 0.75, lives: 3 },
    lab: { time: 0.8, tolerance: 0.75 },
  },
};

export const MODIFIER_INFO: Record<DailyModifier, { label: string; blurb: string }> = {
  clasico: { label: 'Clásico', blurb: 'Sin trucos: las reglas de siempre.' },
  veloces: { label: 'Toxinas veloces', blurb: 'Las toxinas van un 20 % más rápido. Puntos ×1,2.' },
  fragil: { label: 'Frágil', blurb: 'Empiezas con una vida menos. Puntos ×1,3.' },
  contrarreloj: { label: 'Contrarreloj', blurb: 'Menos tiempo en el laboratorio y estrellas más exigentes. Puntos ×1,25.' },
};

/** Parámetros para una dificultad, con el modificador del Desafío Diario si lo hay. Función pura. */
export function paramsFor(d: Difficulty, modifier: DailyModifier = 'clasico'): DifficultyParams {
  const b = BASE[d] ?? BASE.cientifico;
  const p: DifficultyParams = {
    scoreMult: b.scoreMult,
    story: { ...b.story },
    arcade: { ...b.arcade },
    maze: { ...b.maze },
    lab: { ...b.lab },
  };
  if (modifier === 'veloces') {
    p.scoreMult *= 1.2;
    p.story.hazardSpeed *= 1.2;
    p.arcade.enemySpeed *= 1.2;
    p.maze.ghostSpeed *= 1.1; // el Laberinto ya va al límite: algo menos
    p.lab.time *= 0.9;
  } else if (modifier === 'fragil') {
    p.scoreMult *= 1.3;
    p.story.vitality = Math.max(1, p.story.vitality - 1);
    p.arcade.vitalityDelta -= 1;
    p.maze.lives = Math.max(1, p.maze.lives - 1);
    p.lab.tolerance *= 0.85;
  } else if (modifier === 'contrarreloj') {
    p.scoreMult *= 1.25;
    p.story.starSeconds = Math.round(p.story.starSeconds * 0.8);
    p.maze.powerSeconds *= 0.85;
    p.lab.time *= 0.75;
  }
  return p;
}

// ── Dificultad activa (la lee la simulación al empezar cada partida) ──────
let active: { difficulty: Difficulty; modifier: DailyModifier } = { difficulty: 'cientifico', modifier: 'clasico' };

export function setActiveDifficulty(difficulty: Difficulty, modifier: DailyModifier = 'clasico') {
  active = { difficulty, modifier };
}
export function activeDifficulty() {
  return active;
}
export function activeParams(): DifficultyParams {
  return paramsFor(active.difficulty, active.modifier);
}

export const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as string[]).includes(v);
