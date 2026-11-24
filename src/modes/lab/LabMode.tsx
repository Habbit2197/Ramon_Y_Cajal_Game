/**
 * LabMode.tsx — El Laboratorio de Cajal: tres minijuegos con la misma estructura.
 *
 * intro (qué vas a aprender y cómo se juega) → partida → resultado (puntos, fichas
 * descubiertas, clasificación). Los tres son 2D (canvas o SVG): cargan rápido y van
 * bien en móviles sencillos.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Home, RotateCcw, Play, Pause, Volume2, VolumeX, Landmark, CalendarCheck, Microscope, Puzzle, Music, Smile } from 'lucide-react';
import { useProfileStore, aliasKey, type LabGame, type LabResult } from '../../store/useProfileStore';
import { useSession, dailyFor, finishRun } from '../../store/useSession';
import { activeDifficulty, activeParams, DIFFICULTY_INFO, MODIFIER_INFO } from '../../game/difficulty';
import { MUSEUM_BY_ID } from '../../game/museum';
import { Leaderboard } from '../../components/menu/Leaderboard';
import { PLAY_COLOR, PLAY_LABEL } from '../../components/menu/MenuExtras';
import { isTouchDevice } from '../../components/onboarding/OnboardingModal';
import { useAutoPause } from '../../engine/mobile';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const MicroGame = lazy(() => import('./MicroGame'));
const BuildGame = lazy(() => import('./BuildGame'));
const RhythmGame = lazy(() => import('./RhythmGame'));
const BrushGame = lazy(() => import('./BrushGame'));

export interface LabGameProps {
  seed: number;
  paused: boolean;
  touch: boolean;
  onFinish: (r: LabOutcome) => void;
}

export interface LabOutcome extends LabResult {
  detail: string;
  /** Líneas de resumen para la pantalla final */
  lines: string[];
}

const INFO: Record<LabGame, { learn: string; how: (touch: boolean) => string[]; icon: typeof Microscope }> = {
  micro: {
    icon: Microscope,
    learn: 'Cajal usaba la tinción de Golgi: un reactivo que vuelve negras solo unas pocas neuronas, al azar. Así podía verlas enteras y dibujarlas.',
    how: (t) => [
      `${t ? 'Frota la muestra con el dedo' : 'Arrastra el ratón sobre la muestra'} para aplicar el reactivo. Aparecerán las neuronas teñidas.`,
      'El reactivo es limitado: no repases lo que ya está teñido.',
      'Cuando descubras una neurona, di de qué tipo es. Hay tres muestras: corteza, cerebelo e hipocampo.',
    ],
  },
  build: {
    icon: Puzzle,
    learn: 'Cada parte de la neurona tiene un trabajo. Cajal descubrió que el mensaje viaja siempre en el mismo sentido: de las dendritas al axón.',
    how: (t) => [
      `${t ? 'Toca una pieza y después toca su hueco' : 'Arrastra cada pieza a su hueco, o haz clic en la pieza y luego en el hueco'}.`,
      'Cada hueco tiene una pista: lee qué hace la parte que falta.',
      'Cuidado: en cada taller hay una pieza intrusa que no pertenece a la neurona.',
    ],
  },
  rhythm: {
    icon: Music,
    learn: 'Una neurona solo dispara cuando recibe suficientes mensajes a la vez: tiene que superar su umbral. El GABA hace de freno.',
    how: (t) => [
      `${t ? 'Toca el carril' : 'Pulsa A, S o D (o las flechas ←, ↓, →)'} cuando la vesícula llegue a la membrana.`,
      'Cada acierto sube el potencial. Al llenarlo, la neurona dispara un potencial de acción: puntos extra.',
      'Las notas rojas con una raya son GABA, un freno: no las pulses, déjalas pasar.',
    ],
  },
  brush: {
    icon: Smile,
    learn: 'Cada día se forma placa sobre los dientes: bacterias que, con el azúcar, fabrican ácidos y causan caries. Los dentistas recomiendan cepillarse dos veces al día, dos minutos cada vez.',
    how: (t) => [
      `Primero, pon la pasta: ${t ? 'mantén el dedo' : 'mantén pulsado'} sobre el tubo hasta que salga una bolita del tamaño de un guisante.`,
      `Cepilla las cuatro zonas de la boca, 30 segundos cada una: por fuera, por dentro y por arriba. ${t ? 'Pasa el dedo' : 'Mueve el ratón'} sobre los dientes con vaivenes cortos, como hace el cepillo.`,
      'Fíjate en la encía y entre los dientes: ahí se esconde la placa. Al final, elige qué hacer con la espuma.',
    ],
  },
};

