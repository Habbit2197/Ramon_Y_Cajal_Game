/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — Punto de entrada del Roguelite Twin-Stick Cajal: Sinapsis 3D
 *
 * Conecta el pipeline 3D en React Three Fiber (App3D) con la interfaz
 * reactiva a 10 Hz (RogueliteHUD), pantalla de inicio, draft y fin de partida.
 */

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { App3D } from './App3D';
import { RogueliteHUD } from './components/ui/RogueliteHUD';
import { TitleScreen } from './components/ui/TitleScreen';
import { DraftModal } from './components/ui/DraftModal';
import { GameOverModal } from './components/ui/GameOverModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRunStore } from './store/useRunStore';
import { soundEngine } from './game/sound';

const GddModalLazy = React.lazy(() =>
  import('./components/GddModal').then((m) => ({ default: m.GddModal }))
);

export default function App() {
  const phase = useRunStore((s) => s.phase);
  const setPhase = useRunStore((s) => s.setPhase);

  const [muted, setMuted] = useState(false);
  const [gddOpen, setGddOpen] = useState(false);

  // Sincronizar dataset.state en document.body para styling global / shaders
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMute();
    setMuted(next);
  }, []);

  const handlePause = useCallback(() => {
    if (phase === 'playing') {
      setPhase('paused');
    } else if (phase === 'paused') {
      setPhase('playing');
    }
  }, [phase, setPhase]);

  // Atajos de teclado globales (Mute [M], GDD [G], Pausa [P / Escape])
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
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phase === 'playing' || phase === 'paused') {
          e.preventDefault();
          handlePause();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gddOpen, phase, handleToggleMute, handlePause]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#03050c]">
      <ErrorBoundary>
        <Suspense fallback={null}>
          <App3D />
        </Suspense>
      </ErrorBoundary>

      {/* HUD activo durante juego y pausa */}
      {phase !== 'title' && (
        <RogueliteHUD
          onPause={handlePause}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Pantalla de inicio de tinción de Golgi */}
      <TitleScreen
        onOpenGdd={() => setGddOpen(true)}
        muted={muted}
        onToggleMute={handleToggleMute}
      />

      {/* Draft de Neuroplasticidad entre oleadas */}
      <DraftModal />

      {/* Modal de Fin de Partida */}
      <GameOverModal />

      {/* Modal GDD */}
      <Suspense fallback={null}>
        <GddModalLazy isOpen={gddOpen} onClose={() => setGddOpen(false)} />
      </Suspense>
    </main>
  );
}
