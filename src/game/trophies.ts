/**
 * trophies.ts — Medallas del Cuaderno de Cajal y estrellas del Modo Historia.
 *
 * Todo es función pura de las estadísticas del jugador: así se puede testear y
 * re-evaluar en cualquier momento sin depender de eventos sueltos.
 * Para afinar la dificultad, cambia solo las constantes de STAR_RULES y los umbrales.
 */

export interface PlayerStats {
  storyGames: number;
  arcadeGames: number;
  storyWins: number;
  /** Índices de nivel completados al menos una vez */
  levelsCompleted: number[];
  flawlessWins: number; // niveles completados sin tocar ninguna toxina
  fastestWin: number; // segundos (Infinity si ninguno)
  habitsCollected: number;
  arcadeBestRegion: number; // 0 Corteza, 1 Hipocampo, 2 Cerebelo
  arcadeBestWave: number; // oleada máxima alcanzada en Corteza (0..5) o más allá
  arcadeWins: number;
  arcadeBestLevel: number;
  totalKills: number;
  perfectDashes: number;
  tankSplits: number;
  evolutions: number;
  bestRank: number; // mejor puesto en cualquier clasificación (Infinity si nunca)
}

export const EMPTY_STATS: PlayerStats = {
  storyGames: 0,
  arcadeGames: 0,
  storyWins: 0,
  levelsCompleted: [],
  flawlessWins: 0,
  fastestWin: Infinity,
  habitsCollected: 0,
  arcadeBestRegion: 0,
  arcadeBestWave: 0,
  arcadeWins: 0,
  arcadeBestLevel: 1,
  totalKills: 0,
  perfectDashes: 0,
  tankSplits: 0,
  evolutions: 0,
  bestRank: Infinity,
};

export type TrophyGroup = 'general' | 'story' | 'arcade';

export interface TrophyDef {
  id: string;
  group: TrophyGroup;
  name: string;
  /** Cómo se consigue (se muestra también antes de desbloquearla) */
  how: string;
  /** Dato de neurociencia que se «descubre» al conseguirla */
  fact: string;
  check: (s: PlayerStats, stars: Record<number, number>) => boolean;
  /** Progreso 0..1 para mostrar barra en medallas acumulativas */
  progress?: (s: PlayerStats, stars: Record<number, number>) => number;
}

const ratio = (v: number, goal: number) => Math.max(0, Math.min(1, v / goal));
const starsTotal = (stars: Record<number, number>) => Object.values(stars).reduce((a, b) => a + b, 0);

