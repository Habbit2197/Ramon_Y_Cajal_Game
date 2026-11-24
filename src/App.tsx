/**
 * App.tsx — Cajal: Sinapsis 3D
 *
 * Tres pantallas:
 * - menu:   menú principal (alias, modo, clasificación) sobre el recorrido 3D del parque.
 * - story:  Modo Historia, el juego original del parque (Canvas3D + GameHud).
 * - arcade: Modo Arcade, el shooter roguelite dentro del cerebro (App3D).
 *
 * Canvas3D se mantiene montado entre menú e historia (el menú usa su modo 'title'),
 * y se desmonta al entrar en arcade para que nunca haya dos contextos WebGL a la vez.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas3D, type GameAppState, type HudSnapshot } from './components/Canvas3D';
import { GameHud } from './components/GameHud';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainMenu } from './components/menu/MainMenu';
import { StoryPauseModal, StoryOutcomeModal, timeBonus } from './modes/StoryModals';
// Cada modo se descarga al elegirlo: el menú aparece antes (el Arcade incluye el motor de física)
const ArcadeMode = lazy(() => import('./modes/ArcadeMode').then((m) => ({ default: m.ArcadeMode })));
const MazeMode = lazy(() => import('./modes/maze/MazeMode').then((m) => ({ default: m.MazeMode })));
const LabMode = lazy(() => import('./modes/lab/LabMode').then((m) => ({ default: m.LabMode })));
const ClassroomPanel = lazy(() => import('./components/menu/ClassroomPanel').then((m) => ({ default: m.ClassroomPanel })));
const MuseumBook = lazy(() => import('./components/menu/MuseumBook').then((m) => ({ default: m.MuseumBook })));
/** Precarga el modo en cuanto se selecciona en el menú, para que al pulsar «Jugar» ya esté listo */
export const prefetchMode = (m: PlayId) => {
  if (m === 'arcade') void import('./modes/ArcadeMode');
  else if (m === 'maze') void import('./modes/maze/MazeMode');
  else if (m === 'micro' || m === 'build' || m === 'rhythm') void import('./modes/lab/LabMode');
};
import { LEVELS } from './game/rules';
import { soundEngine } from './game/sound';
import { useGameStore } from './store/useGameStore';
import { useProfileStore, aliasKey, type GameMode, type LabGame } from './store/useProfileStore';
import { useSession, finishRun } from './store/useSession';
import { dailyChallenge, type PlayId } from './game/daily';
import { activeParams } from './game/difficulty';
import { quizPointsBonus } from './game/quiz';
import { CajalQuiz } from './components/ui/CajalQuiz';
import { useRunStore } from './store/useRunStore';
import { feelSettings } from './engine/feel';
import { useAutoPause, useWakeLock } from './engine/mobile';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { StoryCoach } from './components/onboarding/Coach';
import { TrophyBook } from './components/menu/TrophyBook';
import { TrophyToasts } from './components/menu/TrophyToasts';
import { SettingsPanel } from './components/menu/SettingsPanel';

const GddModal = lazy(() => import('./components/GddModal').then((m) => ({ default: m.GddModal })));

type Screen = 'menu' | GameMode | LabGame;
const isMainMode = (m: PlayId): m is GameMode => m === 'story' || m === 'arcade' || m === 'maze';

const INITIAL_HUD: HudSnapshot = {
  brainPower: 20,
  cognitiveFatiguePct: 80,
  vitality: 3,
  maxVitality: 3,
  speedModifier: 1.0,
  activeEffectName: null,
  effectTimer: 0,
  synapsesCollected: 0,
  hazardsHit: 0,
  score: 0,
  portalUnlocked: false,
  cajalBannerText: LEVELS[0].cajalIntroQuote,
  cajalBannerType: 'intro',
  elapsedTime: 0,
  dashReady: true,
  animState: 'Idle',
};

const shortName = (n: string) => n.replace(/^Nivel \d+:\s*/, '');

