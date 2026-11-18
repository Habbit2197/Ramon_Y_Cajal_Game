/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — Flujo Principal del Juego Cajal: Sinapsis 3D
 *
 * Arquitectura:
 * - ErrorBoundary & Suspense envolviendo el <Canvas> para prevenir pantallazos negros.
 * - Escena 3D (Scene.tsx): Renderiza entorno de fondo en 'menu' y activa físicas/entidades en 'playing'.
 * - GameMenu (UI HTML): Overlay en 'menu' para capturar el nombre del jugador y botón "Purificar Red".
 * - HUD en combate activo con estadísticas de BrainPower, nivel actual y puntaje.
 */

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/3d/Scene';
import { GameMenu } from './components/ui/GameMenu';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useGameStore } from './store/useGameStore';
import { soundEngine } from './game/sound';
import { Brain, Heart, Volume2, VolumeX, RotateCcw, BookOpen, Pause, Play } from 'lucide-react';

const GddModalLazy = React.lazy(() =>
  import('./components/GddModal').then((m) => ({ default: m.GddModal }))
);

export default function App() {
  const gameState = useGameStore((s) => s.gameState);
  const playerName = useGameStore((s) => s.playerName);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const brainPower = useGameStore((s) => s.brainPower);
  const score = useGameStore((s) => s.score);
  const startGame = useGameStore((s) => s.startGame);
  const gameOver = useGameStore((s) => s.gameOver);

  const [muted, setMuted] = useState(false);
  const [gddOpen, setGddOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Sincronizar dataset.state en document.body
  useEffect(() => {
    document.body.dataset.state = isPaused ? 'paused' : gameState;
  }, [gameState, isPaused]);

  // Si el BrainPower llega a 0 en combate, activar Game Over
  useEffect(() => {
    if (gameState === 'playing' && brainPower <= 0) {
      gameOver();
    }
  }, [brainPower, gameState, gameOver]);

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMute();
    setMuted(next);
  }, []);

  // Atajos de teclado globales (Mute [M], GDD [G], Pausa [P/Escape])
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
        if (gameState === 'playing') {
          e.preventDefault();
          setIsPaused((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gddOpen, gameState, handleToggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-[#080d19]">
      {/* 
        REQUISITO FASE 3: <Canvas> envuelto en <Suspense fallback={null}> y ErrorBoundary
        para prevenir pantallazos negros si un recurso o shader tarda en cargar.
      */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Canvas
            camera={{ position: [0, 16, 12], fov: 48, near: 0.1, far: 120 }}
            shadows
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
            }}
            style={{ width: '100%', height: '100%', display: 'block', background: '#080d19' }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </Suspense>
      </ErrorBoundary>

      {/* FASE 2: Pantalla de inicio GameMenu (UI HTML sobre el Canvas cuando gameState === 'menu') */}
      <GameMenu />

      {/* HUD activo durante el juego (gameState === 'playing') */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 sm:p-6">
          {/* Barra Superior del HUD */}
          <div className="flex items-center justify-between w-full">
            {/* Información del Jugador y Nivel */}
            <div className="bg-neutral-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-neutral-800 shadow-xl flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <span className="font-serif font-bold text-sm sm:text-base text-white">
                  {playerName || 'Investigador'}
                </span>
              </div>
              <div className="h-4 w-px bg-neutral-800" />
              <div className="text-xs font-mono font-bold text-amber-300">
                NIVEL {currentLevel}
              </div>
            </div>

            {/* Puntos y Botones de Control */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="bg-neutral-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-neutral-800 text-xs font-mono font-bold text-cyan-300">
                PTS: {score}
              </div>
              <button
                onClick={handleToggleMute}
                className="p-2.5 rounded-xl bg-neutral-950/85 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors shadow-md"
                title={muted ? 'Activar Sonido' : 'Silenciar'}
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
              </button>
              <button
                onClick={() => setIsPaused((p) => !p)}
                className="p-2.5 rounded-xl bg-neutral-950/85 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors shadow-md"
                title="Pausar"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra Inferior del HUD: Medidor de Salud Cerebral (BrainPower) */}
          <div className="w-full max-w-md mx-auto bg-neutral-950/85 backdrop-blur-md p-3 rounded-2xl border border-neutral-800 shadow-2xl">
            <div className="flex items-center justify-between text-xs mb-1.5 px-1">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
                Salud Sináptica (BrainPower)
              </span>
              <span className="font-mono font-bold text-cyan-200">
                {Math.round(brainPower)}%
              </span>
            </div>
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-sky-300 rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                style={{ width: `${Math.max(0, Math.min(100, brainPower))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Fin de Partida (gameState === 'gameover') */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg select-none">
          <div className="w-full max-w-md bg-neutral-950/95 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Brain className="w-8 h-8 text-rose-400" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Fatiga Sináptica Total
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Las toxinas saturaron los circuitos de la red. Ramón y Cajal nos recuerda que la plasticidad cerebral permite siempre volver a empezar.
            </p>

            <div className="bg-neutral-900/80 rounded-2xl p-4 border border-neutral-800 grid grid-cols-2 gap-3 text-center">
              <div>
                <span className="text-[11px] text-neutral-400 block uppercase">Nivel Alcanzado</span>
                <span className="text-xl font-mono font-bold text-amber-300">{currentLevel}</span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block uppercase">Puntaje Final</span>
                <span className="text-xl font-mono font-bold text-cyan-300">{score}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => startGame()}
                className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs uppercase tracking-wider shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar
              </button>
              <button
                onClick={() => useGameStore.setState({ gameState: 'menu' })}
                className="py-3.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pausa */}
      {isPaused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-neutral-950/95 border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-serif font-bold text-white">Simulación en Pausa</h3>
            <p className="text-xs text-neutral-400">
              Procesos sinápticos congelados temporalmente.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Continuar
              </button>
              <button
                onClick={() => {
                  setIsPaused(false);
                  startGame();
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Reiniciar Nivel
              </button>
              <button
                onClick={() => {
                  setIsPaused(false);
                  useGameStore.setState({ gameState: 'menu' });
                }}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-400 font-medium text-xs transition-colors cursor-pointer"
              >
                Volver al Menú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Documento GDD cargado bajo demanda */}
      <Suspense fallback={null}>
        {gddOpen && <GddModalLazy isOpen={gddOpen} onClose={() => setGddOpen(false)} />}
      </Suspense>
    </main>
  );
}