export const TROPHIES: TrophyDef[] = [
  // ── Generales ───────────────────────────────────────────────────────────
  {
    id: 'primera-sinapsis', group: 'general', name: 'Primera sinapsis',
    how: 'Juega tu primera partida.',
    fact: 'Una sinapsis es el punto donde una neurona pasa su mensaje a otra. Cajal fue quien demostró que las neuronas son células separadas.',
    check: (s) => s.storyGames + s.arcadeGames >= 1,
  },
  {
    id: 'dos-mundos', group: 'general', name: 'Dos mundos',
    how: 'Juega al menos una partida en cada modo.',
    fact: 'Cajal dibujó a mano miles de neuronas mirando por su microscopio. Muchos de sus dibujos se siguen usando hoy en las clases.',
    check: (s) => s.storyGames >= 1 && s.arcadeGames >= 1,
  },
  {
    id: 'constancia', group: 'general', name: 'Constancia',
    how: 'Juega 10 partidas.',
    fact: 'Practicar algo muchas veces refuerza las conexiones entre neuronas: por eso lo que repites se te da cada vez mejor.',
    check: (s) => s.storyGames + s.arcadeGames >= 10,
    progress: (s) => ratio(s.storyGames + s.arcadeGames, 10),
  },
  {
    id: 'podio', group: 'general', name: 'En el podio',
    how: 'Entra en el top 3 de cualquier clasificación.',
    fact: 'Cajal recibió el Premio Nobel de Medicina en 1906, compartido con Camillo Golgi, el inventor de la tinción que Cajal perfeccionó.',
    check: (s) => s.bestRank <= 3,
  },

  // ── Modo Historia ───────────────────────────────────────────────────────
  {
    id: 'paseo-parque', group: 'story', name: 'Paseo por el parque',
    how: 'Completa el nivel 1: El Parque de las Dendritas.',
    fact: 'El ejercicio al aire libre aumenta el BDNF, una proteína que ayuda a crear nuevas conexiones neuronales.',
    check: (s) => s.levelsCompleted.includes(0),
  },
  {
    id: 'recreo-sano', group: 'story', name: 'Recreo sano',
    how: 'Completa el nivel 2: El Patio del Colegio.',
    fact: 'El hipocampo, clave para aprender y recordar, funciona mejor con comidas regulares y poco azúcar añadido.',
    check: (s) => s.levelsCompleted.includes(1),
  },
  {
    id: 'mente-lucida', group: 'story', name: 'Mente lúcida',
    how: 'Completa el nivel 3: La Fiesta de la Sinapsis.',
    fact: 'El cerebro sigue madurando hasta pasados los 20 años. Por eso el alcohol y el tabaco hacen más daño en la adolescencia.',
    check: (s) => s.levelsCompleted.includes(2),
  },
  {
    id: 'sin-un-rasguno', group: 'story', name: 'Sin un rasguño',
    how: 'Completa un nivel sin tocar ninguna toxina.',
    fact: 'El monóxido de carbono del humo del tabaco reduce el oxígeno que llega al cerebro.',
    check: (s) => s.flawlessWins >= 1,
  },
  {
    id: 'neurona-veloz', group: 'story', name: 'Neurona veloz',
    how: 'Completa un nivel en menos de 60 segundos.',
    fact: 'Algunos impulsos nerviosos viajan a más de 100 metros por segundo gracias a la mielina.',
    check: (s) => s.fastestWin < 60,
  },
  {
    id: 'coleccionista', group: 'story', name: 'Buenos hábitos',
    how: 'Recoge 50 hábitos sanos en total.',
    fact: 'Alrededor del 75 % del cerebro es agua: beber agua a lo largo del día ayuda a mantener la atención.',
    check: (s) => s.habitsCollected >= 50,
    progress: (s) => ratio(s.habitsCollected, 50),
  },
  {
    id: 'maestro-cajal', group: 'story', name: 'Discípulo de Cajal',
    how: 'Consigue las 9 estrellas del Modo Historia.',
    fact: '«Todo ser humano, si se lo propone, puede ser escultor de su propio cerebro.» Santiago Ramón y Cajal.',
    check: (_s, stars) => starsTotal(stars) >= 9,
    progress: (_s, stars) => ratio(starsTotal(stars), 9),
  },

  // ── Modo Arcade ─────────────────────────────────────────────────────────
  {
    id: 'primera-oleada', group: 'arcade', name: 'Primera oleada',
    how: 'Supera la primera oleada del Arcade.',
    fact: 'La corteza prefrontal, justo detrás de la frente, te ayuda a planificar y a controlar los impulsos.',
    check: (s) => s.arcadeBestWave >= 1 || s.arcadeBestRegion >= 1,
  },
  {
    id: 'hipocampo', group: 'arcade', name: 'Rumbo al hipocampo',
    how: 'Llega a la región del Hipocampo.',
    fact: 'El hipocampo tiene forma de caballito de mar, y de ahí viene su nombre.',
    check: (s) => s.arcadeBestRegion >= 1,
  },
  {
    id: 'cerebelo', group: 'arcade', name: 'Equilibrio',
    how: 'Llega a la región del Cerebelo.',
    fact: 'El cerebelo coordina el equilibrio y los movimientos. Es una de las zonas que el alcohol altera antes.',
    check: (s) => s.arcadeBestRegion >= 2,
  },
  {
    id: 'cerebro-protegido', group: 'arcade', name: 'Cerebro protegido',
    how: 'Supera las tres regiones del Arcade.',
    fact: 'El cerebro gasta alrededor del 20 % de la energía del cuerpo aunque solo pesa en torno a un 2 %.',
    check: (s) => s.arcadeWins >= 1,
  },
  {
    id: 'cazatoxinas', group: 'arcade', name: 'Cazatoxinas',
    how: 'Elimina 300 toxinas en total.',
    fact: 'La microglía son las células de limpieza del cerebro: retiran restos y defienden frente a amenazas.',
    check: (s) => s.totalKills >= 300,
    progress: (s) => ratio(s.totalKills, 300),
  },
  {
    id: 'reflejos', group: 'arcade', name: 'Reflejos de mielina',
    how: 'Haz 5 impulsos perfectos (esquiva justo antes del golpe).',
    fact: 'La mielina envuelve los axones como el aislante de un cable y hace que la señal salte de nodo en nodo.',
    check: (s) => s.perfectDashes >= 5,
    progress: (s) => ratio(s.perfectDashes, 5),
  },
  {
    id: 'etanol-diluido', group: 'arcade', name: 'Etanol diluido',
    how: 'Divide 15 toxinas de alcohol.',
    fact: 'El alcohol enlentece la comunicación entre neuronas: por eso reduce los reflejos y la coordinación.',
    check: (s) => s.tankSplits >= 15,
    progress: (s) => ratio(s.tankSplits, 15),
  },
  {
    id: 'evolucion', group: 'arcade', name: 'Evolución sináptica',
    how: 'Consigue una carta de evolución.',
    fact: 'La plasticidad cerebral permite que las conexiones se reorganicen con lo que aprendes a lo largo de la vida.',
    check: (s) => s.evolutions >= 1,
  },
  {
    id: 'nivel-10', group: 'arcade', name: 'Red frondosa',
    how: 'Alcanza el nivel 10 en una partida.',
    fact: 'Se calcula que el cerebro humano tiene unos 86.000 millones de neuronas.',
    check: (s) => s.arcadeBestLevel >= 10,
    progress: (s) => ratio(s.arcadeBestLevel, 10),
  },
];

/** Devuelve los ids que se cumplen ahora y aún no estaban desbloqueados. */
export function newlyUnlocked(stats: PlayerStats, stars: Record<number, number>, unlocked: Record<string, string>): string[] {
  return TROPHIES.filter((t) => !unlocked[t.id] && t.check(stats, stars)).map((t) => t.id);
}

// ── Estrellas por nivel del Modo Historia ─────────────────────────────────
export const STAR_RULES = {
  /** ★★: terminar con todos los corazones */
  fullHealth: true,
  /** ★★★: terminar en menos de estos segundos */
  fastSeconds: 90,
};

export function starsForWin(vitality: number, maxVitality: number, seconds: number): number {
  let stars = 1;
  if (vitality >= maxVitality) stars++;
  if (seconds < STAR_RULES.fastSeconds) stars++;
  return stars;
}

export function starRulesText(): string[] {
  return ['Completa el nivel', 'Termina con todos los corazones', `Termina en menos de ${STAR_RULES.fastSeconds} segundos`];
}
