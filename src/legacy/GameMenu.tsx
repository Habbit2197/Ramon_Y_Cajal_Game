/**
 * GameMenu.tsx — Pantalla de Inicio / Menú Principal del Juego
 *
 * Flujo:
 * - Renderiza un overlay HTML (Tailwind CSS, position: absolute, z-index: 50) cuando gameState === 'menu'.
 * - Solicita el Nombre del Jugador mediante un input de texto.
 * - Botón "Purificar Red" que almacena el nombre en Zustand y arranca la simulación con startGame().
 */

import React, { useState } from 'react';
import { useLegacyGameStore as useGameStore } from './legacyGameStore';
import { Sparkles, Brain, Zap, Shield, Play } from 'lucide-react';

export const GameMenu: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const playerName = useGameStore((s) => s.playerName);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const startGame = useGameStore((s) => s.startGame);

  const [inputName, setInputName] = useState(playerName || '');
  const [error, setError] = useState(false);

  if (gameState !== 'menu') return null;

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = inputName.trim() || 'Neuro-Explorador';
    setPlayerName(finalName);
    startGame();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md select-none pointer-events-auto">
      <div className="w-full max-w-lg bg-neutral-950/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Insignia / Cabecera */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium tracking-widest uppercase shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Cajal: Sinapsis 3D · Nivel {currentLevel}
        </div>

        <div>
          <h1 className="text-3xl sm:text-5xl font-serif font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 drop-shadow-md">
            El Jardín de las Neuronas
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 font-serif italic max-w-md mx-auto">
            «Todo ser humano puede ser, si se lo propone, escultor de su propio cerebro.»
          </p>
        </div>

        {/* Formulario de Entrada de Nombre */}
        <form onSubmit={handleStart} className="space-y-4 text-left">
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-amber-300/90 mb-1.5 pl-1"
            >
              Nombre del Investigador / Jugador:
            </label>
            <div className="relative">
              <input
                id="player-name-input"
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="Ej. Santiago, Clara, Alex..."
                maxLength={24}
                autoFocus
                className="w-full px-4 py-3 rounded-2xl bg-neutral-900/90 border border-neutral-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-white placeholder-neutral-500 text-sm font-medium transition-all outline-none"
              />
              <Brain className="absolute right-3.5 top-3.5 w-4 h-4 text-neutral-500 pointer-events-none" />
            </div>
          </div>

          {/* Guía rápida de controles */}
          <div className="grid grid-cols-2 gap-2.5 py-1 text-[11px] text-neutral-400">
            <div className="flex items-center gap-2 bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span><strong>WASD</strong>: Mover Núcleo</span>
            </div>
            <div className="flex items-center gap-2 bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800">
              <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span><strong>Espacio</strong>: Disparar</span>
            </div>
          </div>

          {/* Botón Principal: Purificar Red */}
          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-serif font-bold text-base tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all transform active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-black" />
            Purificar Red
          </button>
        </form>

        <div className="text-[11px] text-neutral-500 font-mono">
          Nivel Actual: <span className="text-amber-400 font-bold">{currentLevel}</span> · Físicas Rapier Activas
        </div>
      </div>
    </div>
  );
};

export default GameMenu;
