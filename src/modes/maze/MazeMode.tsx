/**
 * MazeMode.tsx — Modo Laberinto: un comecocos por la red neuronal.
 *
 * Controles:
 * - Teclado: flechas o WASD para elegir camino (se recuerda hasta la siguiente neurona), Espacio para disparar.
 * - Táctil: desliza el dedo en cualquier dirección, o usa la cruceta; botón «Disparar».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Pause, Play, Home, CircleHelp, Volume2, VolumeX, Zap, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import { createMazeGame, MAZE_RULES, powerSecondsFor, type MazeState, type MazeInput } from '../../game/maze/sim';
import { activeParams } from '../../game/difficulty';
import { CajalQuiz } from '../../components/ui/CajalQuiz';
import { dailyFor, finishRun } from '../../store/useSession';
import type { Dir } from '../../game/maze/graph';
import { MazeScene, GHOST_COLORS } from './MazeScene';
import { useProfileStore } from '../../store/useProfileStore';
import { useRunStore } from '../../store/useRunStore';
import { soundEngine } from '../../game/sound';
import { Leaderboard } from '../../components/menu/Leaderboard';
import { MazeCoach } from '../../components/onboarding/Coach';
import { isTouchDevice } from '../../components/onboarding/OnboardingModal';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useAutoPause } from '../../engine/mobile';

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};

/** Un dato de Cajal o de neurociencia al activar cada red */
const LEVEL_FACTS = [
  'Cajal demostró que el sistema nervioso está formado por células independientes que se comunican en las sinapsis.',
  'Cuando aprendes algo, las conexiones que más usas se refuerzan: el cerebro cambia con lo que haces.',
  'Las neuronas se comunican con señales eléctricas y químicas que cruzan la sinapsis en milésimas de segundo.',
  'Dormir bien ayuda a consolidar lo aprendido durante el día.',
  'Cajal ganó el Premio Nobel de Medicina en 1906 por sus estudios sobre la estructura del sistema nervioso.',
  'El ejercicio aumenta el BDNF, una proteína que ayuda a las neuronas a crecer y conectarse.',
];

interface Hud {
  score: number;
  level: number;
  lives: number;
  charges: number;
  power: number;
  powerMax: number;
  activated: number; // 0..1
  phase: MazeState['phase'];
}

const snapshot = (s: MazeState): Hud => ({
  score: s.score,
  level: s.level,
  lives: s.lives,
  charges: s.charges,
  power: s.power,
  powerMax: powerSecondsFor(s),
  activated: 1 - s.pelletsLeft / s.pellets.length,
  phase: s.phase,
});

/** Partida nueva con la dificultad activa (y la semilla del Desafío Diario si toca) */
function newMazeGame() {
  const dp = activeParams();
  return createMazeGame(dailyFor('maze')?.seed, { ...dp.maze, scoreMult: dp.scoreMult });
}

