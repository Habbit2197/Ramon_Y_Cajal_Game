/**
 * OnboardingModal.tsx — «Cómo se juega» de cada modo.
 * Aparece la primera vez que un alias entra en un modo y se puede repetir desde el menú o la pausa.
 * Los controles se adaptan a si el dispositivo es táctil o tiene teclado y ratón.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Droplet, Apple, Nut, BookOpen, Cloud, Candy, Wine, Heart, Star, Target, Zap, Sparkles, Crosshair, Waves, Trophy, Gamepad2, Moon, Network,
} from 'lucide-react';
import { MAZE_RULES } from '../../game/maze/sim';
import { ITEM_CATALOG } from '../../game/rules';
import { STAR_RULES } from '../../game/trophies';
import type { GameMode } from '../../store/useProfileStore';

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

interface Step {
  title: string;
  body: ReactNode;
}

function Row({ icon, color, title, children }: { icon: ReactNode; color: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: `${color}22`, color }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-white text-[0.95rem]">{title}</span>
        <span className="block text-sm text-[#c9c2b4] leading-snug">{children}</span>
      </span>
    </li>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 h-7 px-2 items-center justify-center rounded-md bg-white/10 border border-white/20 border-b-[3px] text-xs font-sans font-semibold text-white">
      {children}
    </kbd>
  );
}

const delta = (n: number) => (n > 0 ? `+${n} %` : `${n} %`);

function storySteps(touch: boolean): Step[] {
  const c = ITEM_CATALOG;
  return [
    {
      title: 'Tu misión',
      body: (
        <div className="flex flex-col gap-4">
          <p className="text-[#e9e3d6] leading-relaxed">
            Llena tu <strong className="text-[#ffd166]">Potencial Cerebral</strong> hasta el 100 % recogiendo hábitos sanos. Cuando
            llegues, el <strong className="text-[#ffd166]">portal de Cajal</strong> se abrirá al final del camino: crúzalo para completar el nivel.
          </p>
          <div aria-hidden className="rounded-xl bg-black/30 p-3">
            <div className="flex justify-between text-xs text-[#a9a293] mb-1.5"><span>Empiezas con poco</span><span>Portal abierto</span></div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-full origin-left bg-gradient-to-r from-[#8f5d22] via-[#e8b45a] to-[#ffd166] onb-fill" />
            </div>
          </div>
          <p className="text-sm text-[#c9c2b4]">Hay tres niveles: el parque, el patio del colegio y una fiesta. Cada uno es un poco más difícil.</p>
        </div>
      ),
    },
    {
      title: 'Hábitos que suman',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Droplet className="w-5 h-5" />} color="#7fb8ff" title={`Agua  ${delta(c.water.brainDelta)}`}>Te hidrata y te hace ir más rápido un rato.</Row>
          <Row icon={<Apple className="w-5 h-5" />} color="#ff8f8f" title={`Manzana  ${delta(c.apple.brainDelta)}`}>Además te devuelve un corazón.</Row>
          <Row icon={<Nut className="w-5 h-5" />} color="#d39a45" title={`Nueces  ${delta(c.walnut.brainDelta)}`}>Omega-3 para construir nuevas sinapsis.</Row>
          <Row icon={<BookOpen className="w-5 h-5" />} color="#ffd166" title={`Tratado de Histología  ${delta(c.science_book.brainDelta)}`}>El que más suma: aprender hace crecer tu cerebro. También te devuelve un corazón.</Row>
        </ul>
      ),
    },
    {
      title: 'Toxinas que restan',
      body: (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            <Row icon={<Cloud className="w-5 h-5" />} color="#b8b2c8" title={`Humo de tabaco  ${delta(c.tobacco_smoke.brainDelta)}`}>Te persigue. Si te alcanza, vas más lento.</Row>
            <Row icon={<Candy className="w-5 h-5" />} color="#ff9f5a" title={`Ultraprocesados  ${delta(c.junk_food.brainDelta)}`}>Embiste en línea recta. Te deja cansado y lento.</Row>
            <Row icon={<Wine className="w-5 h-5" />} color="#ff6f6f" title={`Alcohol  ${delta(c.alcohol_toxin.brainDelta)}`}>Da vueltas por el camino. Te marea: te cuesta frenar y girar.</Row>
          </ul>
          <p className="text-sm text-[#c9c2b4]">
            El anillo rojo en el suelo avisa de que una toxina va a moverse. Cada golpe te quita un corazón y, justo después, tienes un momento de invulnerabilidad.
          </p>
        </div>
      ),
    },
    {
      title: 'Controles',
      body: touch ? (
        <ul className="flex flex-col gap-3">
          <Row icon={<Gamepad2 className="w-5 h-5" />} color="#e8b45a" title="Flechas en pantalla">Mantén pulsada una flecha para moverte. Puedes pulsar dos a la vez para ir en diagonal.</Row>
          <Row icon={<Zap className="w-5 h-5" />} color="#ffd166" title="Botón Impulso">Un acelerón corto para esquivar toxinas. Necesita recargarse un segundo.</Row>
          <Row icon={<BookOpen className="w-5 h-5" />} color="#c9c2b4" title="Guía de Cajal">Abajo verás sus consejos. Puedes ocultarla con «Ocultar guía».</Row>
        </ul>
      ) : (
        <div className="flex flex-col gap-3 text-[#e9e3d6]">
          <div className="flex items-center gap-3"><span className="flex gap-1"><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></span> o flechas: moverte</div>
          <div className="flex items-center gap-3"><Key>Espacio</Key> impulso para esquivar</div>
          <div className="flex items-center gap-3"><Key>P</Key> o <Key>Esc</Key> pausa</div>
          <div className="flex items-center gap-3"><Key>R</Key> reiniciar el nivel</div>
          <div className="flex items-center gap-3"><Key>M</Key> silenciar</div>
        </div>
      ),
    },
    {
      title: 'Estrellas y medallas',
      body: (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            <Row icon={<Star className="w-5 h-5" />} color="#ffd166" title="Una estrella">Por completar el nivel.</Row>
            <Row icon={<Heart className="w-5 h-5" />} color="#ff8fb1" title="Dos estrellas">Si terminas con todos los corazones.</Row>
            <Row icon={<Sparkles className="w-5 h-5" />} color="#7bd389" title="Tres estrellas">{`Si además lo haces en menos de ${STAR_RULES.fastSeconds} segundos.`}</Row>
          </ul>
          <p className="text-sm text-[#c9c2b4]">
            Pierdes si te quedas sin corazones o tu potencial llega a 0. Cada logro te da medallas para el <strong className="text-white">Cuaderno de Cajal</strong>, con un dato curioso sobre el cerebro.
          </p>
        </div>
      ),
    },
  ];
}

function arcadeSteps(touch: boolean): Step[] {
  return [
    {
      title: 'Tu misión',
      body: (
        <div className="flex flex-col gap-4">
          <p className="text-[#e9e3d6] leading-relaxed">
            Estás dentro del cerebro. Protégelo de las toxinas durante <strong className="text-[#7ff3ff]">5 oleadas</strong> en cada una de sus tres regiones:
          </p>
          <ol className="grid grid-cols-3 gap-2 text-center text-sm">
            {['Corteza prefrontal', 'Hipocampo', 'Cerebelo'].map((r, i) => (
              <li key={r} className="rounded-xl bg-[#5ee6ff]/10 border border-[#5ee6ff]/25 px-2 py-3">
                <span className="block text-xs text-[#9fc6cf]">Región {i + 1}</span>
                <span className="text-white font-semibold">{r}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[#c9c2b4]">Cada toxina eliminada da puntos para la clasificación. Tienes 3 corazones.</p>
        </div>
      ),
    },
    {
      title: 'Disparas solo',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Crosshair className="w-5 h-5" />} color="#5ee6ff" title="Impulsos automáticos">
            {touch
              ? 'Tu núcleo dispara sin parar a la toxina más cercana. Tú solo tienes que moverte con el joystick.'
              : 'Tu núcleo dispara sin parar hacia donde apunta el ratón. Si no mueves el ratón, apunta solo a la toxina más cercana.'}
          </Row>
          <Row icon={<Gamepad2 className="w-5 h-5" />} color="#e8b45a" title={touch ? 'Joystick' : 'Moverte'}>
            {touch ? 'Arrastra el círculo de la izquierda para moverte.' : 'WASD o flechas.'}
          </Row>
        </ul>
      ),
    },
    {
      title: 'Impulso de mielina',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Zap className="w-5 h-5" />} color="#ffd166" title={touch ? 'Botón Impulso' : 'Espacio'}>
            Un acelerón durante el que nada te hace daño, como la mielina que protege los axones.
          </Row>
          <Row icon={<Sparkles className="w-5 h-5" />} color="#7ff3ff" title="Impulso perfecto">
            Si lo usas justo antes de que una toxina te toque, el tiempo se ralentiza y el impulso se recarga al momento.
          </Row>
          <Row icon={<Waves className="w-5 h-5" />} color="#5ee6ff" title={touch ? 'Botón Ola' : 'Tecla E: Ola de Potenciación'}>
            Cuando la barra «Ola» se llena, lánzala para golpear a todas las toxinas que tengas cerca.
          </Row>
        </ul>
      ),
    },
    {
      title: 'Neurotrofinas y mejoras',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Sparkles className="w-5 h-5" />} color="#ffd166" title="Orbes dorados">
            Las toxinas sueltan neurotrofinas al desaparecer. Acércate y vendrán hacia ti: llenan la barra de nivel y la Ola.
          </Row>
          <Row icon={<Target className="w-5 h-5" />} color="#7bd389" title="Subir de nivel">
            Cada vez que se llena la barra, la partida se para y eliges 1 de 3 mejoras. Al terminar una región, eliges una mejora rara.
          </Row>
          <Row icon={<Trophy className="w-5 h-5" />} color="#b49cff" title="Evoluciones">Si subes dos mejoras concretas al máximo, se fusionan en una evolución.</Row>
        </ul>
      ),
    },
    {
      title: 'Conoce a las toxinas',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Cloud className="w-5 h-5" />} color="#c9a8ff" title="Nicotina">Llegan en enjambre. Son pequeñas y frágiles, pero si te tocan vas más lento.</Row>
          <Row icon={<Wine className="w-5 h-5" />} color="#e8b45a" title="Etanol">Grande y lento. Al eliminarlo se divide en dos más pequeños. Te marea: cuesta frenar.</Row>
          <Row icon={<Candy className="w-5 h-5" />} color="#ff9f5a" title="Azúcar refinado">
            Te persigue muy rápido unos segundos y luego se agota y recibe el doble de daño. Si te toca, te cansas y disparas más despacio un rato.
          </Row>
        </ul>
      ),
    },
  ];
}

function mazeSteps(touch: boolean): Step[] {
  return [
    {
      title: 'Tu misión',
      body: (
        <div className="flex flex-col gap-4">
          <p className="text-[#e9e3d6] leading-relaxed">
            Eres un impulso nervioso que recorre una red de neuronas. Recoge todas las <strong className="text-[#ffd166]">vesículas doradas</strong> de los axones para
            <strong className="text-[#c9b8ff]"> activar la red</strong> y pasar al siguiente nivel.
          </p>
          <ul className="flex flex-col gap-3">
            <Row icon={<Network className="w-5 h-5" />} color="#7ff3ff" title="La red se enciende">Cada axón que limpias se ilumina. Cada nivel es una red nueva y más rápida.</Row>
            <Row icon={<Heart className="w-5 h-5" />} color="#ff8fb1" title={`${MAZE_RULES.lives} vidas`}>Si una toxina te toca, pierdes una. Ganas una extra cada 10.000 puntos.</Row>
          </ul>
          <p className="text-sm text-[#c9c2b4]">Es el modo más difícil: piensa la ruta antes de entrar en un pasillo.</p>
        </div>
      ),
    },
    {
      title: 'Moverte por los axones',
      body: touch ? (
        <ul className="flex flex-col gap-3">
          <Row icon={<Gamepad2 className="w-5 h-5" />} color="#b49cff" title="Desliza o usa la cruceta">Desliza el dedo hacia donde quieras ir. Puedes indicar el giro antes de llegar a la neurona: lo tomará en cuanto pueda.</Row>
          <Row icon={<Target className="w-5 h-5" />} color="#7ff3ff" title="Media vuelta">Puedes dar la vuelta en cualquier momento, también en mitad de un axón.</Row>
        </ul>
      ) : (
        <div className="flex flex-col gap-3 text-[#e9e3d6]">
          <div className="flex items-center gap-3"><span className="flex gap-1"><Key>↑</Key><Key>←</Key><Key>↓</Key><Key>→</Key></span> o <span className="flex gap-1"><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></span></div>
          <p className="text-sm text-[#c9c2b4]">Pulsa el giro antes de llegar a la neurona: lo tomará en cuanto pueda. Puedes dar media vuelta en cualquier momento.</p>
          <div className="flex items-center gap-3"><Key>Espacio</Key> disparar</div>
          <div className="flex items-center gap-3"><Key>P</Key> o <Key>Esc</Key> pausa</div>
        </div>
      ),
    },
    {
      title: 'Disparo de frente',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Crosshair className="w-5 h-5" />} color="#ffd166" title="Hacia donde apunta la flecha">El impulso viaja por el axón en línea recta hasta la siguiente curva. Si alcanza a una toxina, la deja aturdida unos segundos.</Row>
          <Row icon={<Zap className="w-5 h-5" />} color="#ffd166" title={`${MAZE_RULES.charges} cargas`}>Se recargan solas. Aturdir no elimina: la toxina vuelve a por ti, así que úsalo para escapar.</Row>
        </ul>
      ),
    },
    {
      title: 'El BDNF da la vuelta a la partida',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Sparkles className="w-5 h-5" />} color="#ffd166" title="Cuatro esferas doradas">Están en las esquinas. Al cogerlas, las toxinas se vuelven azules y huyen.</Row>
          <Row icon={<Target className="w-5 h-5" />} color="#7ff3ff" title="Neutralízalas">Tócalas mientras están azules: vuelven a la guarida. Cada una seguida vale el doble.</Row>
          <Row icon={<Crosshair className="w-5 h-5" />} color="#ffd166" title="Disparo en 4 direcciones">Mientras dura el BDNF, cada disparo sale hacia todos los caminos posibles.</Row>
        </ul>
      ),
    },
    {
      title: 'Conoce a las toxinas',
      body: (
        <ul className="flex flex-col gap-3">
          <Row icon={<Cloud className="w-5 h-5" />} color="#c3b4e6" title="Nicotina">Te persigue sin descanso, siempre por el camino más corto.</Row>
          <Row icon={<Candy className="w-5 h-5" />} color="#ff9f5a" title="Azúcar">Intenta cortarte el paso: va hacia donde estarás, no hacia donde estás.</Row>
          <Row icon={<Wine className="w-5 h-5" />} color="#ff6b6b" title="Alcohol">Va dando tumbos: a veces te persigue y a veces gira al azar.</Row>
          <Row icon={<Moon className="w-5 h-5" />} color="#6f8cff" title="Insomnio">Te ronda de lejos y, cuando se acerca, se aparta. Es el más difícil de prever.</Row>
        </ul>
      ),
    },
  ];
}

export function OnboardingModal({ mode, onDone }: { mode: GameMode; onDone: () => void }) {
  const [touch] = useState(isTouchDevice);
  const steps = mode === 'story' ? storySteps(touch) : mode === 'arcade' ? arcadeSteps(touch) : mazeSteps(touch);
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  const accent = mode === 'story' ? '#e8b45a' : mode === 'arcade' ? '#5ee6ff' : '#b49cff';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'Enter') { e.preventDefault(); last ? onDone() : setI((v) => v + 1); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
      else if (e.code === 'Escape') { e.preventDefault(); onDone(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onDone]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onb-title" className="fixed inset-0 z-50 bg-[#0b1220]/80 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl bg-[#121a2a]/95 border p-6 sm:p-7 flex flex-col gap-5" style={{ borderColor: `${accent}55` }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: accent }}>
              {{ story: 'Modo Historia', arcade: 'Modo Arcade', maze: 'Modo Laberinto' }[mode]}, paso {i + 1} de {steps.length}
            </span>
            <button type="button" onClick={onDone} className="text-sm text-[#a9a293] hover:text-white hover:underline cursor-pointer">
              Saltar
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="flex flex-col gap-4 min-h-[17rem]">
              <h2 id="onb-title" className="font-display text-3xl text-white">{steps[i].title}</h2>
              {steps[i].body}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {steps.map((_, k) => (
                <span key={k} className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 22 : 8, background: k <= i ? accent : 'rgb(255 255 255 / 0.15)' }} />
              ))}
            </div>
            <div className="flex gap-2">
              {i > 0 && (
                <button type="button" onClick={() => setI(i - 1)} className="h-11 px-4 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 cursor-pointer">
                  Atrás
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => (last ? onDone() : setI(i + 1))}
                className="h-11 px-5 rounded-xl font-semibold cursor-pointer"
                style={{ background: accent, color: { story: '#1a1206', arcade: '#03141a', maze: '#150a2e' }[mode] }}
              >
                {last ? '¡A jugar!' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
