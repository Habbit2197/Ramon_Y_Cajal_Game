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
  mazeGames: number;
  mazeBestLevel: number; // nivel máximo alcanzado en el Laberinto
  mazeStuns: number;
  mazeBestChain: number; // toxinas neutralizadas con un mismo BDNF
  mazeBestScore: number;
  arcadeBestEndless: number; // oleada máxima del modo infinito
  quizCorrect: number; // preguntas de Cajal acertadas
  discoveries: number; // fichas del Museo descubiertas
  labGames: number; // partidas en los minijuegos del Laboratorio
  microBestFound: number; // neuronas descubiertas en una partida del Microscopio
  buildCompleted: number; // talleres de Construye la neurona completados
  rhythmBestAccuracy: number; // mejor porcentaje de aciertos en Sinapsis rítmica
  dailyCompleted: number; // Desafíos Diarios completados
  dailyBestStreak: number; // racha más larga de días seguidos
  nobelWins: number; // victorias en dificultad Nobel
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
  mazeGames: 0,
  mazeBestLevel: 1,
  mazeStuns: 0,
  mazeBestChain: 0,
  mazeBestScore: 0,
  arcadeBestEndless: 0,
  quizCorrect: 0,
  discoveries: 0,
  labGames: 0,
  microBestFound: 0,
  buildCompleted: 0,
  rhythmBestAccuracy: 0,
  dailyCompleted: 0,
  dailyBestStreak: 0,
  nobelWins: 0,
};

export type TrophyGroup = 'general' | 'story' | 'arcade' | 'maze' | 'lab';

export interface TrophyDef {
  id: string;
  group: TrophyGroup;
  name: string;
  /** Cómo se consigue (se muestra también antes de desbloquearla) */
  how: string;
  /** Dato de neurociencia que se «descubre» al conseguirla */
  fact: string;
  check: (s: PlayerStats, stars: Record<number, number>, arcadeStars?: Record<number, number>) => boolean;
  /** Progreso 0..1 para mostrar barra en medallas acumulativas */
  progress?: (s: PlayerStats, stars: Record<number, number>, arcadeStars?: Record<number, number>) => number;
}

const ratio = (v: number, goal: number) => Math.max(0, Math.min(1, v / goal));
const starsTotal = (stars: Record<number, number>) => Object.values(stars).reduce((a, b) => a + b, 0);

