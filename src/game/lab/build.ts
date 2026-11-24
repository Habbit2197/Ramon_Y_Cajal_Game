/**
 * build.ts — Minijuego «Construye la neurona».
 *
 * Tres talleres: la neurona, la neurona rápida (mielina) y la sinapsis. Cada hueco del
 * dibujo tiene una pista sobre su función; el jugador coloca la pieza que corresponde.
 * Hay una pieza intrusa en cada taller que no forma parte de lo que se construye.
 */

export interface BuildPart {
  id: string;
  label: string;
  /** Ficha del Museo que se desbloquea al colocarla bien (si la hay) */
  card?: string;
}

export interface BuildSlot {
  /** Pieza que va en el hueco */
  part: string;
  /** Pista: qué hace esa parte */
  clue: string;
  /** Zona del hueco en el dibujo (viewBox 0 0 480 300) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hueco dentro de otro: se activa cuando el de fuera ya está colocado */
  after?: string;
}

export interface BuildLevel {
  id: string;
  title: string;
  intro: string;
  slots: BuildSlot[];
  /** Pieza intrusa */
  intruder: BuildPart;
  /** Qué se ve al enviar el impulso */
  impulse: string;
}

export const PARTS: Record<string, BuildPart> = {
  dendritas: { id: 'dendritas', label: 'Dendritas', card: 'dendritas' },
  soma: { id: 'soma', label: 'Soma', card: 'soma' },
  nucleo: { id: 'nucleo', label: 'Núcleo' },
  axon: { id: 'axon', label: 'Axón', card: 'axon' },
  terminales: { id: 'terminales', label: 'Botones terminales', card: 'terminal' },
  mielina: { id: 'mielina', label: 'Mielina', card: 'mielina' },
  ranvier: { id: 'ranvier', label: 'Nodo de Ranvier', card: 'ranvier' },
  vesiculas: { id: 'vesiculas', label: 'Vesículas' },
  hendidura: { id: 'hendidura', label: 'Hendidura sináptica', card: 'sinapsis' },
  receptores: { id: 'receptores', label: 'Receptores' },
  postsinaptica: { id: 'postsinaptica', label: 'Dendrita de la otra neurona' },
};

export const BUILD_LEVELS: BuildLevel[] = [
  {
    id: 'neurona',
    title: 'La neurona',
    intro: 'Monta una neurona: cada hueco te dice qué hace la pieza que falta.',
    slots: [
      { part: 'dendritas', clue: 'Ramas que reciben los mensajes de otras neuronas.', x: 18, y: 78, w: 112, h: 144 },
      { part: 'soma', clue: 'El cuerpo de la célula: suma los mensajes que llegan.', x: 134, y: 112, w: 82, h: 76 },
      { part: 'nucleo', clue: 'Dentro del cuerpo: guarda las instrucciones de la célula.', x: 158, y: 136, w: 34, h: 28, after: 'soma' },
      { part: 'axon', clue: 'El cable largo que lleva la señal lejos del cuerpo.', x: 222, y: 136, w: 170, h: 28 },
      { part: 'terminales', clue: 'Al final del cable: pasan el mensaje a la siguiente neurona.', x: 396, y: 96, w: 72, h: 108 },
    ],
    intruder: { id: 'globulo', label: 'Glóbulo rojo' },
    impulse: 'La señal entra por las dendritas, se suma en el soma y viaja por el axón hasta los botones terminales. Siempre en ese sentido, como descubrió Cajal.',
  },
  {
    id: 'rapida',
    title: 'La neurona rápida',
    intro: 'Ahora haz que la señal vaya deprisa. Fíjate bien en el axón.',
    slots: [
      { part: 'axon', clue: 'El cable que sale del cuerpo de la neurona.', x: 214, y: 136, w: 68, h: 28 },
      { part: 'mielina', clue: 'Capa grasa que envuelve el cable, como el plástico de un enchufe.', x: 286, y: 128, w: 54, h: 44 },
      { part: 'ranvier', clue: 'Pequeño hueco sin envoltura: la señal salta de uno a otro.', x: 341, y: 128, w: 20, h: 44 },
      { part: 'terminales', clue: 'Donde termina el cable y se suelta el mensaje químico.', x: 396, y: 96, w: 72, h: 108 },
    ],
    intruder: { id: 'hueso', label: 'Trozo de hueso' },
    impulse: 'Con mielina, la señal salta de nodo en nodo y llega muchísimo antes. Sin ella iría paso a paso, mucho más despacio.',
  },
  {
    id: 'sinapsis',
    title: 'La sinapsis',
    intro: 'Mira de cerca el final del axón: así pasa el mensaje de una neurona a otra.',
    slots: [
      { part: 'terminales', clue: 'El final del axón de la primera neurona.', x: 150, y: 16, w: 180, h: 64 },
      { part: 'vesiculas', clue: 'Bolsitas llenas de mensajeros químicos.', x: 186, y: 84, w: 108, h: 40, after: 'terminales' },
      { part: 'hendidura', clue: 'Hueco diminuto entre las dos neuronas: no se tocan.', x: 120, y: 140, w: 240, h: 22 },
      { part: 'receptores', clue: 'Cerraduras donde encajan los mensajeros.', x: 150, y: 168, w: 180, h: 26 },
      { part: 'postsinaptica', clue: 'La parte de la segunda neurona que recibe el mensaje.', x: 120, y: 200, w: 240, h: 84 },
    ],
    intruder: { id: 'pelo', label: 'Pelo' },
    impulse: 'Al llegar la señal, las vesículas sueltan neurotransmisores. Cruzan la hendidura, encajan en los receptores y la segunda neurona recibe el mensaje.',
  },
];

export const LEVEL_SECONDS = 45;

export interface BuildState {
  level: number;
  placed: Record<string, boolean>;
  mistakes: number;
}

export const newBuildState = (level: number): BuildState => ({ level, placed: {}, mistakes: 0 });

/** Intenta colocar una pieza en el hueco de `slotPart`. Devuelve si era la correcta. */
export function placePart(s: BuildState, partId: string, slotPart: string): boolean {
  if (s.placed[slotPart]) return false;
  const slot = BUILD_LEVELS[s.level].slots.find((x) => x.part === slotPart);
  if (slot?.after && !s.placed[slot.after]) return false; // aún no está disponible
  if (partId === slotPart) {
    s.placed[slotPart] = true;
    return true;
  }
  s.mistakes++;
  return false;
}

export const levelComplete = (s: BuildState) => BUILD_LEVELS[s.level].slots.every((sl) => s.placed[sl.part]);

/** Puntos del taller: base, menos fallos, más tiempo sobrante. Nunca menos de 150. */
export function levelScore(mistakes: number, secondsLeft: number, penalty = 120): number {
  return Math.max(150, 600 - mistakes * penalty + Math.max(0, Math.round(secondsLeft)) * 8);
}

/** Mensaje al equivocarse: explica por qué no encaja */
export function wrongMessage(levelIdx: number, partId: string, slotPart: string): string {
  const lvl = BUILD_LEVELS[levelIdx];
  if (partId === lvl.intruder.id) return `${lvl.intruder.label}: eso no forma parte de ${levelIdx === 2 ? 'una sinapsis' : 'una neurona'}.`;
  const slot = lvl.slots.find((s) => s.part === slotPart);
  return `Ahí no va ${PARTS[partId]?.label.toLowerCase() ?? 'esa pieza'}. Pista: ${slot?.clue.charAt(0).toLowerCase()}${slot?.clue.slice(1)}`;
}
