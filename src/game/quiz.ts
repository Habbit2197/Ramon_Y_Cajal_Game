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
  // ── La escuela de Cajal ──
  { id: 'q-golgi-persona', card: 'golgi-persona', q: '¿Con quién compartió Cajal el Premio Nobel?', options: ['Con Camillo Golgi', 'Con Albert Einstein', 'Con Marie Curie'], answer: 0, explain: 'Golgi era un médico italiano que inventó la tinción que Cajal perfeccionó.' },
  { id: 'q-sherrington', card: 'sherrington', q: '¿Quién inventó la palabra «sinapsis»?', options: ['Cajal', 'Charles Sherrington', 'Un poeta griego'], answer: 1, explain: 'El fisiólogo británico Sherrington la propuso en 1897 para el punto de contacto entre neuronas.' },
  { id: 'q-rio-hortega', card: 'rio-hortega', q: 'Pío del Río Hortega, discípulo de Cajal, describió la microglía. ¿Qué hace?', options: ['Limpia y defiende el cerebro', 'Produce lágrimas', 'Mueve los ojos'], answer: 0, explain: 'La microglía son las células de limpieza y defensa del sistema nervioso.' },
  { id: 'q-lorente', card: 'lorente-de-no', q: '¿Qué estudió Rafael Lorente de Nó, uno de los discípulos más jóvenes de Cajal?', options: ['Los volcanes', 'Cómo se conectan las neuronas de la corteza', 'Los dinosaurios'], answer: 1, explain: 'Describió los circuitos que forman las neuronas de la corteza cerebral.' },
  { id: 'q-castro', card: 'fernando-de-castro', q: 'Fernando de Castro descubrió unos sensores en el cuello. ¿Qué vigilan?', options: ['El oxígeno de la sangre', 'La música que oyes', 'El color del pelo'], answer: 0, explain: 'Detectan cuánto oxígeno lleva la sangre y avisan al cerebro para respirar más o menos.' },
  { id: 'q-instituto', card: 'instituto-cajal', q: '¿Dónde se guardan hoy muchos dibujos y microscopios de Cajal?', options: ['En el Instituto Cajal de Madrid', 'En la Luna', 'En un barco pirata'], answer: 0, explain: 'El Instituto Cajal, en Madrid, conserva gran parte de su legado.' },
  // ── Partes del cerebro ──
  { id: 'q-hemisferios', card: 'hemisferios', q: '¿Qué une los dos hemisferios del cerebro?', options: ['El cuerpo calloso', 'Un hueso', 'Nada, están separados'], answer: 0, explain: 'Es un gran puente de axones que permite que las dos mitades trabajen juntas.' },
  { id: 'q-prefrontal', card: 'prefrontal', q: '¿Qué zona del cerebro te ayuda a planificar y a frenar los impulsos?', options: ['La corteza prefrontal', 'El oído', 'La rodilla'], answer: 0, explain: 'Está detrás de la frente y es la última zona del cerebro en madurar.' },
  { id: 'q-hipocampo', card: 'hipocampo', q: 'El hipocampo tiene forma de…', options: ['Caballito de mar', 'Estrella', 'Plátano'], answer: 0, explain: 'Por eso se llama así. Es clave para guardar recuerdos nuevos.' },
  { id: 'q-amigdala', card: 'amigdala', q: '¿En qué participa la amígdala del cerebro?', options: ['En las emociones, como el miedo', 'En la digestión', 'En el crecimiento de las uñas'], answer: 0, explain: 'Tiene forma de almendra y te avisa de los peligros.' },
  { id: 'q-cerebelo', card: 'cerebelo', q: '¿Qué parte del cerebro te ayuda a mantener el equilibrio en la bici?', options: ['El cerebelo', 'La nariz', 'El estómago'], answer: 0, explain: 'El cerebelo coordina los movimientos y el equilibrio.' },
  { id: 'q-tronco', card: 'tronco', q: '¿Qué controla el tronco del encéfalo sin que tengas que pensarlo?', options: ['Respirar y el latido del corazón', 'Hacer los deberes', 'Elegir la ropa'], answer: 0, explain: 'Une el cerebro con la médula y se encarga de funciones automáticas.' },
  { id: 'q-medula', card: 'medula', q: '¿Dónde está la médula espinal?', options: ['Dentro de la columna vertebral', 'En la mano', 'En el pelo'], answer: 0, explain: 'Es la autopista de nervios que conecta el cerebro con el resto del cuerpo.' },
  // ── Más preguntas sobre lo que ya hay en el Museo ──
  { id: 'q-nobel-ano', card: 'cajal-nobel', q: '¿En qué año ganó Cajal el Premio Nobel?', options: ['En 1906', 'En 2006', 'En 1492'], answer: 0, explain: 'Fue en 1906, hace más de un siglo. Sus descubrimientos se siguen estudiando hoy.' },
  { id: 'q-cuba', card: 'cajal-microscopio', q: 'De joven, Cajal fue médico militar. ¿A dónde le enviaron?', options: ['A Cuba', 'A Japón', 'Al Polo Sur'], answer: 0, explain: 'Volvió enfermo de Cuba y, con lo que había ahorrado, se compró su primer microscopio.' },
  { id: 'q-dibujos', card: 'cajal-pintor', q: '¿Cómo mostraba Cajal lo que veía al microscopio?', options: ['Dibujándolo a mano', 'Con un móvil', 'Con una impresora 3D'], answer: 0, explain: 'Hizo miles de dibujos. Muchos se siguen usando en las clases de hoy.' },
  { id: 'q-neuronas-num', card: 'energia', q: '¿Cuántas neuronas tiene, más o menos, el cerebro humano?', options: ['Unas 100', 'Unos 86.000 millones', 'Exactamente 7'], answer: 1, explain: 'Son unos 86.000 millones, conectadas entre sí por billones de sinapsis.' },
  { id: 'q-pantallas', card: 'sueno', q: '¿Qué ayuda más a dormir bien?', options: ['Mirar el móvil en la cama', 'Apagar las pantallas un rato antes de dormir', 'Tomar un refresco con cafeína'], answer: 1, explain: 'La luz de las pantallas y la cafeína retrasan el sueño. Desconectar antes ayuda a descansar.' },
  { id: 'q-desayuno', card: 'agua', q: '¿Qué es mejor para estar atento en clase?', options: ['Saltarse el desayuno', 'Beber agua y comer de forma variada', 'Comer solo chucherías'], answer: 1, explain: 'El cerebro necesita agua y energía estable para concentrarse.' },
  { id: 'q-tabaco', card: 'adolescencia', q: '¿Por qué el tabaco es especialmente dañino para los jóvenes?', options: ['Porque el cerebro aún está madurando', 'Porque huele bien', 'No es dañino'], answer: 0, explain: 'La nicotina engancha muy rápido a un cerebro que todavía se está formando.' },
  { id: 'q-aprender', card: 'plasticidad', q: '¿Qué le pasa a tu cerebro cuando aprendes a tocar un instrumento?', options: ['Se crean y refuerzan conexiones', 'Se queda igual', 'Se encoge'], answer: 0, explain: 'Practicar cambia el cerebro: es la plasticidad neuronal.' },
  { id: 'q-deporte', card: 'ejercicio', q: '¿Qué le hace el deporte a tu cerebro?', options: ['Le ayuda a crear conexiones nuevas', 'Lo cansa para siempre', 'Nada'], answer: 0, explain: 'El ejercicio aumenta el BDNF y mejora la memoria y el ánimo.' },
  { id: 'q-reflejo', card: 'axon', q: 'Si tocas algo muy caliente, apartas la mano antes de pensarlo. ¿Por qué?', options: ['Por un reflejo de la médula espinal', 'Por suerte', 'Porque la mano piensa sola'], answer: 0, explain: 'Algunos reflejos se resuelven en la médula, sin esperar al cerebro: así son más rápidos.' },
  { id: 'q-glia', card: 'astrocito', q: '¿Hay en el cerebro células que no son neuronas?', options: ['Sí, las células gliales', 'No, solo hay neuronas', 'Solo hay huesos'], answer: 0, explain: 'Las células gliales, como los astrocitos, cuidan, alimentan y protegen a las neuronas.' },
  { id: 'q-alcohol-cerebelo', card: 'cerebelo', q: '¿Por qué el alcohol hace que alguien camine haciendo eses?', options: ['Altera el cerebelo, que controla el equilibrio', 'Porque los zapatos pesan más', 'Por el frío'], answer: 0, explain: 'El cerebelo es de las primeras zonas que el alcohol altera.' },
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
