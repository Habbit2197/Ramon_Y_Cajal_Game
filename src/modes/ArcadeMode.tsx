/**
 * ArcadeMode.tsx — Modo Arcade: el shooter roguelite dentro del cerebro (App3D).
 * Arranca una partida al montarse, registra medallas y envía la puntuación al terminar.
 */
import { useCallback, useEffect, useState } from 'react';
import { Play, Home, CircleHelp } from 'lucide-react';
import { App3D } from '../App3D';
import { world } from '../engine/world';
import { resetClock } from '../engine/clock';
import { feel } from '../engine/feel';
import { useRunStore } from '../store/useRunStore';
import { useProfileStore } from '../store/useProfileStore';
import { UPGRADES } from '../game/upgrades';
import { RogueliteHUD } from '../components/ui/RogueliteHUD';
import { DraftModal } from '../components/ui/DraftModal';
import { GameOverModal, VictoryModal, type ArcadeResult } from '../components/ui/GameOverModal';
import { TouchControls } from '../components/ui/TouchControls';
import { ArcadeCoach } from '../components/onboarding/Coach';
import { isTouchDevice } from '../components/onboarding/OnboardingModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAutoPause } from '../engine/mobile';

const REGION_NAMES = ['Corteza prefrontal', 'Hipocampo', 'Cerebelo'];
const EVOLUTION_IDS = Object.entries(UPGRADES).filter(([, u]) => u.rarity === 'evolution').map(([id]) => id);

export function ArcadeMode({
  onExit, muted, onToggleMute, coach, onCoachDone, onHelp, helpOpen,
}: {
  onExit: () => void; muted: boolean; onToggleMute: () => void;
  coach: boolean; onCoachDone: () => void; onHelp: () => void; helpOpen: boolean;
}) {
  const phase = useRunStore((s) => s.phase);
  const setPhase = useRunStore((s) => s.setPhase);
  const [result, setResult] = useState<ArcadeResult | null>(null);
  /** Tras superar las tres regiones: elegir entre guardar o seguir en modo infinito */
  const [victory, setVictory] = useState(false);
  const [touch] = useState(isTouchDevice);

  const start = useCallback(() => {
    resetClock();
    setResult(null);
    setVictory(false);
    useRunStore.getState().newRun();
  }, []);

  useEffect(() => {
    start();
    return () => useRunStore.getState().setPhase('title');
  }, [start]);

  // Medallas durante la partida: impulsos perfectos, divisiones de etanol, avance de región/oleada/nivel
  useEffect(() => {
    const rec = useProfileStore.getState().recordArcade;
    const onFeel = (e: string) => {
      if (e === 'perfectDash') rec({ perfectDashes: 1 });
      else if (e === 'split') rec({ tankSplits: 1 });
    };
    feel.listeners.add(onFeel);
    const unsub = useRunStore.subscribe((s, prev) => {
      if (s.phase === 'title') return;
      if (s.region !== prev.region || s.wave !== prev.wave || s.level !== prev.level || s.owned !== prev.owned) {
        rec({
          region: s.region,
          wave: s.region === 0 ? s.wave : 5,
          level: s.level,
          evolutions: EVOLUTION_IDS.filter((id) => (s.owned as Record<string, number>)[id]).length,
        });
      }
    });
    return () => {
      feel.listeners.delete(onFeel);
      unsub();
    };
  }, []);

  /** Calcula el resultado, lo envía a la clasificación y registra estadísticas (una vez por partida) */
  const finalize = useCallback(() => {
    const s = useRunStore.getState();
    const won = s.runWon;
    const region = Math.min(s.region, 2);
    const detail = s.endless ? `Modo infinito, oleada ${s.wave + 1}` : won ? 'Las tres regiones superadas' : `${REGION_NAMES[region]}, oleada ${s.wave + 1}`;
    const profile = useProfileStore.getState();
    const rank = profile.submitScore('arcade', world.score, detail);
    profile.recordArcadeEnd({ won, kills: world.kills, region, wave: region === 0 ? s.wave : 5, level: s.level });
    setResult({ won, score: world.score, kills: world.kills, detail, seconds: world.elapsed, rank, regionStars: s.regionStars });
  }, []);

  useEffect(() => {
    if (phase !== 'gameover' || result || victory) return;
    const s = useRunStore.getState();
    if (s.runWon && !s.endless) setVictory(true); // primero, elegir
    else finalize();
  }, [phase, result, victory, finalize]);

  // Al cambiar de app o de pestaña, la partida se pausa
  const autoPause = useCallback(() => { if (useRunStore.getState().phase === 'playing') setPhase('paused'); }, [setPhase]);
  useAutoPause(phase === 'playing', autoPause);

  // Esc / P: pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (helpOpen || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
      const p = useRunStore.getState().phase;
      if (p === 'playing') setPhase('paused');
      else if (p === 'paused') setPhase('playing');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPhase, helpOpen]);

  return (
    <div className="fixed inset-0 bg-[#03050c]">
      <ErrorBoundary>
        <App3D />
      </ErrorBoundary>
      {phase !== 'gameover' && <RogueliteHUD onPause={() => setPhase('paused')} muted={muted} onToggleMute={onToggleMute} />}
      {touch && phase === 'playing' && <TouchControls />}
      <ArcadeCoach active={coach && phase !== 'gameover'} onFinish={onCoachDone} />
      <DraftModal />

      {phase === 'paused' && !helpOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="arcade-pause" className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#020a0d]/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#06161c]/95 border border-[#5ee6ff]/25 flex flex-col gap-4">
            <h2 id="arcade-pause" className="font-display text-3xl text-white">En pausa</h2>
            <p className="text-sm text-[#9fc6cf]">La partida está congelada. Pulsa Esc para seguir.</p>
            <button
              type="button"
              autoFocus
              onClick={() => setPhase('playing')}
              className="h-12 rounded-xl bg-[#5ee6ff] hover:bg-[#8ff0ff] text-[#03141a] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" aria-hidden />
              Seguir jugando
            </button>
            <button
              type="button"
              onClick={onHelp}
              className="h-11 rounded-xl text-sm text-[#cfe9ee] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <CircleHelp className="w-4 h-4" aria-hidden />
              Cómo se juega
            </button>
            <button
              type="button"
              onClick={onExit}
              className="h-12 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" aria-hidden />
              Salir al menú
            </button>
          </div>
        </div>
      )}

      {phase === 'gameover' && victory && !result && (
        <VictoryModal
          score={world.score}
          regionStars={useRunStore.getState().regionStars}
          onContinue={() => { setVictory(false); useRunStore.getState().continueEndless(); }}
          onFinish={() => { finalize(); }}
        />
      )}
      {phase === 'gameover' && result && <GameOverModal result={result} onRetry={start} onExit={onExit} />}
    </div>
  );
}