function ModeLoading() {
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0b1220] text-[#c9c2b4]" role="status">
      <span className="w-10 h-10 rounded-full border-2 border-white/15 border-t-[#e8b45a] animate-spin motion-reduce:animate-none" aria-hidden />
      Cargando el modo…
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<PlayId>('story');
  const [levelIndex, setLevelIndex] = useState(0);
  const [storyState, setStoryState] = useState<GameAppState>('title');
  const [resetSignal, setResetSignal] = useState(0);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [outcome, setOutcome] = useState<{ kind: 'victory' | 'defeat'; stats: HudSnapshot; score: number; rank: number | null; stars: number } | null>(null);
  /** Onboarding abierto: para qué modo y si al terminar empieza la partida */
  const [onboarding, setOnboarding] = useState<{ mode: GameMode; thenStart: boolean } | null>(null);
  /** Guía interactiva activa en la partida actual */
  const [coach, setCoach] = useState<GameMode | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [museumOpen, setMuseumOpen] = useState(false);
  const [classroomOpen, setClassroomOpen] = useState(false);
  /** Victoria del Modo Historia a la espera de la pregunta de Cajal */
  const [storyQuiz, setStoryQuiz] = useState<{ stats: HudSnapshot; base: number } | null>(null);
  const daily = useSession((s) => s.daily);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [gddOpen, setGddOpen] = useState(false);
  const virtualInputRef = useRef({ moveX: 0, moveZ: 0, dashPressed: false });

  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const canvasState: GameAppState = screen === 'menu' ? 'title' : storyState;

  // Contrato del Game Shell: el estado visible en <body data-state>
  useEffect(() => {
    document.body.dataset.state = screen === 'menu' || screen === 'story' ? canvasState : screen;
  }, [screen, canvasState]);

  const toggleMute = useCallback(() => setMuted(soundEngine.toggleMute()), []);

  // Móvil: pausa al cambiar de app y pantalla encendida mientras se juega
  const pauseStory = useCallback(() => setStoryState((s) => (s === 'playing' ? 'paused' : s)), []);
  useAutoPause(screen === 'story' && storyState === 'playing', pauseStory);
  useWakeLock(screen !== 'menu');

  useEffect(() => {
    const apply = (s: ReturnType<typeof useRunStore.getState>['settings']) => Object.assign(feelSettings, s);
    apply(useRunStore.getState().settings);
    return useRunStore.subscribe((st, prev) => { if (st.settings !== prev.settings) apply(st.settings); });
  }, []);

  const startStory = useCallback((idx: number) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    virtualInputRef.current = { moveX: 0, moveZ: 0, dashPressed: false };
    setLevelIndex(idx);
    setOutcome(null);
    setResetSignal((s) => s + 1);
    setStoryState('playing');
    setScreen('story');
  }, []);

  const backToMenu = useCallback(() => {
    setOutcome(null);
    setStoryQuiz(null);
    setStoryState('title');
    setScreen('menu');
    useSession.getState().begin(null);
  }, []);

  const startMode = useCallback(
    (m: PlayId, withCoach: boolean, storyLevel = levelIndex) => {
      setCoach(withCoach && isMainMode(m) ? m : null);
      if (m === 'story') startStory(storyLevel);
      else setScreen(m);
    },
    [levelIndex, startStory],
  );

  /** La primera vez que un alias juega un modo, ve antes el onboarding y luego la guía en partida. */
  const launch = useCallback(
    (m: PlayId, storyLevel?: number) => {
      const p = useProfileStore.getState();
      if (isMainMode(m) && !p.progress[aliasKey(p.playerName)]?.onboarding[m]) setOnboarding({ mode: m, thenStart: true });
      else startMode(m, false, storyLevel);
    },
    [startMode],
  );

  const play = useCallback(() => {
    useSession.getState().begin(null);
    launch(mode);
  }, [mode, launch]);

  /** Desafío Diario: mismo modo, mapa y modificador para todos hoy */
  const playDaily = useCallback(() => {
    const d = dailyChallenge();
    useSession.getState().begin(d);
    setMode(d.mode);
    if (d.mode === 'story') setLevelIndex(d.levelIndex);
    prefetchMode(d.mode);
    launch(d.mode, d.levelIndex);
  }, [launch]);

  const finishOnboarding = useCallback(() => {
    if (!onboarding) return;
    useProfileStore.getState().setOnboardingSeen(onboarding.mode, true);
    setOnboarding(null);
    if (onboarding.thenStart) startMode(onboarding.mode, true, useSession.getState().daily?.mode === 'story' ? useSession.getState().daily!.levelIndex : levelIndex);
  }, [onboarding, startMode, levelIndex]);

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
    useGameStore.getState().setBrainPower(snapshot.brainPower);
  }, []);

  /** Cierra la partida de historia: clasificación, estrellas y ventana de resultado */
  const settleStory = useCallback(
    (kind: 'victory' | 'defeat', stats: HudSnapshot, score: number) => {
      const detail = `${shortName(LEVELS[levelIndex].name)}, ${kind === 'victory' ? 'completado' : 'sin terminar'}`;
      const profile = useProfileStore.getState();
      const rank = finishRun('story', score, detail, kind === 'victory');
      const { stars } = profile.recordStory({
        won: kind === 'victory',
        levelIndex,
        seconds: stats.elapsedTime,
        vitality: stats.vitality,
        maxVitality: stats.maxVitality,
        hazardsHit: stats.hazardsHit,
        habits: stats.synapsesCollected,
      });
      setOutcome({ kind, stats, score, rank, stars });
      setStoryState('gameover');
    },
    [levelIndex],
  );

  const handleStageEnd = useCallback(
    (kind: 'victory' | 'defeat', stats: HudSnapshot) => {
      const base = Math.round((stats.score + (kind === 'victory' ? timeBonus(stats.elapsedTime) : 0)) * activeParams().scoreMult);
      setCoach(null);
      if (kind === 'victory') {
        // antes del resultado, una pregunta de Cajal (acertar suma un 15 %)
        setStoryQuiz({ stats, base });
        setStoryState('gameover');
      } else settleStory(kind, stats, base);
    },
    [settleStory],
  );

  // Solo en desarrollo: permite a las pruebas automáticas terminar un nivel de historia
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __cajalStageEnd?: typeof handleStageEnd }).__cajalStageEnd = handleStageEnd;
  }, [handleStageEnd]);

  // Atajos del Modo Historia
  useEffect(() => {
    if (screen !== 'story') return;
    const onKey = (e: KeyboardEvent) => {
      if (gddOpen || onboarding) return;
      if (storyState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); setStoryState('paused'); }
        else if (e.code === 'KeyM') { e.preventDefault(); toggleMute(); }
        else if (e.code === 'KeyR') { e.preventDefault(); startStory(levelIndex); }
      } else if (storyState === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        setStoryState('playing');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, storyState, gddOpen, onboarding, levelIndex, startStory, toggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#0b1220]">
      {(screen === 'menu' || screen === 'story') && (
        <ErrorBoundary>
          <Canvas3D
            appState={canvasState}
            levelIndex={levelIndex}
            resetSignal={resetSignal}
            virtualInputRef={virtualInputRef}
            onHudUpdate={handleHudUpdate}
            onStageEnd={handleStageEnd}
          />
        </ErrorBoundary>
      )}

      {screen === 'menu' && (
        <MainMenu
          mode={mode}
          onModeChange={(m) => { setMode(m); prefetchMode(m); }}
          levelIndex={levelIndex}
          onLevelChange={setLevelIndex}
          onPlay={play}
          muted={muted}
          onToggleMute={toggleMute}
          onOpenGdd={() => setGddOpen(true)}
          onHowToPlay={() => isMainMode(mode) && setOnboarding({ mode, thenStart: true })}
          onOpenBook={() => setBookOpen(true)}
          onOpenMuseum={() => setMuseumOpen(true)}
          onOpenClassroom={() => setClassroomOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onPlayDaily={playDaily}
          keyboardEnabled={!onboarding && !bookOpen && !settingsOpen && !gddOpen && !museumOpen && !classroomOpen}
        />
      )}

      {screen === 'story' && storyState === 'playing' && (
        <GameHud
          hud={hud}
          level={level}
          muted={muted}
          onToggleMute={toggleMute}
          onPause={() => setStoryState('paused')}
          onRestart={() => startStory(levelIndex)}
          onOpenGdd={() => {
            setStoryState('paused');
            setGddOpen(true);
          }}
          virtualInputRef={virtualInputRef}
        />
      )}

      {screen === 'story' && storyState === 'paused' && !gddOpen && !onboarding && (
        <StoryPauseModal level={level} hud={hud} onResume={() => setStoryState('playing')} onRestart={() => startStory(levelIndex)} onExit={backToMenu} onHelp={() => setOnboarding({ mode: 'story', thenStart: false })} />
      )}

      {screen === 'story' && storyQuiz && !outcome && (
        <CajalQuiz
          reward="points"
          accent="#e8b45a"
          seed={daily?.mode === 'story' ? daily.seed : undefined}
          onDone={(ok) => {
            const q = storyQuiz;
            setStoryQuiz(null);
            settleStory('victory', q.stats, q.base + (ok ? quizPointsBonus(q.base) : 0));
          }}
        />
      )}

      {screen === 'story' && storyState === 'gameover' && outcome && !gddOpen && (
        <StoryOutcomeModal
          outcome={outcome.kind}
          levelIndex={levelIndex}
          stats={outcome.stats}
          finalScore={outcome.score}
          rank={outcome.rank}
          stars={outcome.stars}
          onNext={daily ? undefined : () => startStory(levelIndex + 1)}
          onRetry={() => startStory(levelIndex)}
          onExit={backToMenu}
        />
      )}

      {screen === 'story' && storyState === 'playing' && <StoryCoach hud={hud} active={coach === 'story'} onFinish={() => setCoach(null)} />}

      {screen === 'arcade' && (
        <Suspense fallback={<ModeLoading />}>
        <ArcadeMode
          onExit={backToMenu}
          muted={muted}
          onToggleMute={toggleMute}
          coach={coach === 'arcade'}
          onCoachDone={() => setCoach(null)}
          onHelp={() => setOnboarding({ mode: 'arcade', thenStart: false })}
          helpOpen={!!onboarding}
        />
        </Suspense>
      )}

      {screen === 'maze' && (
        <Suspense fallback={<ModeLoading />}>
        <MazeMode
          onExit={backToMenu}
          muted={muted}
          onToggleMute={toggleMute}
          coach={coach === 'maze'}
          onCoachDone={() => setCoach(null)}
          onHelp={() => setOnboarding({ mode: 'maze', thenStart: false })}
          helpOpen={!!onboarding}
        />
        </Suspense>
      )}

      {(screen === 'micro' || screen === 'build' || screen === 'rhythm') && (
        <Suspense fallback={<ModeLoading />}>
          <LabMode game={screen} onExit={backToMenu} muted={muted} onToggleMute={toggleMute} />
        </Suspense>
      )}

      {onboarding && <OnboardingModal mode={onboarding.mode} onDone={finishOnboarding} />}
      {bookOpen && <TrophyBook onClose={() => setBookOpen(false)} />}
      <Suspense fallback={null}>{museumOpen && <MuseumBook onClose={() => setMuseumOpen(false)} />}</Suspense>
      <Suspense fallback={null}>{classroomOpen && <ClassroomPanel onClose={() => setClassroomOpen(false)} />}</Suspense>
      {settingsOpen && <SettingsPanel muted={muted} onToggleMute={toggleMute} onClose={() => setSettingsOpen(false)} />}
      <TrophyToasts />

      <Suspense fallback={null}>{gddOpen && <GddModal isOpen={gddOpen} onClose={() => setGddOpen(false)} />}</Suspense>
    </main>
  );
}
