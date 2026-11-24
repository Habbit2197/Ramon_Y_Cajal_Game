/**
 * quiz.ts — Preguntas de Cajal entre niveles.
 *
 * Al superar un nivel o una región aparece una pregunta con tres respuestas.
 * Acertar da una ayuda real para lo siguiente y desbloquea una ficha del Museo.
 * Acierte o falle, siempre se explica la respuesta en una o dos frases.
 */
import { shuffle } from './daily';
import { mulberry32 } from '../engine/rng';

export interface QuizQuestion {
  id: string;
  q: string;
  options: [string, string, string];
  /** Índice de la respuesta correcta en `options` */
  answer: 0 | 1 | 2;
  explain: string;
  /** Ficha del Museo que se desbloquea al acertar */
  card: string;
}

export const QUIZ: QuizQuestion[] = [
  { id: 'q-nace', card: 'cajal-petilla', q: '¿Dónde nació Santiago Ramón y Cajal?', options: ['En Petilla de Aragón (Navarra)', 'En Sevilla', 'En París'], answer: 0, explain: 'Nació en 1852 en Petilla de Aragón, un pequeño pueblo de Navarra.' },
  { id: 'q-pintor', card: 'cajal-pintor', q: 'De niño, ¿qué quería ser Cajal?', options: ['Futbolista', 'Pintor', 'Marinero'], answer: 1, explain: 'Soñaba con ser artista. Su talento para dibujar le sirvió para retratar neuronas con mucho detalle.' },
  { id: 'q-micro', card: 'cajal-microscopio', q: '¿Con qué instrumento estudiaba Cajal las neuronas?', options: ['Un telescopio', 'Un microscopio', 'Una lupa de bolsillo'], answer: 1, explain: 'Con el microscopio veía tejidos finísimos teñidos, y después los dibujaba a mano.' },
  { id: 'q-doctrina', card: 'cajal-doctrina', q: '¿Qué descubrió Cajal sobre el cerebro?', options: ['Que es una red continua, sin separaciones', 'Que está hecho de células separadas: las neuronas', 'Que está lleno de aire'], answer: 1, explain: 'Demostró que las neuronas son células independientes que se comunican en las sinapsis.' },
  { id: 'q-nobel', card: 'cajal-nobel', q: '¿Qué premio ganó Cajal en 1906?', options: ['El Premio Nobel de Medicina', 'Un Óscar', 'El Balón de Oro'], answer: 0, explain: 'Lo compartió con Camillo Golgi, el inventor de la tinción que Cajal perfeccionó.' },
  { id: 'q-mariposas', card: 'cajal-mariposas', q: 'Cajal llamaba a las neuronas…', options: ['«Ladrillos del cuerpo»', '«Mariposas misteriosas del alma»', '«Bichitos eléctricos»'], answer: 1, explain: 'Le parecían preciosas, como mariposas, cuando las veía teñidas en el microscopio.' },
  { id: 'q-foto', card: 'cajal-foto', q: 'Además de la ciencia, ¿qué afición tenía Cajal?', options: ['La fotografía', 'El patinaje', 'Los videojuegos'], answer: 0, explain: 'Fue un pionero de la fotografía en color en España y escribió un libro sobre ella.' },
  { id: 'q-sinapsis', card: 'sinapsis', q: '¿Qué es una sinapsis?', options: ['Un hueso de la cabeza', 'El punto donde una neurona pasa el mensaje a otra', 'Una vitamina'], answer: 1, explain: 'Entre las dos neuronas hay un hueco diminuto que cruzan los neurotransmisores.' },
  { id: 'q-espinas', card: 'espinas', q: 'Cajal vio unos pinchitos en las dendritas. ¿Cómo se llaman?', options: ['Espinas dendríticas', 'Púas neuronales', 'Pelos cerebrales'], answer: 0, explain: 'Las espinas reciben muchas sinapsis y cambian de forma cuando aprendemos algo.' },
  { id: 'q-dendritas', card: 'dendritas', q: '¿Qué parte de la neurona recibe los mensajes?', options: ['El axón', 'Las dendritas', 'La mielina'], answer: 1, explain: 'Las dendritas son como antenas ramificadas que reciben las señales de otras neuronas.' },
  { id: 'q-axon', card: 'axon', q: '¿Qué hace el axón?', options: ['Lleva la señal lejos del cuerpo de la neurona', 'Guarda los recuerdos', 'Produce sangre'], answer: 0, explain: 'Es el cable de salida. Algunos miden más de un metro.' },
  { id: 'q-mielina', card: 'mielina', q: '¿Para qué sirve la mielina?', options: ['Para que la señal vaya más rápido', 'Para dar color al pelo', 'Para digerir la comida'], answer: 0, explain: 'Envuelve el axón como el plástico de un cable y la señal salta de nodo en nodo.' },
  { id: 'q-soma', card: 'soma', q: '¿Dónde está el núcleo de la neurona?', options: ['En las dendritas', 'En el soma, el cuerpo de la neurona', 'En la sinapsis'], answer: 1, explain: 'El soma tiene el núcleo y suma los mensajes que llegan para decidir si dispara.' },
  { id: 'q-ejercicio', card: 'ejercicio', q: 'Hacer ejercicio aumenta una proteína que ayuda a las neuronas. ¿Cuál?', options: ['El BDNF', 'La gasolina', 'El azúcar'], answer: 0, explain: 'El BDNF ayuda a las neuronas a crecer y a formar conexiones nuevas.' },
  { id: 'q-sueno', card: 'sueno', q: '¿Qué hace el cerebro mientras duermes?', options: ['Se apaga del todo', 'Ordena lo aprendido y se limpia', 'Se hace más pequeño'], answer: 1, explain: 'Dormir ayuda a consolidar los recuerdos del día. Por eso dormir bien ayuda a estudiar.' },
  { id: 'q-agua', card: 'agua', q: '¿Qué bebida ayuda más a tu cerebro a lo largo del día?', options: ['Refrescos con azúcar', 'Agua', 'Bebidas energéticas'], answer: 1, explain: 'El cerebro tiene mucha agua; estar hidratado ayuda a la atención y a la memoria.' },
  { id: 'q-adolescencia', card: 'adolescencia', q: '¿Hasta qué edad sigue madurando el cerebro?', options: ['Hasta los 5 años', 'Hasta los 12 años', 'Hasta pasados los 20 años'], answer: 2, explain: 'Por eso el alcohol y el tabaco hacen más daño cuando eres joven.' },
  { id: 'q-plasticidad', card: 'plasticidad', q: '¿Qué pasa en tu cerebro cuando practicas algo muchas veces?', options: ['Las conexiones que usas se refuerzan', 'Se gastan las neuronas', 'Nada'], answer: 0, explain: 'Es la plasticidad: el cerebro cambia con lo que haces. Cajal decía que podemos esculpir nuestro cerebro.' },
  { id: 'q-energia', card: 'energia', q: 'El cerebro pesa un 2 % del cuerpo. ¿Cuánta energía gasta?', options: ['Casi nada', 'Alrededor del 20 %', 'La mitad'], answer: 1, explain: 'Es uno de los órganos que más energía consume: pensar cuesta.' },
  { id: 'q-golgi', card: 'golgi', q: '¿Qué tenía de especial la tinción de Golgi?', options: ['Teñía de negro solo unas pocas neuronas', 'Teñía todo de verde', 'Hacía brillar las neuronas en la oscuridad'], answer: 0, explain: 'Al teñir solo unas pocas, se veían enteras sin mezclarse. Cajal la mejoró.' },
  { id: 'q-purkinje', card: 'purkinje', q: '¿Dónde vive la célula de Purkinje, con forma de abanico?', options: ['En el cerebelo', 'En el corazón', 'En la piel'], answer: 0, explain: 'El cerebelo coordina los movimientos y el equilibrio.' },
  { id: 'q-piramidal', card: 'piramidal', q: '¿Qué forma tiene el cuerpo de una neurona piramidal?', options: ['Redonda', 'De triángulo', 'De cuadrado'], answer: 1, explain: 'Vive en la corteza cerebral y Cajal la llamaba «célula psíquica».' },
  { id: 'q-astrocito', card: 'astrocito', q: 'Los astrocitos tienen forma de estrella. ¿Qué hacen?', options: ['Cuidan y alimentan a las neuronas', 'Fabrican huesos', 'Ven la luz'], answer: 0, explain: 'Son células gliales: no transmiten mensajes como las neuronas, pero las ayudan.' },
  { id: 'q-acetilcolina', card: 'acetilcolina', q: '¿Qué neurotransmisor hace que se muevan tus músculos?', options: ['La acetilcolina', 'El oxígeno', 'La sal'], answer: 0, explain: 'Fue el primer neurotransmisor que se descubrió.' },
  { id: 'q-gaba', card: 'gaba', q: 'El GABA es como… del cerebro.', options: ['El acelerador', 'El freno', 'El volante'], answer: 1, explain: 'Calma a las neuronas para que no se disparen de más.' },
  { id: 'q-umbral', card: 'umbral', q: '¿Cuándo dispara una neurona?', options: ['Siempre, sin parar', 'Cuando recibe suficientes mensajes a la vez', 'Solo por la noche'], answer: 1, explain: 'Tiene que superar un umbral. Si no lo alcanza, no dispara: es todo o nada.' },
  { id: 'q-dopamina', card: 'dopamina', q: '¿En qué ayuda la dopamina?', options: ['En el movimiento y la motivación', 'En la digestión de la leche', 'En el color de los ojos'], answer: 0, explain: 'Te ayuda a querer conseguir cosas y a aprender de lo que sale bien.' },
  { id: 'q-serotonina', card: 'serotonina', q: 'La serotonina ayuda a regular…', options: ['El ánimo y el sueño', 'La altura', 'El color de la piel'], answer: 0, explain: 'Dormir bien y hacer ejercicio ayudan a que funcione mejor.' },
  { id: 'q-ranvier', card: 'ranvier', q: '¿Cómo viaja la señal por un axón con mielina?', options: ['Saltando de nodo en nodo', 'Muy despacio, a pie', 'Hacia atrás'], answer: 0, explain: 'Salta por los nodos de Ranvier, los huecos entre la mielina, y por eso va tan rápido.' },
  { id: 'q-terminal', card: 'terminal', q: '¿Qué guardan los botones terminales del axón?', options: ['Vesículas con neurotransmisores', 'Glóbulos rojos', 'Recuerdos en forma de foto'], answer: 0, explain: 'Al llegar la señal, liberan los neurotransmisores en la sinapsis.' },
];

