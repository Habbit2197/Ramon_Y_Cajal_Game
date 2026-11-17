/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas3D, GameAppState, HudSnapshot } from './components/Canvas3D';
import { GameHud } from './components/GameHud';
import { GddModal } from './components/GddModal';
import { LEVELS } from './game/rules';
import { soundEngine } from './game/sound';

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
};

export default function App() {
  const [appState, setAppState] = useState<GameAppState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const [levelIndex, setLevelIndex] = useState<number>(0);
  const [highestReachedStage, setHighestReachedStage] = useState<number>(2); // All 3 levels inspectable & playable
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [endOutcome, setEndOutcome] = useState<'victory' | 'defeat'>('victory');
  const [finalStats, setFinalStats] = useState<HudSnapshot>(INITIAL_HUD);
  const [bestScore, setBestScore] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [gddOpen, setGddOpen] = useState<boolean>(false);

  const virtualInputRef = useRef({ moveX: 0, moveZ: 0, dashPressed: false });
  const currentLevel = LEVELS[levelIndex] || LEVELS[0];

  // Mirror state to document.body.dataset.state per Game Shell contract
  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  const startGame = useCallback(
    (targetLevelIdx?: number) => {
      if (typeof targetLevelIdx === 'number') {
        setLevelIndex(targetLevelIdx);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      virtualInputRef.current = { moveX: 0, moveZ: 0, dashPressed: false };
      setResetSignal((s) => s + 1);
      document.body.dataset.state = 'playing';
      setAppState('playing');
    },
    []
  );

  const handleHudUpdate = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
  }, []);

  const handleStageEnd = useCallback(
    (outcome: 'victory' | 'defeat', snapshot: HudSnapshot) => {
      setEndOutcome(outcome);
      setFinalStats(snapshot);
      setBestScore((prev) => Math.max(prev, snapshot.score));
      if (outcome === 'victory') {
        setHighestReachedStage((prev) => Math.max(prev, Math.min(LEVELS.length - 1, levelIndex + 1)));
      }
      document.body.dataset.state = 'gameover';
      setAppState('gameover');
    },
    [levelIndex]
  );

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleRestart = useCallback(() => {
    startGame(levelIndex);
  }, [levelIndex, startGame]);

  // Global keyboard shortcuts for Title-to-Start, Pause [P/Esc], GDD [G], Mute [M], Restart [R]
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gddOpen) {
        if (e.code === 'Escape' || e.code === 'KeyG') {
          e.preventDefault();
          setGddOpen(false);
        }
        return;
      }

      if (appState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame(levelIndex);
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          setGddOpen(true);
        }
      } else if (appState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          document.body.dataset.state = 'paused';
          setAppState('paused');
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          document.body.dataset.state = 'paused';
          setAppState('paused');
          setGddOpen(true);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          handleToggleMute();
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          handleRestart();
        }
      } else if (appState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          document.body.dataset.state = 'playing';
          setAppState('playing');
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          setGddOpen(true);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appState, gddOpen, handleRestart, handleToggleMute, levelIndex, startGame]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* Isolated 60fps Three.js WebGL Viewport */}
      <Canvas3D
        appState={appState}
        levelIndex={levelIndex}
        resetSignal={resetSignal}
        virtualInputRef={virtualInputRef}
        onHudUpdate={handleHudUpdate}
        onStageEnd={handleStageEnd}
      />

      {/* Active Gameplay HUD */}
      {appState === 'playing' && (
        <GameHud
          hud={hud}
          level={currentLevel}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={() => {
            document.body.dataset.state = 'paused';
            setAppState('paused');
          }}
          onRestart={handleRestart}
          onOpenGdd={() => {
            document.body.dataset.state = 'paused';
            setAppState('paused');
            setGddOpen(true);
          }}
          virtualInputRef={virtualInputRef}
        />
      )}

      {/* TITLE SCREEN OVERLAY (Asymmetric Left-Third Composition over Calm Negative Space) */}
      {appState === 'title' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-12 bg-gradient-to-r from-[#090d14]/92 via-[#090d14]/65 to-transparent">
          <div className="pointer-events-auto max-w-xl space-y-6 my-auto">
            {/* Bespoke Inline SVG Title Emblem Lockup */}
            <div className="space-y-3">
              <svg
                viewBox="0 0 460 112"
                className="w-full max-w-md h-auto overflow-visible"
                role="img"
                aria-label="Cajal: Sinapsis 3D — El Jardín de las Neuronas"
              >
                {/* Histological Dendrite Crest Emblem */}
                <g transform="translate(8, 12)">
                  <circle cx="42" cy="42" r="38" fill="#121824" stroke="#d4a359" strokeWidth="2.5" />
                  <circle cx="42" cy="42" r="31" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 3" />
                  {/* Synaptic Branches */}
                  <path
                    d="M42 14v56M14 42h56M22 22l40 40M62 22L22 62"
                    stroke="#d4a359"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="42" cy="42" r="9" fill="#ffd166" />
                  <circle cx="42" cy="14" r="3.5" fill="#38bdf8" />
                  <circle cx="42" cy="70" r="3.5" fill="#38bdf8" />
                  <circle cx="14" cy="42" r="3.5" fill="#34d399" />
                  <circle cx="70" cy="42" r="3.5" fill="#34d399" />
                </g>

                {/* Display Lockup Lettering */}
                <text
                  x="104"
                  y="46"
                  fill="#ffd166"
                  fontFamily="Fraunces, Georgia, serif"
                  fontWeight="700"
                  fontSize="34"
                  letterSpacing="0.02em"
                >
                  CAJAL: SINAPSIS 3D
                </text>
                <text
                  x="106"
                  y="74"
                  fill="#f4efe6"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  fontWeight="600"
                  fontSize="15"
                  letterSpacing="0.08em"
                >
                  EL JARDÍN DE LAS NEURONAS
                </text>
                <line x1="106" y1="86" x2="430" y2="86" stroke="#d4a359" strokeWidth="1.2" strokeOpacity="0.55" />
              </svg>

              <p className="text-sm md:text-base text-slate-200 max-w-lg leading-relaxed">
                Acompaña a <strong className="text-[#ffd166]">Santiago Ramón y Cajal</strong> en una aventura
                educativa 3D. Toma decisiones saludables para elevar tu{' '}
                <strong className="text-emerald-300">Potencial Cerebral al 100%</strong> y esquiva las neurotoxinas.
              </p>
            </div>

            {/* Level Selector (3 Everyday Stages) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#d4a359]">
                Selecciona Escenario Educativo
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {LEVELS.map((lvl, idx) => {
                  const selected = idx === levelIndex;
                  const locked = idx > highestReachedStage;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      disabled={locked}
                      onClick={() => setLevelIndex(idx)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#1c2536] border-[#ffd166] text-white shadow-lg'
                          : 'bg-[#111621]/90 border-white/15 text-slate-300 hover:border-[#d4a359]/60'
                      }`}
                    >
                      <div className="text-[11px] font-mono uppercase text-[#d4a359]">
                        Nivel {lvl.id}
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {lvl.name.replace(/^Nivel \d+:\s*/, '')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary CTA + GDD Technical Spec CTA (<= 3 Menu Actions Total) */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={() => startGame(levelIndex)}
                className="px-7 py-3.5 bg-[#d4a359] hover:bg-[#e3b56b] text-[#0d1117] font-bold text-sm md:text-base rounded-xl shadow-xl transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                Iniciar Sinapsis
              </button>

              <button
                type="button"
                onClick={() => setGddOpen(true)}
                className="px-5 py-3.5 bg-[#151c2a] hover:bg-[#1f293d] text-[#ffd166] border border-[#d4a359]/55 font-semibold text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Ver GDD y Arquitectura [G]
              </button>
            </div>
          </div>

          {/* Single Flat Control-Hint Line in Bottom Safe Margin */}
          <div className="text-xs font-mono text-slate-300/90 tracking-wide">
            WASD / Flechas Mover · Espacio Impulso Sináptico · G Documento GDD · P Pausa
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {appState === 'paused' && !gddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75 pointer-events-auto"
        >
          <div className="bg-[#121722] border border-[#d4a359]/55 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl text-[#f4efe6]">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#d4a359]">
                Simulación en Pausa
              </span>
              <h2 id="pause-modal-title" className="text-2xl font-bold font-display text-white">
                {currentLevel.name}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center bg-[#0d1117] p-3.5 rounded-xl border border-white/10 font-mono tabular-nums">
              <div>
                <div className="text-[10px] uppercase text-slate-400">Red Neuronal</div>
                <div className="text-lg font-bold text-[#ffd166]">{hud.brainPower}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Hábitos</div>
                <div className="text-lg font-bold text-emerald-300">{hud.synapsesCollected}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Puntos</div>
                <div className="text-lg font-bold text-white">{hud.score}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'playing';
                  setAppState('playing');
                }}
                className="w-full py-3 bg-[#d4a359] hover:bg-[#e3b56b] text-[#0d1117] font-bold rounded-xl text-sm cursor-pointer"
              >
                Continuar Exploración
              </button>
              <button
                type="button"
                onClick={() => setGddOpen(true)}
                className="w-full py-2.5 bg-[#182030] hover:bg-[#222d42] text-[#ffd166] border border-[#d4a359]/40 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Ver Documento de Diseño (GDD) y Script 3D
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="py-2.5 bg-[#182030] hover:bg-[#222d42] text-slate-200 border border-white/10 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Reiniciar Nivel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    document.body.dataset.state = 'title';
                    setAppState('title');
                  }}
                  className="py-2.5 bg-[#182030] hover:bg-[#222d42] text-slate-200 border border-white/10 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Menú Principal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / GAME OVER MODAL WITH SANTIAGO RAMÓN Y CAJAL EDUCATIONAL DIALOGUE */}
      {appState === 'gameover' && !gddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-modal-title"
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/80 pointer-events-auto"
        >
          <div className="bg-[#121722] border border-[#d4a359]/60 rounded-2xl max-w-xl w-full p-6 md:p-7 space-y-5 shadow-2xl text-[#f4efe6]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    endOutcome === 'victory' ? 'text-emerald-300' : 'text-red-400'
                  }`}
                >
                  {endOutcome === 'victory'
                    ? '¡Red Neuronal al 100% · Nivel Completado!'
                    : 'Fatiga Sináptica · Inténtalo de Nuevo'}
                </span>
                <h2 id="outcome-modal-title" className="text-2xl font-bold font-display text-white mt-0.5">
                  {endOutcome === 'victory'
                    ? currentLevel.cajalVictoryTitle
                    : `Reflexión de Cajal en ${currentLevel.name}`}
                </h2>
              </div>
            </div>

            {/* Cajal Educational Dialogue Box */}
            <div className="bg-[#0d1117] border border-[#d4a359]/45 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#ffd166]">
                Mentor Santiago Ramón y Cajal:
              </div>
              <p className="text-xs md:text-sm text-[#f4efe6] italic leading-relaxed">
                {endOutcome === 'victory'
                  ? currentLevel.cajalVictoryDialogue
                  : '«No te desanimes, joven científico. El humo del tabaco, el alcohol y el exceso de azúcares apagan el oxígeno y enlentecen tus reflejos, pero el cerebro posee una cualidad maravillosa llamada neuroplasticidad: cada vez que eliges agua pura, fruta y aire limpio, tus dendritas vuelven a brotar con más fuerza.»'}
              </p>
              <div className="pt-2 border-t border-white/10 text-[11px] text-amber-200/90">
                <strong>Apunte Neurocientífico:</strong> {currentLevel.neuroscienceFact}
              </div>
            </div>

            {/* Tabular-Nums Mastery Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center bg-[#182030] p-3.5 rounded-xl border border-white/10 font-mono tabular-nums">
              <div>
                <div className="text-[10px] uppercase text-slate-400">Potencial Cerebral</div>
                <div className="text-lg font-bold text-[#ffd166]">{finalStats.brainPower}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Tiempo</div>
                <div className="text-lg font-bold text-white">{Math.round(finalStats.elapsedTime)}s</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400">Puntuación / Récord</div>
                <div className="text-lg font-bold text-emerald-300">
                  {finalStats.score} / {bestScore}
                </div>
              </div>
            </div>

            {/* Primary Action CTAs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {endOutcome === 'victory' && levelIndex < LEVELS.length - 1 ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startGame(levelIndex + 1)}
                  className="flex-1 py-3 px-5 bg-[#d4a359] hover:bg-[#e3b56b] text-[#0d1117] font-bold rounded-xl text-sm cursor-pointer whitespace-nowrap"
                >
                  Siguiente Nivel: {LEVELS[levelIndex + 1].name.replace(/^Nivel \d+:\s*/, '')}
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => startGame(levelIndex)}
                  className="flex-1 py-3 px-5 bg-[#d4a359] hover:bg-[#e3b56b] text-[#0d1117] font-bold rounded-xl text-sm cursor-pointer whitespace-nowrap"
                >
                  {endOutcome === 'victory' ? 'Jugar de Nuevo' : 'Reintentar Nivel'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setGddOpen(true)}
                className="py-3 px-4 bg-[#182030] hover:bg-[#222d42] text-[#ffd166] border border-[#d4a359]/40 font-semibold rounded-xl text-xs cursor-pointer whitespace-nowrap"
              >
                Ver GDD y Código
              </button>

              <button
                type="button"
                onClick={() => {
                  document.body.dataset.state = 'title';
                  setAppState('title');
                }}
                className="py-3 px-4 bg-[#182030] hover:bg-[#222d42] text-slate-200 border border-white/10 font-semibold rounded-xl text-xs cursor-pointer whitespace-nowrap"
              >
                Título
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive GDD & Technical Architecture Modal */}
      <GddModal isOpen={gddOpen} onClose={() => setGddOpen(false)} />
    </main>
  );
}