export function MazeMode({
  onExit, muted, onToggleMute, coach, onCoachDone, onHelp, helpOpen,
}: {
  onExit: () => void; muted: boolean; onToggleMute: () => void;
  coach: boolean; onCoachDone: () => void; onHelp: () => void; helpOpen: boolean;
}) {
  const state = useRef<MazeState>(newMazeGame());
  const input = useRef<MazeInput & { fireQueued: boolean }>({ dir: null, fire: false, fireQueued: false });
  const paused = useRef(false);
  const shake = useRef(0);
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState<Hud>(() => snapshot(state.current));
  const [isPaused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; level: number; rank: number | null } | null>(null);
  const [touch] = useState(isTouchDevice);
  /** Pregunta de Cajal al activar una red */
  const [quiz, setQuiz] = useState(false);
  const reducedFlashes = useRunStore((s) => s.settings.reducedFlashes);
  const shakeScale = useRunStore((s) => s.settings.shakeScale);

  paused.current = isPaused || helpOpen || !!result || quiz;
  // Solo en desarrollo: acceso al estado para las pruebas automáticas (no existe en la versión publicada)
  if (import.meta.env.DEV) (window as unknown as { __cajalMaze?: typeof state }).__cajalMaze = state;

  const restart = useCallback(() => {
    state.current = newMazeGame();
    setQuiz(false);
    input.current = { dir: null, fire: false, fireQueued: false };
    setResult(null);
    setPaused(false);
    setRun((r) => r + 1);
  }, []);

  // Al cambiar de app o de pestaña, la partida se pausa
  const autoPause = useCallback(() => setPaused(true), []);
  useAutoPause(!isPaused && !result, autoPause);

  // HUD a 10 Hz: sin re-render de React en cada frame
  useEffect(() => {
    const t = window.setInterval(() => setHud(snapshot(state.current)), 100);
    return () => window.clearInterval(t);
  }, []);

  // Sonido, sacudida, medallas y fin de partida
  const onEvents = useCallback(
    (events: string[]) => {
      const s = state.current;
      const rec = useProfileStore.getState().recordMaze;
      let blipped = false;
      for (const e of events) {
        switch (e) {
          case 'pellet':
            if (!blipped) { soundEngine.playBlip(); blipped = true; }
            break;
          case 'power':
            soundEngine.playPortalReady();
            break;
          case 'eat':
            soundEngine.playHealthyPickup(100);
            rec({ bestChain: s.chain });
            break;
          case 'stun':
            soundEngine.playDash();
            rec({ stuns: 1 });
            break;
          case 'shot':
            break;
          case 'death':
            soundEngine.playHazardHit();
            shake.current = 0.9 * shakeScale;
            navigator.vibrate?.(80);
            break;
          case 'clear':
            soundEngine.playVictoryFanfare();
            rec({ level: s.level + 1 });
            // la pregunta sale cuando se ha visto el mensaje de «Red activada»
            window.setTimeout(() => { if (state.current === s && s.phase === 'cleared') setQuiz(true); }, 1300);
            break;
          case 'gameover': {
            soundEngine.playDefeatSting();
            const profile = useProfileStore.getState();
            const rank = finishRun('maze', s.score, `Nivel ${s.level}`, s.level >= 2);
            profile.recordMazeEnd({ level: s.level, score: s.score });
            setResult({ score: s.score, level: s.level, rank });
            break;
          }
        }
      }
    },
    [shakeScale],
  );

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (helpOpen) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!result) setPaused((p) => !p);
        return;
      }
      if (paused.current) return;
      const d = KEY_DIR[e.code];
      if (d !== undefined) {
        e.preventDefault();
        input.current.dir = d;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) input.current.fireQueued = true;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen, result]);

  // Deslizar el dedo para cambiar de camino
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sw = swipe.current;
    if (!sw || sw.id !== e.pointerId) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.hypot(dx, dy) < 22) return;
    input.current.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; // permite encadenar giros sin levantar el dedo
  };
  const onPointerUp = () => (swipe.current = null);

  const s = state.current;
  const levelKey = `${run}-${hud.level}`;

  return (
    <div className="fixed inset-0 bg-[#03070d] touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <ErrorBoundary>
        <MazeScene key={run} state={state} input={input} paused={paused} onEvents={onEvents} shake={shake} level={levelKey} reducedFlashes={reducedFlashes} />
      </ErrorBoundary>

      {/* HUD superior */}
      <div className="absolute inset-x-0 top-0 safe-pad safe-pad-sm !pb-0 flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-[#0b1220]/80 backdrop-blur-md border border-[#b49cff]/25 px-4 py-2.5 flex flex-col gap-1.5 min-w-[11rem]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-2xl font-semibold text-white [font-variant-numeric:tabular-nums]">{hud.score.toLocaleString('es-ES')}</span>
            <span className="text-xs text-[#c9b8ff]">Nivel {hud.level}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex gap-1" aria-label={`${hud.lives} vidas`}>
              {Array.from({ length: Math.max(hud.lives, 0) }, (_, i) => (
                <Heart key={i} className="w-4 h-4 fill-[#ff8fb1] text-[#ff8fb1]" aria-hidden />
              ))}
            </span>
            <span className="flex gap-0.5" aria-label={`${hud.charges} cargas de disparo`} title="Cargas de disparo">
              {Array.from({ length: MAZE_RULES.charges }, (_, i) => (
                <Zap key={i} className={`w-4 h-4 ${i < hud.charges ? 'fill-[#ffd166] text-[#ffd166]' : 'text-[#4b4636]'}`} aria-hidden />
              ))}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" title="Red activada">
            <div className="h-full bg-[#7ff3ff]" style={{ width: `${hud.activated * 100}%` }} />
          </div>
          <span className="text-[0.7rem] text-[#9fc6cf]">Red activada: {Math.round(hud.activated * 100)} %</span>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} className="w-10 h-10 rounded-xl bg-[#0b1220]/80 border border-white/10 text-[#e9e3d6] inline-flex items-center justify-center cursor-pointer">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => setPaused(true)} aria-label="Pausa" className="w-10 h-10 rounded-xl bg-[#0b1220]/80 border border-white/10 text-[#e9e3d6] inline-flex items-center justify-center cursor-pointer">
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BDNF activo */}
      {hud.power > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[7.5rem] sm:top-6 pointer-events-none rounded-full px-4 py-1.5 bg-[#3a2c06]/85 border border-[#ffd166]/60 flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[#ffd166]">BDNF: disparo en 4 direcciones</span>
          <span className="w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
            <span className="block h-full bg-[#ffd166]" style={{ width: `${(hud.power / hud.powerMax) * 100}%` }} />
          </span>
        </div>
      )}

      {/* Mensajes de fase */}
      <AnimatePresence>
        {(hud.phase === 'ready' || hud.phase === 'cleared') && !result && (
          <motion.div
            key={`${hud.phase}-${hud.level}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none p-6"
          >
            <div className="rounded-3xl bg-[#0b1220]/85 backdrop-blur-md border border-[#b49cff]/30 px-7 py-5 text-center max-w-md">
              {hud.phase === 'ready' ? (
                <>
                  <div className="font-display text-4xl text-white">Nivel {hud.level}</div>
                  <div className="mt-1 text-[#c9b8ff]">¿Listo? Recoge todas las vesículas para activar la red.</div>
                </>
              ) : (
                <>
                  <div className="font-display text-4xl text-[#7ff3ff]">¡Red activada!</div>
                  <p className="mt-2 text-sm text-[#e9e3d6] leading-relaxed">{LEVEL_FACTS[(hud.level - 1) % LEVEL_FACTS.length]}</p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controles táctiles */}
      {touch && !result && (
        <div className="absolute inset-x-0 bottom-0 safe-pad !pt-0 flex items-end justify-between pointer-events-none">
          <div className="pointer-events-auto grid grid-cols-3 gap-1.5" aria-label="Cruceta">
            {([[null, 0, null], [3, null, 1], [null, 2, null]] as (Dir | null)[][]).flat().map((d, i) =>
              d === null ? (
                <span key={i} className="w-14 h-14" />
              ) : (
                <button
                  key={i}
                  type="button"
                  aria-label={['Arriba', 'Derecha', 'Abajo', 'Izquierda'][d]}
                  onPointerDown={(e) => { e.stopPropagation(); input.current.dir = d; }}
                  className="w-14 h-14 rounded-xl bg-[#0b1220]/80 border border-[#b49cff]/35 text-[#e9e3d6] inline-flex items-center justify-center active:bg-[#b49cff]/30 touch-none"
                >
                  {[<ChevronUp key="u" />, <ChevronRight key="r" />, <ChevronDown key="d" />, <ChevronLeft key="l" />][d]}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            aria-label="Disparar"
            onPointerDown={(e) => { e.stopPropagation(); input.current.fireQueued = true; }}
            className="pointer-events-auto w-24 h-24 rounded-full bg-[#ffd166] text-[#1a1206] inline-flex flex-col items-center justify-center font-semibold text-sm active:scale-95 touch-none shadow-lg"
          >
            <Crosshair className="w-7 h-7" aria-hidden />
            Disparar
          </button>
        </div>
      )}

      <MazeCoach active={coach && !result && !quiz} state={state} onFinish={onCoachDone} />

      {quiz && !result && (
        <CajalQuiz
          reward="bdnf"
          accent="#b49cff"
          seed={dailyFor('maze') ? dailyFor('maze')!.seed + state.current.level : undefined}
          onDone={(ok) => {
            if (ok) state.current.pendingPower = true;
            setQuiz(false);
          }}
        />
      )}

      {/* Pausa */}
      {isPaused && !helpOpen && !result && (
        <div role="dialog" aria-modal="true" aria-labelledby="maze-pause" className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#03070d]/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#120d1f]/95 border border-[#b49cff]/30 flex flex-col gap-4">
            <h2 id="maze-pause" className="font-display text-3xl text-white">En pausa</h2>
            <p className="text-sm text-[#c9b8ff]">Nivel {hud.level}, {hud.score.toLocaleString('es-ES')} puntos.</p>
            <button type="button" autoFocus onClick={() => setPaused(false)} className="h-12 rounded-xl bg-[#b49cff] hover:bg-[#c9b8ff] text-[#150a2e] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer">
              <Play className="w-4 h-4" aria-hidden /> Seguir jugando
            </button>
            <button type="button" onClick={onHelp} className="h-11 rounded-xl text-sm text-[#e0d6ff] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer">
              <CircleHelp className="w-4 h-4" aria-hidden /> Cómo se juega
            </button>
            <button type="button" onClick={onExit} className="h-12 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer">
              <Home className="w-4 h-4" aria-hidden /> Salir al menú
            </button>
          </div>
        </div>
      )}

      {/* Fin de partida */}
      {result && (
        <div role="dialog" aria-modal="true" aria-labelledby="maze-over" className="absolute inset-0 z-50 bg-[#03070d]/85 backdrop-blur-md overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl grid gap-6 md:grid-cols-[1fr_17rem] rounded-3xl p-6 sm:p-8 bg-[#120d1f]/95 border border-[#b49cff]/30">
              <div className="flex flex-col gap-5">
                <div>
                  <h2 id="maze-over" className="font-display text-3xl sm:text-4xl text-white">Las toxinas te han alcanzado</h2>
                  <p className="mt-1.5 text-sm text-[#c9b8ff]">Has llegado al nivel {result.level}.</p>
                </div>
                <div>
                  <div className="text-5xl sm:text-6xl font-semibold text-[#d9ccff] [font-variant-numeric:tabular-nums] leading-none">{result.score.toLocaleString('es-ES')}</div>
                  <p className="mt-2 text-sm text-[#e9e3d6]">
                    {result.rank === 1 ? '¡Nuevo récord en este dispositivo!' : result.rank ? `Puesto ${result.rank} de la clasificación.` : 'No ha entrado en el top 20 esta vez.'}
                  </p>
                </div>
                <ul className="grid grid-cols-2 gap-2 text-sm">
                  {(Object.keys(GHOST_COLORS) as (keyof typeof GHOST_COLORS)[]).map((k) => (
                    <li key={k} className="flex items-center gap-2 text-[#e9e3d6]">
                      <span className="w-3 h-3 rounded-full" style={{ background: GHOST_COLORS[k] }} />
                      {{ nicotina: 'Cigarrillo: te persigue', azucar: 'Refresco: te corta el paso', alcohol: 'Botellín: va dando tumbos', insomnio: 'Móvil de noche: te ronda y se aparta' }[k]}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <button type="button" autoFocus onClick={restart} className="h-12 px-6 rounded-xl bg-[#b49cff] hover:bg-[#c9b8ff] text-[#150a2e] font-semibold inline-flex items-center gap-2 cursor-pointer">
                    <RotateCcw className="w-4 h-4" aria-hidden /> Jugar otra vez
                  </button>
                  <button type="button" onClick={onExit} className="h-12 px-5 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer">
                    <Home className="w-4 h-4" aria-hidden /> Menú principal
                  </button>
                </div>
              </div>
              <div className="md:border-l md:border-white/10 md:pl-6">
                <Leaderboard initialMode={dailyFor('maze') ? 'daily' : 'maze'} limit={8} compact />
              </div>
            </motion.div>
          </div>
        </div>
      )}
      {/* aria-live para lectores de pantalla */}
      <span className="sr-only" aria-live="polite">{s.phase === 'cleared' ? 'Red activada' : ''}</span>
    </div>
  );
}
