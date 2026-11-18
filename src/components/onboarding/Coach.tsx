/**
 * Coach.tsx — Tutorial interactivo dentro de la partida.
 * Muestra una acción cada vez y avanza cuando el jugador la ha hecho de verdad.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { HudSnapshot } from '../Canvas3D';
import { world } from '../../engine/world';
import { useRunStore } from '../../store/useRunStore';
import { isTouchDevice } from './OnboardingModal';
import type { MazeState } from '../../game/maze/sim';

interface CoachStep {
  text: string;
  /** Devuelve true cuando el jugador ha completado el paso */
  done: () => boolean;
  /** Si no se completa, pasa solo tras estos segundos (pasos informativos) */
  autoAdvance?: number;
}

function Coach({ steps, accent, paused, onFinish, placement = 'top' }: { steps: CoachStep[]; accent: string; paused: () => boolean; onFinish: () => void; placement?: 'top' | 'bottom' | 'top-low' }) {
  const [i, setI] = useState(0);
  const [ticked, setTicked] = useState(false);
  const shownAt = useRef(performance.now());
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    shownAt.current = performance.now();
    setTicked(false);
  }, [i]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (paused() || ticked) return;
      const step = stepsRef.current[i];
      if (!step) return;
      const elapsed = (performance.now() - shownAt.current) / 1000;
      if (step.done() || (step.autoAdvance && elapsed > step.autoAdvance)) {
        setTicked(true);
        window.setTimeout(() => {
          if (i + 1 >= stepsRef.current.length) onFinish();
          else setI(i + 1);
        }, 900);
      }
    }, 200);
    return () => window.clearInterval(t);
  }, [i, ticked, paused, onFinish]);

  const step = steps[i];
  if (!step) return null;

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-[35] w-[min(92vw,30rem)] pointer-events-none ${placement === 'top' ? 'top-20 sm:top-24' : placement === 'top-low' ? 'top-[10.5rem] sm:top-20 sm:left-auto sm:right-6 sm:translate-x-0 sm:w-[26rem]' : 'top-[13.5rem] sm:top-auto sm:bottom-[6.5rem]'}`} aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto rounded-2xl px-4 py-3 bg-[#0b1220]/90 backdrop-blur-md border flex items-center gap-3"
          style={{ borderColor: `${accent}66` }}
        >
          <span
            className="w-7 h-7 rounded-full shrink-0 inline-flex items-center justify-center text-xs font-semibold transition-colors"
            style={{ background: ticked ? '#7bd389' : `${accent}26`, color: ticked ? '#06210c' : accent }}
          >
            {ticked ? <Check className="w-4 h-4" aria-label="Hecho" /> : i + 1}
          </span>
          <span className="text-sm text-white leading-snug flex-1">{step.text}</span>
          <button type="button" onClick={onFinish} className="text-xs text-[#a9a293] hover:text-white hover:underline cursor-pointer shrink-0">
            Saltar guía
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function StoryCoach({ hud, active, onFinish }: { hud: HudSnapshot; active: boolean; onFinish: () => void }) {
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const ranOnce = useRef(false);
  const dashedOnce = useRef(false);
  const touch = isTouchDevice();
  const startHabits = useRef(hud.synapsesCollected);

  const steps: CoachStep[] = [
    {
      text: touch ? 'Mantén pulsada una flecha de la pantalla para avanzar por el camino.' : 'Muévete con W A S D o las flechas del teclado.',
      done: () => (ranOnce.current ||= hudRef.current.animState === 'Run'),
    },
    {
      text: 'Recoge un hábito sano: agua, fruta, nueces o el libro de Cajal.',
      done: () => hudRef.current.synapsesCollected > startHabits.current,
    },
    {
      text: touch ? 'Pulsa «Impulso» para dar un acelerón y esquivar.' : 'Pulsa Espacio para dar un impulso y esquivar.',
      done: () => (dashedOnce.current ||= !hudRef.current.dashReady),
    },
    {
      text: 'Esquiva el humo, los ultraprocesados y el alcohol. Sigue recogiendo hasta llegar al 100 %.',
      done: () => hudRef.current.portalUnlocked,
    },
    {
      text: '¡El portal está abierto! Ve hasta el final del camino y crúzalo.',
      done: () => false,
      autoAdvance: 8,
    },
  ];

  if (!active) return null;
  return <Coach steps={steps} accent="#e8b45a" paused={() => false} onFinish={onFinish} placement="bottom" />;
}

export function ArcadeCoach({ active, onFinish }: { active: boolean; onFinish: () => void }) {
  const touch = isTouchDevice();
  const sawFullUlt = useRef(false);


  const steps: CoachStep[] = [
    {
      text: touch ? 'Arrastra el joystick de la izquierda para moverte.' : 'Muévete con W A S D o las flechas.',
      done: () => Math.hypot(world.player.vx, world.player.vz) > 1.5,
    },
    {
      text: touch
        ? 'Disparas solo hacia la toxina más cercana. Acércate lo justo y elimina tres.'
        : 'Disparas solo. Mueve el ratón para apuntar y elimina tres toxinas.',
      done: () => world.kills >= 3, // world.kills se reinicia en cada partida
    },
    {
      text: touch ? 'Pulsa «Impulso» para esquivar: durante el acelerón nada te hace daño.' : 'Pulsa Espacio para esquivar: durante el impulso nada te hace daño.',
      done: () => world.dashes >= 1,
    },
    {
      text: 'Pasa cerca de los orbes dorados para recogerlos. Al llenar la barra de nivel elegirás una mejora.',
      done: () => {
        const s = useRunStore.getState();
        return s.xp > 0 || s.level > 1;
      },
    },
    {
      text: touch ? 'Cuando la barra «Ola» brille, pulsa el botón Ola.' : 'Cuando la barra «Ola» brille, pulsa E para lanzar la Ola de Potenciación.',
      done: () => {
        if (world.player.ultCharge >= 100) sawFullUlt.current = true;
        return sawFullUlt.current && world.player.ultCharge < 100;
      },
      autoAdvance: 25,
    },
    {
      text: '¡Lo tienes! Sobrevive a las 5 oleadas de cada región.',
      done: () => false,
      autoAdvance: 4,
    },
  ];

  if (!active) return null;
  return <Coach steps={steps} accent="#5ee6ff" paused={() => useRunStore.getState().phase !== 'playing'} onFinish={onFinish} />;
}

export function MazeCoach({ active, state, onFinish }: { active: boolean; state: React.MutableRefObject<MazeState>; onFinish: () => void }) {
  const touch = isTouchDevice();
  const startLeft = useRef<number | null>(null);
  const sawPower = useRef(false);

  const steps: CoachStep[] = [
    {
      text: touch ? 'Desliza el dedo (o usa la cruceta) para elegir camino.' : 'Usa las flechas o W A S D. Puedes pulsar el giro antes de llegar a la neurona.',
      done: () => {
        const s = state.current;
        startLeft.current ??= s.pelletsLeft;
        return s.phase === 'playing' && s.pelletsLeft <= startLeft.current - 6;
      },
    },
    {
      text: touch ? 'Pulsa «Disparar»: el impulso sale hacia donde apunta la flecha y aturde a las toxinas.' : 'Pulsa Espacio: el impulso sale hacia donde apunta la flecha y aturde a las toxinas.',
      done: () => state.current.charges < 3 || state.current.stuns > 0,
    },
    {
      text: 'Tienes 3 cargas y se recargan solas. Dispara solo cuando una toxina venga de frente.',
      done: () => false,
      autoAdvance: 6,
    },
    {
      text: 'Ve a por un BDNF dorado de las esquinas: podrás neutralizar toxinas tocándolas y disparar en 4 direcciones.',
      done: () => {
        if (state.current.power > 0) sawPower.current = true;
        return sawPower.current;
      },
      autoAdvance: 40,
    },
    {
      text: '¡Bien! Recoge todas las vesículas para activar la red y pasar de nivel.',
      done: () => false,
      autoAdvance: 5,
    },
  ];

  if (!active) return null;
  return <Coach steps={steps} accent="#b49cff" paused={() => state.current.phase !== 'playing'} onFinish={onFinish} placement="top-low" />;
}
