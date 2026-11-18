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
import { ArcadeMode } from './modes/ArcadeMode';
import { LEVELS } from './game/rules';
import { soundEngine } from './game/sound';
import { useGameStore } from './store/useGameStore';
import { useProfileStore, aliasKey, type GameMode } from './store/useProfileStore';
import { useRunStore } from './store/useRunStore';
import { feelSettings } from './engine/feel';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { StoryCoach } from './components/onboarding/Coach';
import { TrophyBook } from './components/menu/TrophyBook';
import { TrophyToasts } from './components/menu/TrophyToasts';
import { SettingsPanel } from './components/menu/SettingsPanel';

const GddModal = lazy(() => import('./components/GddModal').then((m) => ({ default: m.GddModal })));

type Screen = 'menu' | 'story' | 'arcade';

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

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<GameMode>('story');
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [gddOpen, setGddOpen] = useState(false);
  const virtualInputRef = useRef({ moveX: 0, moveZ: 0, dashPressed: false });

  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const canvasState: GameAppState = screen === 'menu' ? 'title' : storyState;

  // Contrato del Game Shell: el estado visible en <body data-state>
  useEffect(() => {
    document.body.dataset.state = screen === 'arcade' ? 'arcade' : canvasState;
  }, [screen, canvasState]);

  const toggleMute = useCallback(() => setMuted(soundEngine.toggleMute()), []);

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
    setStoryState('title');
    setScreen('menu');
  }, []);

  const startMode = useCallback(
    (m: GameMode, withCoach: boolean) => {
      setCoach(withCoach ? m : null);
      if (m === 'story') startStory(levelIndex);
      else setScreen('arcade');
    },
    [levelIndex, startStory],
  );

  /** La primera vez que un alias juega un modo, ve antes el onboarding y luego la guía en partida. */
  const play = useCallback(() => {
    const p = useProfileStore.getState();
    const seen = p.progress[aliasKey(p.playerName)]?.onboarding[mode];
    if (!seen) setOnboarding({ mode, thenStart: true });
    else startMode(mode, false);
  }, [mode, startMode]);

  const finishOnboarding = useCallback(() => {
    if (!onboarding) return;
    useProfileStore.getState().setOnboardingSeen(onboarding.mode, true);
    setOnboarding(null);
    if (onboarding.thenStart) startMode(onboarding.mode, true);
  }, [onboarding, startMode]);

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
    useGameStore.getState().setBrainPower(snapshot.brainPower);
  }, []);

  const handleStageEnd = useCallback(
    (kind: 'victory' | 'defeat', stats: HudSnapshot) => {
      const score = stats.score + (kind === 'victory' ? timeBonus(stats.elapsedTime) : 0);
      const detail = `${shortName(LEVELS[levelIndex].name)}, ${kind === 'victory' ? 'completado' : 'sin terminar'}`;
      const profile = useProfileStore.getState();
      const rank = profile.submitScore('story', score, detail);
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
      setCoach(null);
      setStoryState('gameover');
    },
    [levelIndex],
  );

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
      {screen !== 'arcade' && (
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
          onModeChange={setMode}
          levelIndex={levelIndex}
          onLevelChange={setLevelIndex}
          onPlay={play}
          muted={muted}
          onToggleMute={toggleMute}
          onOpenGdd={() => setGddOpen(true)}
          onHowToPlay={() => setOnboarding({ mode, thenStart: true })}
          onOpenBook={() => setBookOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          keyboardEnabled={!onboarding && !bookOpen && !settingsOpen && !gddOpen}
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

      {screen === 'story' && storyState === 'gameover' && outcome && !gddOpen && (
        <StoryOutcomeModal
          outcome={outcome.kind}
          levelIndex={levelIndex}
          stats={outcome.stats}
          finalScore={outcome.score}
          rank={outcome.rank}
          stars={outcome.stars}
          onNext={() => startStory(levelIndex + 1)}
          onRetry={() => startStory(levelIndex)}
          onExit={backToMenu}
        />
      )}

      {screen === 'story' && storyState === 'playing' && <StoryCoach hud={hud} active={coach === 'story'} onFinish={() => setCoach(null)} />}

      {screen === 'arcade' && (
        <ArcadeMode
          onExit={backToMenu}
          muted={muted}
          onToggleMute={toggleMute}
          coach={coach === 'arcade'}
          onCoachDone={() => setCoach(null)}
          onHelp={() => setOnboarding({ mode: 'arcade', thenStart: false })}
          helpOpen={!!onboarding}
        />
      )}

      {onboarding && <OnboardingModal mode={onboarding.mode} onDone={finishOnboarding} />}
      {bookOpen && <TrophyBook onClose={() => setBookOpen(false)} />}
      {settingsOpen && <SettingsPanel muted={muted} onToggleMute={toggleMute} onClose={() => setSettingsOpen(false)} />}
      <TrophyToasts />

      <Suspense fallback={null}>{gddOpen && <GddModal isOpen={gddOpen} onClose={() => setGddOpen(false)} />}</Suspense>
    </main>
  );
}