export const QUIZ_BY_ID: Record<string, QuizQuestion> = Object.fromEntries(QUIZ.map((q) => [q.id, q]));

/** Ayuda que da acertar, según el modo */
export type QuizReward = 'shield' | 'heart' | 'bdnf' | 'points';

export const REWARD_TEXT: Record<QuizReward, string> = {
  shield: 'Empiezas la siguiente región con escudo glial y un corazón más.',
  heart: 'Una vida más para el siguiente nivel.',
  bdnf: 'Empiezas el siguiente nivel con BDNF.',
  points: '+15 % de puntos en este nivel.',
};

/**
 * Elige una pregunta: primero las que este alias aún no ha acertado, en orden aleatorio.
 * Con `rng` fijo (Desafío Diario) sale la misma para todos. Función pura.
 */
export function pickQuestion(answered: string[], rng: () => number = Math.random, exclude: string[] = []): QuizQuestion {
  const done = new Set(answered);
  const skip = new Set(exclude);
  const fresh = QUIZ.filter((q) => !done.has(q.id) && !skip.has(q.id));
  const pool = fresh.length > 0 ? fresh : QUIZ.filter((q) => !skip.has(q.id));
  const list = pool.length > 0 ? pool : QUIZ;
  return list[Math.floor(rng() * list.length)];
}

/** Opciones en orden aleatorio, recordando cuál es la correcta. Función pura. */
export function shuffledOptions(q: QuizQuestion, seed: number): { text: string; correct: boolean }[] {
  return shuffle(
    q.options.map((text, i) => ({ text, correct: i === q.answer })),
    mulberry32(seed),
  );
}

/** Puntos extra por acertar en el Modo Historia */
export const quizPointsBonus = (score: number) => Math.round(score * 0.15);