export const TROPHIES: TrophyDef[] = [
  // ── Generales ───────────────────────────────────────────────────────────
  {
    id: 'primera-sinapsis', group: 'general', name: 'Primera sinapsis',
    how: 'Juega tu primera partida.',
    fact: 'Una sinapsis es el punto donde una neurona pasa su mensaje a otra. Cajal fue quien demostró que las neuronas son células separadas.',
    check: (s) => s.storyGames + s.arcadeGames + s.mazeGames + s.labGames >= 1,
  },
  {
    id: 'dos-mundos', group: 'general', name: 'Tres mundos',
    how: 'Juega al menos una partida en cada uno de los tres modos.',
    fact: 'Cajal dibujó a mano miles de neuronas mirando por su microscopio. Muchos de sus dibujos se siguen usando hoy en las clases.',
    check: (s) => s.storyGames >= 1 && s.arcadeGames >= 1 && s.mazeGames >= 1,
  },
  {
    id: 'constancia', group: 'general', name: 'Constancia',
    how: 'Juega 10 partidas.',
    fact: 'Practicar algo muchas veces refuerza las conexiones entre neuronas: por eso lo que repites se te da cada vez mejor.',
    check: (s) => s.storyGames + s.arcadeGames + s.mazeGames + s.labGames >= 10,
    progress: (s) => ratio(s.storyGames + s.arcadeGames + s.mazeGames + s.labGames, 10),
  },
  {
    id: 'podio', group: 'general', name: 'En el podio',
    how: 'Entra en el top 3 de cualquier clasificación.',
    fact: 'Cajal recibió el Premio Nobel de Medicina en 1906, compartido con Camillo Golgi, el inventor de la tinción que Cajal perfeccionó.',
    check: (s) => s.bestRank <= 3,
  },
  {
    id: 'curiosidad', group: 'general', name: 'Curiosidad científica',
    how: 'Acierta 10 preguntas de Cajal.',
    fact: 'Cajal escribió consejos para jóvenes investigadores: decía que la curiosidad y la paciencia valen más que el genio.',
    check: (s) => s.quizCorrect >= 10,
    progress: (s) => ratio(s.quizCorrect, 10),
  },
  {
    id: 'museo-15', group: 'general', name: 'Visitante del museo',
    how: 'Descubre 15 fichas del Museo.',
    fact: 'Muchos dibujos originales de Cajal se conservan en el Instituto Cajal de Madrid y se han expuesto en museos de todo el mundo.',
    check: (s) => s.discoveries >= 15,
    progress: (s) => ratio(s.discoveries, 15),
  },
  {
    id: 'museo-completo', group: 'general', name: 'Conservador del museo',
    how: 'Descubre las 33 fichas del Museo.',
    fact: 'La UNESCO incluyó el archivo de Cajal en el registro Memoria del Mundo en 2017.',
    check: (s) => s.discoveries >= 33,
    progress: (s) => ratio(s.discoveries, 33),
  },
  {
    id: 'desafio-diario', group: 'general', name: 'Cita diaria',
    how: 'Completa un Desafío Diario.',
    fact: 'Repasar un poco cada día ayuda a recordar mucho mejor que estudiarlo todo de golpe.',
    check: (s) => s.dailyCompleted >= 1,
  },
  {
    id: 'racha-3', group: 'general', name: 'Racha de neuronas',
    how: 'Completa el Desafío Diario tres días seguidos.',
    fact: 'Los hábitos se forman repitiendo: las conexiones que usas a diario se vuelven más fuertes.',
    check: (s) => s.dailyBestStreak >= 3,
    progress: (s) => ratio(s.dailyBestStreak, 3),
  },
  {
    id: 'premio-nobel', group: 'general', name: 'Premio Nobel',
    how: 'Gana una partida en dificultad Nobel.',
    fact: 'Cajal es, junto con Severo Ochoa, uno de los dos españoles que han ganado el Nobel de Medicina.',
    check: (s) => s.nobelWins >= 1,
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
  {
    id: 'regiones-perfectas', group: 'arcade', name: 'Cerebro en forma',
    how: 'Consigue las 9 estrellas del Arcade (3 por región).',
    fact: 'Cada región del cerebro se especializa en algo, pero todas trabajan conectadas: ninguna funciona sola.',
    check: (_s, _st, arcadeStars) => starsTotal(arcadeStars ?? {}) >= 9,
    progress: (_s, _st, arcadeStars) => ratio(starsTotal(arcadeStars ?? {}), 9),
  },
  {
    id: 'sin-fin', group: 'arcade', name: 'Sin fin',
    how: 'Llega a la oleada 10 del modo infinito.',
    fact: 'Las neuronas no se cansan de transmitir: algunas pueden enviar cientos de impulsos por segundo.',
    check: (s) => s.arcadeBestEndless >= 10,
    progress: (s) => ratio(s.arcadeBestEndless, 10),
  },

  // ── Modo Laberinto ──────────────────────────────────────────────────────
  {
    id: 'red-activada', group: 'maze', name: 'Red activada',
    how: 'Completa el nivel 1 del Laberinto.',
    fact: 'Cuando aprendes algo nuevo, se activan juntas redes de neuronas que antes apenas trabajaban en equipo.',
    check: (s) => s.mazeBestLevel >= 2,
  },
  {
    id: 'plasticidad', group: 'maze', name: 'Plasticidad',
    how: 'Llega al nivel 3 del Laberinto.',
    fact: 'En 1949, Donald Hebb propuso que las neuronas que se activan a la vez refuerzan su conexión: así aprendemos.',
    check: (s) => s.mazeBestLevel >= 3,
  },
  {
    id: 'cadena-bdnf', group: 'maze', name: 'Cadena de BDNF',
    how: 'Neutraliza 4 toxinas con un mismo BDNF.',
    fact: 'El BDNF ayuda a las neuronas a sobrevivir y a formar conexiones nuevas. Hacer ejercicio lo aumenta.',
    check: (s) => s.mazeBestChain >= 4,
  },
  {
    id: 'aturdidor', group: 'maze', name: 'Impulso certero',
    how: 'Aturde 25 toxinas disparando.',
    fact: 'Los neurotransmisores cruzan la sinapsis en milésimas de segundo para pasar el mensaje a la siguiente neurona.',
    check: (s) => s.mazeStuns >= 25,
    progress: (s) => ratio(s.mazeStuns, 25),
  },
  {
    id: 'insomnio-vencido', group: 'maze', name: 'Insomnio vencido',
    how: 'Consigue 10.000 puntos en el Laberinto.',
    fact: 'Dormir bien ayuda a consolidar lo aprendido: mientras duermes, el cerebro ordena los recuerdos del día.',
    check: (s) => s.mazeBestScore >= 10000,
    progress: (s) => ratio(s.mazeBestScore, 10000),
  },

  // ── Laboratorio ─────────────────────────────────────────────────────────
  {
    id: 'reaccion-negra', group: 'lab', name: 'Reacción negra',
    how: 'Descubre 6 neuronas en una partida del Microscopio.',
    fact: 'La tinción de Golgi solo tiñe un pequeño porcentaje de las neuronas, al azar. Por eso cada una se ve entera y nítida.',
    check: (s) => s.microBestFound >= 6,
    progress: (s) => ratio(s.microBestFound, 6),
  },
  {
    id: 'arquitecto', group: 'lab', name: 'Arquitecto neuronal',
    how: 'Completa el taller Construye la neurona.',
    fact: 'Cajal propuso que la señal viaja siempre en el mismo sentido: de las dendritas al soma y del soma al axón.',
    check: (s) => s.buildCompleted >= 1,
  },
  {
    id: 'ritmo-perfecto', group: 'lab', name: 'Ritmo sináptico',
    how: 'Termina Sinapsis rítmica con un 90 % de aciertos.',
    fact: 'Las neuronas del cerebro trabajan a ritmos distintos, y esas ondas se pueden medir con un electroencefalograma.',
    check: (s) => s.rhythmBestAccuracy >= 90,
    progress: (s) => ratio(s.rhythmBestAccuracy, 90),
  },
];

/** Devuelve los ids que se cumplen ahora y aún no estaban desbloqueados. */
export function newlyUnlocked(stats: PlayerStats, stars: Record<number, number>, unlocked: Record<string, string>, arcadeStars: Record<number, number> = {}): string[] {
  return TROPHIES.filter((t) => !unlocked[t.id] && t.check(stats, stars, arcadeStars)).map((t) => t.id);
}

// ── Estrellas por nivel del Modo Historia ─────────────────────────────────
export const STAR_RULES = {
  /** ★★: terminar con todos los corazones */
  fullHealth: true,
  /** ★★★: terminar en menos de estos segundos */
  fastSeconds: 90,
};

export function starsForWin(vitality: number, maxVitality: number, seconds: number, fastSeconds = STAR_RULES.fastSeconds): number {
  let stars = 1;
  if (vitality >= maxVitality) stars++;
  if (seconds < fastSeconds) stars++;
  return stars;
}

export function starRulesText(fastSeconds = STAR_RULES.fastSeconds): string[] {
  return ['Completa el nivel', 'Termina con todos los corazones', `Termina en menos de ${fastSeconds} segundos`];
}
