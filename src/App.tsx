/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — Punto de entrada unificado para Cajal: Sinapsis 3D
 *
 * Arquitectura:
 * - Runtime principal: App3D (React Three Fiber + Rapier physics + Postprocessing)
 * - Estado de juego: useRunStore (Zustand de baja frecuencia con persistencia de meta)
 * - HUD desacoplado a 10 Hz (RogueliteHUD)
 * - Modales: DraftModal, GameOverModal, TitleScreen, y GddModal (React.lazy)
 * - Modo heredado (?legacy=1): Mantiene Canvas3D intacto para compatibilidad
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRunStore } from './store/useRunStore';
import { App3D } from './App3D';
import { TitleScreen } from './components/ui/TitleScreen';
import { RogueliteHUD } from './components/ui/RogueliteHUD';
import { DraftModal } from './components/ui/DraftModal';
import { GameOverModal } from './components/ui/GameOverModal';
import { soundEngine } from './game/sound';
import { Canvas3D, HudSnapshot } from './components/Canvas3D';
import { GameHud } from './components/GameHud';
import { LEVELS } from './game/rules';

const GddModalLazy = React.lazy(() =>
  import('./components/GddModal').then((m) => ({ default: m.GddModal }))
);

const INITIAL_LEGACY_HUD: HudSnapshot = {
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

export default function App() {
  const isLegacy =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('legacy') === '1';

  // ── Estado Roguelite Moderno (Zustand) ──
  const phase = useRunStore((s) => s.phase);
  const setPhase = useRunStore((s) => s.setPhase);
  const newRun = useRunStore((s) => s.newRun);

  // ── Estado UI y Modales ──
  const [muted, setMuted] = useState<boolean>(false);
  const [gddOpen, setGddOpen] = useState<boolean>(false);

  // ── Fallback Legacy State (solo si ?legacy=1) ──
  const [legacyState, setLegacyState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [legacyHud, setLegacyHud] = useState<HudSnapshot>(INITIAL_LEGACY_HUD);
  const virtualInputRef = React.useRef({ moveX: 0, moveZ: 0, dashPressed: false });

  // Sincronizar data-state en document.body para tests e inspectores
  useEffect(() => {
    document.body.dataset.state = isLegacy ? legacyState : phase;
  }, [isLegacy, legacyState, phase]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Atajos de teclado globales
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gddOpen) {
        if (e.code === 'Escape' || e.code === 'KeyG') {
          e.preventDefault();
          setGddOpen(false);
        }
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.code === 'KeyG') {
        e.preventDefault();
        setGddOpen(true);
      }

      if (!isLegacy) {
        if (phase === 'title') {
          if (e.code === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            newRun();
          }
        } else if (phase === 'playing') {
          if (e.code === 'Escape' || e.code === 'KeyP') {
            e.preventDefault();
            setPhase('paused');
          }
        } else if (phase === 'paused') {
          if (e.code === 'Escape' || e.code === 'KeyP') {
            e.preventDefault();
            setPhase('playing');
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gddOpen, handleToggleMute, isLegacy, newRun, phase, setPhase]);

  // ── MODO HEREDADO (CANVAS3D) ──
  if (isLegacy) {
    return (
      <main className="relative w-screen h-screen overflow-hidden select-none bg-black">
        <Canvas3D
          appState={legacyState}
          levelIndex={0}
          resetSignal={0}
          virtualInputRef={virtualInputRef}
          onHudUpdate={setLegacyHud}
          onStageEnd={() => setLegacyState('gameover')}
        />
        {legacyState === 'playing' && (
          <GameHud
            hud={legacyHud}
            level={LEVELS[0]}
            muted={muted}
            onToggleMute={handleToggleMute}
            onPause={() => setLegacyState('paused')}
            onRestart={() => setLegacyState('playing')}
            onOpenGdd={() => setGddOpen(true)}
            virtualInputRef={virtualInputRef}
          />
        )}
        <Suspense fallback={null}>
          {gddOpen && <GddModalLazy isOpen={gddOpen} onClose={() => setGddOpen(false)} />}
        </Suspense>
      </main>
    );
  }

  // ── MODO ROGUELITE MODERNO: R3F + RAPIER + POSTPROCESSING ──
  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#03050c]">
      {/* Viewport 3D Único con Rapier y Shader Pipeline */}
      <App3D />

      {/* Pantalla de Título */}
      {phase === 'title' && (
        <TitleScreen
          onOpenGdd={() => setGddOpen(true)}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* HUD en Combate Activo (desacoplado a 10 Hz) */}
      {phase === 'playing' && (
        <RogueliteHUD
          onPause={() => setPhase('paused')}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Draft de Mejoras y Evoluciones Sinápticas */}
      {(phase === 'draft' || phase === 'regionClear') && <DraftModal />}

      {/* Fin de Partida / Victoria / Derrota */}
      {phase === 'gameover' && <GameOverModal />}

      {/* Modal de Pausa */}
      {phase === 'paused' && !gddOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-neutral-950/90 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-serif font-bold text-white">Simulación Pausada</h3>
            <p className="text-xs text-neutral-400">
              La actividad sináptica y los procesos metabólicos se encuentran temporalmente detenidos.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setPhase('playing')}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors cursor-pointer"
              >
                Reanudar Sinapsis
              </button>
              <button
                onClick={() => setGddOpen(true)}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Cuaderno de Cajal [G]
              </button>
              <button
                onClick={() => newRun()}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Reiniciar Partida
              </button>
              <button
                onClick={() => setPhase('title')}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 font-medium text-xs transition-colors cursor-pointer"
              >
                Salir al Menú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documento de Diseño GDD y Cuaderno de Cajal cargado bajo demanda */}
      <Suspense fallback={null}>
        {gddOpen && <GddModalLazy isOpen={gddOpen} onClose={() => setGddOpen(false)} />}
      </Suspense>
    </main>
  );
}
