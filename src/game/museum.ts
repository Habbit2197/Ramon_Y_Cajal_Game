/**
 * museum.ts — Museo de descubrimientos: fichas que se desbloquean jugando.
 *
 * Cada ficha dice cómo se descubre (pregunta de Cajal, minijuego o desafío) para que
 * los niños sepan dónde buscarla. Los textos son breves, en lenguaje claro y comprobados.
 */

export type MuseumRoom = 'cajal' | 'escuela' | 'neurona' | 'tipos' | 'quimica' | 'regiones' | 'cerebro';

export interface MuseumCard {
  id: string;
  room: MuseumRoom;
  title: string;
  text: string;
  /** Pista que se ve mientras está bloqueada */
  hint: string;
}

export const ROOMS: Record<MuseumRoom, { label: string; blurb: string }> = {
  cajal: { label: 'La vida de Cajal', blurb: 'Del pueblo navarro al Premio Nobel.' },
  escuela: { label: 'La escuela de Cajal', blurb: 'Sus discípulos y los científicos de su época.' },
  regiones: { label: 'Partes del cerebro', blurb: 'Cada zona tiene su trabajo, y todas colaboran.' },
  neurona: { label: 'Partes de la neurona', blurb: 'Cómo es por dentro la célula que piensa.' },
  tipos: { label: 'Tipos de neuronas', blurb: 'Las que Cajal dibujó con su microscopio.' },
  quimica: { label: 'Mensajeros químicos', blurb: 'Lo que cruza la sinapsis.' },
  cerebro: { label: 'Cerebro sano', blurb: 'Hábitos que ayudan a tus neuronas.' },
};

const Q = 'Acierta una pregunta de Cajal entre niveles.';
const MICRO = 'Descúbrela con la tinción del Microscopio.';
const BUILD = 'Colócala en el taller Construye la neurona.';
const RHYTHM = 'Lánzala en el minijuego Sinapsis rítmica.';