export function LabMode({ game, onExit, muted, onToggleMute }: { game: LabGame; onExit: () => void; muted: boolean; onToggleMute: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<(LabOutcome & { rank: number | null; fresh: string[] }) | null>(null);
  const [touch] = useState(isTouchDevice);
  const daily = useSession((s) => s.daily);
  const today = dailyFor(game);
  const c = PLAY_COLOR[game];
  const info = INFO[game];
  const [seed, setSeed] = useState(() => today?.seed ?? ((Math.random() * 2 ** 31) | 0));

  const start = useCallback(() => {
    setSeed(dailyFor(game)?.seed ?? ((Math.random() * 2 ** 31) | 0));
    setOutcome(null);
    setPaused(false);
    setRun((r) => r + 1);
    setPhase('play');
  }, [game]);

  const finish = useCallback(
    (r: LabOutcome) => {
      const before = useProfileStore.getState();
      const known = before.progress[aliasKey(before.playerName)]?.discoveries ?? {};
      const score = Math.round(r.score * activeParams().scoreMult);
      const rank = finishRun(game, score, r.detail, r.completed);
      useProfileStore.getState().recordLab(game, { ...r, score });
      const fresh = r.cards.filter((id, i, a) => a.indexOf(id) === i && !known[id] && MUSEUM_BY_ID[id]);
      setOutcome({ ...r, score, rank, fresh });
      setPhase('result');
    },
    [game],
  );

  const autoPause = useCallback(() => setPaused(true), []);
  useAutoPause(phase === 'play' && !paused, autoPause);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (phase === 'intro' && e.code === 'Enter') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start]);

  const Game = game === 'micro' ? MicroGame : game === 'build' ? BuildGame : game === 'rhythm' ? RhythmGame : BrushGame;
  const Icon = info.icon;
  const diff = activeDifficulty();

  return (
    <div className="fixed inset-0 bg-[#0b1220] text-[#f4efe6] flex flex-col" data-game-surface>
      {/* Barra superior */}
      <header className="safe-pad safe-pad-sm !pb-2 flex items-center justify-between gap-3 border-b border-white/8">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: `${c.bg}22`, color: c.bg }}>
            <Icon className="w-4 h-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight truncate">{PLAY_LABEL[game]}</div>
            <div className="text-[0.7rem] text-[#a9a293] truncate">
              {daily && today ? `Desafío del día: ${MODIFIER_INFO[diff.modifier].label}` : `Laboratorio de Cajal, ${DIFFICULTY_INFO[diff.difficulty].label}`}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 inline-flex items-center justify-center cursor-pointer">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {phase === 'play' && (
            <button type="button" onClick={() => setPaused(true)} aria-label="Pausa" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 inline-flex items-center justify-center cursor-pointer">
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onExit} aria-label="Salir al menú" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 inline-flex items-center justify-center cursor-pointer">
            <Home className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        {phase === 'play' && (
          <ErrorBoundary>
            <Suspense fallback={<div className="p-6 text-[#a9a293]" role="status">Preparando el laboratorio…</div>}>
              <Game key={run} seed={seed} paused={paused} touch={touch} onFinish={finish} />
            </Suspense>
          </ErrorBoundary>
        )}

        {phase === 'intro' && (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-5 safe-pad">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl flex flex-col gap-5">
                {today && (
                  <div className="daily-card rounded-2xl px-4 py-3 text-sm flex items-start gap-2.5">
                    <CalendarCheck className="w-4 h-4 mt-0.5 text-[#7fe0a8] shrink-0" aria-hidden />
                    <span><strong className="text-white">Desafío del día.</strong> {today.goal} {MODIFIER_INFO[today.modifier].blurb}</span>
                  </div>
                )}
                <div>
                  <h1 className="font-display text-4xl text-white">{PLAY_LABEL[game]}</h1>
                  <p className="mt-3 text-[#e9e3d6] leading-relaxed">{info.learn}</p>
                </div>
                <ol className="flex flex-col gap-2.5">
                  {info.how(touch).map((line, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full shrink-0 inline-flex items-center justify-center text-xs font-semibold" style={{ background: `${c.bg}26`, color: c.bg }}>{i + 1}</span>
                      <span className="text-[#c9c2b4] leading-snug">{line}</span>
                    </li>
                  ))}
                </ol>
                <button type="button" autoFocus onClick={start} className="self-start h-14 px-8 rounded-2xl font-semibold text-base inline-flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-transform" style={{ background: c.bg, color: c.fg }}>
                  <Play className="w-5 h-5" aria-hidden /> Empezar
                </button>
              </motion.div>
            </div>
          </div>
        )}

        {phase === 'play' && paused && (
          <div role="dialog" aria-modal="true" aria-labelledby="lab-pause" className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1220]/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl p-6 bg-[#121a2a]/95 border border-white/12 flex flex-col gap-4">
              <h2 id="lab-pause" className="font-display text-3xl text-white">En pausa</h2>
              <button type="button" autoFocus onClick={() => setPaused(false)} className="h-12 rounded-xl font-semibold inline-flex items-center justify-center gap-2 cursor-pointer" style={{ background: c.bg, color: c.fg }}>
                <Play className="w-4 h-4" aria-hidden /> Seguir
              </button>
              <button type="button" onClick={start} className="h-11 rounded-xl text-sm text-[#e9e3d6] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer">
                <RotateCcw className="w-4 h-4" aria-hidden /> Empezar de nuevo
              </button>
              <button type="button" onClick={onExit} className="h-12 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer">
                <Home className="w-4 h-4" aria-hidden /> Salir al menú
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && outcome && (
          <div role="dialog" aria-modal="true" aria-labelledby="lab-result" className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4 safe-pad">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl grid gap-6 md:grid-cols-[1fr_17rem] rounded-3xl p-6 sm:p-8 bg-[#121a2a]/95 border" style={{ borderColor: `${c.bg}44` }}>
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 id="lab-result" className="font-display text-3xl sm:text-4xl text-white">{outcome.completed ? '¡Experimento completado!' : 'Experimento terminado'}</h2>
                    <ul className="mt-2 flex flex-col gap-1 text-sm text-[#c9c2b4]">
                      {outcome.lines.map((l) => <li key={l}>{l}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="text-5xl sm:text-6xl font-semibold [font-variant-numeric:tabular-nums] leading-none" style={{ color: c.bg }}>{outcome.score.toLocaleString('es-ES')}</div>
                    <p className="mt-2 text-sm text-[#e9e3d6]">
                      {outcome.rank === 1 ? '¡Nuevo récord en este dispositivo!' : outcome.rank ? `Puesto ${outcome.rank} en este dispositivo.` : 'No ha entrado en el top 20 esta vez.'}
                      {today ? (outcome.completed ? ' Desafío del día completado.' : ` Reto del día: ${today.goal}`) : ''}
                    </p>
                  </div>
                  {outcome.fresh.length > 0 && (
                    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                      <div className="text-sm font-semibold text-[#7fe0a8] flex items-center gap-1.5"><Landmark className="w-4 h-4" aria-hidden /> Nuevas fichas en el Museo</div>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {outcome.fresh.map((id) => <li key={id} className="text-sm rounded-full px-2.5 py-1 bg-[#7fe0a8]/12 text-[#e9e3d6]">{MUSEUM_BY_ID[id].title}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" autoFocus onClick={start} className="h-12 px-6 rounded-xl font-semibold inline-flex items-center gap-2 cursor-pointer" style={{ background: c.bg, color: c.fg }}>
                      <RotateCcw className="w-4 h-4" aria-hidden /> Jugar otra vez
                    </button>
                    <button type="button" onClick={onExit} className="h-12 px-5 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer">
                      <Home className="w-4 h-4" aria-hidden /> Menú principal
                    </button>
                  </div>
                </div>
                <div className="md:border-l md:border-white/10 md:pl-6">
                  <Leaderboard initialMode={today ? 'daily' : game} limit={8} compact />
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