export const MUSEUM: MuseumCard[] = [
  // ── La vida de Cajal ──
  { id: 'cajal-petilla', room: 'cajal', title: 'Un niño de Petilla', hint: Q,
    text: 'Santiago Ramón y Cajal nació en 1852 en Petilla de Aragón, un pueblo de Navarra. De niño era travieso y le encantaba dibujar.' },
  { id: 'cajal-pintor', room: 'cajal', title: 'Quería ser pintor', hint: Q,
    text: 'Su padre, médico, quería que estudiara Medicina; él soñaba con ser artista. Acabó uniendo las dos cosas: dibujó miles de neuronas con una precisión asombrosa.' },
  { id: 'cajal-microscopio', room: 'cajal', title: 'Su primer microscopio', hint: Q,
    text: 'Tras volver enfermo de Cuba, donde fue médico militar, Cajal se compró un microscopio con lo que había ahorrado. Con él empezó a estudiar los tejidos del cuerpo.' },
  { id: 'cajal-doctrina', room: 'cajal', title: 'La doctrina de la neurona', hint: Q,
    text: 'Muchos científicos creían que el cerebro era una red continua, como una telaraña. Cajal demostró que está hecho de células separadas, las neuronas, que se tocan sin fundirse.' },
  { id: 'cajal-nobel', room: 'cajal', title: 'Premio Nobel de 1906', hint: Q,
    text: 'Cajal recibió el Premio Nobel de Medicina en 1906, compartido con el italiano Camillo Golgi. Curiosamente, los dos defendían ideas opuestas sobre cómo era el cerebro.' },
  { id: 'cajal-mariposas', room: 'cajal', title: 'Las mariposas del alma', hint: Q,
    text: 'Cajal llamaba a las neuronas «mariposas misteriosas del alma». Así de bonitas le parecían cuando las veía teñidas en su microscopio.' },
  { id: 'cajal-foto', room: 'cajal', title: 'Fotógrafo pionero', hint: Q,
    text: 'Además de científico, Cajal fue un gran aficionado a la fotografía. Experimentó con la fotografía en color y escribió un libro sobre cómo hacerla.' },

  // ── La escuela de Cajal ──
  { id: 'golgi-persona', room: 'escuela', title: 'Camillo Golgi', hint: Q,
    text: 'Médico italiano que en 1873 inventó la «reacción negra», la tinción que Cajal usó y mejoró. Compartieron el Premio Nobel de 1906.' },
  { id: 'sherrington', room: 'escuela', title: 'Charles Sherrington', hint: Q,
    text: 'Fisiólogo británico que en 1897 propuso la palabra «sinapsis» para el punto donde una neurona pasa el mensaje a otra.' },
  { id: 'rio-hortega', room: 'escuela', title: 'Pío del Río Hortega', hint: Q,
    text: 'Discípulo de Cajal. En 1919 describió la microglía, las células que limpian y defienden el cerebro.' },
  { id: 'lorente-de-no', room: 'escuela', title: 'Rafael Lorente de Nó', hint: Q,
    text: 'Uno de los discípulos más jóvenes de Cajal. Estudió cómo se conectan las neuronas de la corteza formando circuitos.' },
  { id: 'fernando-de-castro', room: 'escuela', title: 'Fernando de Castro', hint: Q,
    text: 'Discípulo de Cajal que descubrió unos sensores en el cuello que vigilan cuánto oxígeno lleva la sangre.' },
  { id: 'instituto-cajal', room: 'escuela', title: 'El Instituto Cajal', hint: Q,
    text: 'Centro de investigación de Madrid que lleva su nombre. Allí se guardan muchos de sus dibujos, preparaciones y microscopios.' },

  // ── Partes de la neurona ──
  { id: 'dendritas', room: 'neurona', title: 'Dendritas', hint: BUILD,
    text: 'Son las ramas de la neurona. Reciben los mensajes de otras neuronas, como antenas. Su nombre viene del griego «dendron», que significa árbol.' },
  { id: 'soma', room: 'neurona', title: 'Soma', hint: BUILD,
    text: 'Es el cuerpo de la neurona. Dentro está el núcleo, con las instrucciones de la célula. El soma suma los mensajes que llegan y decide si se dispara una señal.' },
  { id: 'axon', room: 'neurona', title: 'Axón', hint: BUILD,
    text: 'Es el cable que lleva la señal lejos del soma. Algunos axones, como los que van de la médula a los dedos del pie, miden más de un metro.' },
  { id: 'mielina', room: 'neurona', title: 'Mielina', hint: BUILD,
    text: 'Es una capa grasa que envuelve el axón, como el plástico de un cable. Gracias a ella la señal va mucho más rápido.' },
  { id: 'ranvier', room: 'neurona', title: 'Nodos de Ranvier', hint: BUILD,
    text: 'Son pequeños huecos entre los trozos de mielina. La señal salta de un nodo al siguiente, y por eso viaja tan deprisa.' },
  { id: 'terminal', room: 'neurona', title: 'Botones terminales', hint: BUILD,
    text: 'Están al final del axón. Guardan vesículas llenas de neurotransmisores, los mensajeros químicos que pasan la señal a la siguiente neurona.' },
  { id: 'sinapsis', room: 'neurona', title: 'Sinapsis', hint: Q,
    text: 'Es el punto de contacto entre dos neuronas. Hay un hueco diminuto, de unas veinte millonésimas de milímetro, que cruzan los neurotransmisores.' },
  { id: 'espinas', room: 'neurona', title: 'Espinas dendríticas', hint: Q,
    text: 'Cajal descubrió unos pinchitos en las dendritas: las espinas. Allí llegan muchas sinapsis, y cambian de forma cuando aprendemos.' },

  // ── Tipos de neuronas ──
  { id: 'piramidal', room: 'tipos', title: 'Neurona piramidal', hint: MICRO,
    text: 'Tiene el cuerpo en forma de triángulo y vive en la corteza cerebral. Cajal la llamaba «célula psíquica» porque creía que era clave para pensar.' },
  { id: 'purkinje', room: 'tipos', title: 'Célula de Purkinje', hint: MICRO,
    text: 'Vive en el cerebelo y tiene un árbol de dendritas enorme y plano, como un abanico. Ayuda a coordinar los movimientos y el equilibrio.' },
  { id: 'granulo', room: 'tipos', title: 'Célula granular', hint: MICRO,
    text: 'Es diminuta y está en el cerebelo. Es el tipo de neurona más abundante: hay muchísimas más que de cualquier otro.' },
  { id: 'estrellada', room: 'tipos', title: 'Neurona estrellada', hint: MICRO,
    text: 'Sus dendritas salen en todas direcciones, como los rayos de una estrella. Conecta neuronas cercanas dentro de la corteza.' },
  { id: 'astrocito', room: 'tipos', title: 'Astrocito', hint: MICRO,
    text: 'No es una neurona: es una célula glial con forma de estrella que cuida y alimenta a las neuronas. Cajal inventó un método especial para teñirlos.' },
  { id: 'golgi', room: 'tipos', title: 'La reacción negra', hint: MICRO,
    text: 'Golgi inventó una tinción que vuelve negras solo unas pocas neuronas al azar. Así se ven enteras, sin que se mezclen con las demás. Cajal la mejoró.' },

  // ── Mensajeros químicos ──
  { id: 'acetilcolina', room: 'quimica', title: 'Acetilcolina', hint: RHYTHM,
    text: 'Fue el primer neurotransmisor descubierto. Es el mensajero que hace que tus músculos se contraigan cuando decides moverte.' },
  { id: 'dopamina', room: 'quimica', title: 'Dopamina', hint: RHYTHM,
    text: 'Participa en el movimiento y en la motivación: te ayuda a querer conseguir cosas y a aprender de lo que sale bien.' },
  { id: 'serotonina', room: 'quimica', title: 'Serotonina', hint: RHYTHM,
    text: 'Ayuda a regular el estado de ánimo, el sueño y el apetito. Dormir bien y hacer ejercicio ayudan a que funcione mejor.' },
  { id: 'gaba', room: 'quimica', title: 'GABA', hint: RHYTHM,
    text: 'Es el freno del cerebro: calma a las neuronas para que no se disparen de más. Sin frenos, el cerebro no podría funcionar bien.' },
  { id: 'umbral', room: 'quimica', title: 'El umbral', hint: RHYTHM,
    text: 'Una neurona solo dispara si recibe suficientes mensajes a la vez. Si no llega al umbral, no pasa nada: es todo o nada.' },

  // ── Partes del cerebro ──
  { id: 'hemisferios', room: 'regiones', title: 'Dos hemisferios', hint: Q,
    text: 'El cerebro tiene dos mitades, los hemisferios, unidas por un gran puente de axones llamado cuerpo calloso.' },
  { id: 'prefrontal', room: 'regiones', title: 'Corteza prefrontal', hint: Q,
    text: 'Está justo detrás de la frente. Te ayuda a planificar, a concentrarte y a frenar los impulsos. Es la última zona en madurar.' },
  { id: 'hipocampo', room: 'regiones', title: 'Hipocampo', hint: Q,
    text: 'Tiene forma de caballito de mar y es clave para guardar recuerdos nuevos y orientarte en el espacio.' },
  { id: 'amigdala', room: 'regiones', title: 'Amígdala', hint: Q,
    text: 'Tiene forma de almendra y participa en las emociones, sobre todo en el miedo: te avisa de los peligros.' },
  { id: 'cerebelo', room: 'regiones', title: 'Cerebelo', hint: Q,
    text: 'Está en la parte de atrás y abajo. Coordina los movimientos y el equilibrio: gracias a él puedes ir en bici.' },
  { id: 'tronco', room: 'regiones', title: 'Tronco del encéfalo', hint: Q,
    text: 'Une el cerebro con la médula espinal y controla cosas automáticas como respirar o el latido del corazón.' },
  { id: 'medula', room: 'regiones', title: 'Médula espinal', hint: Q,
    text: 'Es la gran autopista de nervios que baja por dentro de la columna y lleva mensajes entre el cerebro y el cuerpo.' },

  // ── Cerebro sano ──
  { id: 'ejercicio', room: 'cerebro', title: 'Muévete', hint: Q,
    text: 'Hacer ejercicio aumenta el BDNF, una proteína que ayuda a las neuronas a crecer y a crear conexiones nuevas.' },
  { id: 'sueno', room: 'cerebro', title: 'Dormir para recordar', hint: Q,
    text: 'Mientras duermes, el cerebro ordena lo que has aprendido durante el día y se limpia de desechos. Por eso dormir bien ayuda a estudiar.' },
  { id: 'agua', room: 'cerebro', title: 'Agua para pensar', hint: Q,
    text: 'El cerebro tiene mucha agua. Estar bien hidratado ayuda a mantener la atención y la memoria.' },
  { id: 'adolescencia', room: 'cerebro', title: 'Un cerebro en obras', hint: Q,
    text: 'El cerebro sigue madurando hasta pasados los 20 años. Por eso el alcohol y el tabaco hacen más daño en la adolescencia.' },
  { id: 'plasticidad', room: 'cerebro', title: 'Escultor de tu cerebro', hint: Q,
    text: 'Cada vez que practicas algo, las conexiones que usas se refuerzan. Cajal decía que cada persona puede ser escultora de su propio cerebro.' },
  { id: 'energia', room: 'cerebro', title: 'Un órgano muy gastón', hint: Q,
    text: 'El cerebro pesa solo un 2 % del cuerpo, pero gasta alrededor del 20 % de su energía.' },
  { id: 'diario', room: 'cerebro', title: 'Constancia de científico', hint: 'Completa un Desafío Diario.',
    text: 'Cajal trabajaba cada día en su laboratorio. La constancia, más que el talento, fue el secreto de sus descubrimientos.' },
];

export const MUSEUM_BY_ID: Record<string, MuseumCard> = Object.fromEntries(MUSEUM.map((c) => [c.id, c]));
