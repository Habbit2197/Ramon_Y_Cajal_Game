import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HudSnapshot } from './Canvas3D';
import { LevelConfig } from '../game/rules';

interface GameHudProps {
  hud: HudSnapshot;
  level: LevelConfig;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onOpenGdd: () => void;
  virtualInputRef: React.MutableRefObject<{ moveX: number; moveZ: number; dashPressed: boolean }>;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  level,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  onOpenGdd,
  virtualInputRef,
}) => {
  const [ghostBrainPower, setGhostBrainPower] = useState(hud.brainPower);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Delayed trailing ghost bar when BrainPower drops or rises
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGhostBrainPower(hud.brainPower);
    }, 320);
    return () => clearTimeout(timer);
  }, [hud.brainPower]);

  const speedPct = Math.round(hud.speedModifier * 100);
  const isSlowed = hud.speedModifier < 0.95;
  const isBoosted = hud.speedModifier > 1.05;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 md:p-6">
      {/* TOP PERIMETER ROW: Top-Left Neural Cluster & Top-Right Utility Controls */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Cluster: BrainPower (Red Neuronal), Vitality Pips & Speed Physics */}
        <div
          className="pointer-events-auto bg-[#111621]/95 border border-[#d4a359]/45 rounded-xl p-3.5 shadow-2xl max-w-sm w-full"
          aria-label="Panel de estado neuronal"
        >
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2">
              {/* Custom Code-Authored Histological Neuron SVG */}
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" fill="#0b0f17" stroke="#d4a359" strokeWidth="1.5" />
                <path
                  d="M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="3.5" fill="#ffd166" />
              </svg>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#d4a359]">
                Potencial Cerebral
              </span>
            </div>
            <div
              data-testid="brain-power-readout"
              className="text-2xl md:text-3xl font-bold font-mono tabular-nums text-[#ffd166] hud-stroke leading-none"
            >
              {Math.round(hud.brainPower)}%
            </div>
          </div>

          {/* BrainPower Progress Bar with Trailing Ghost Bar */}
          <div className="relative h-3.5 w-full bg-[#090c12] rounded-lg overflow-hidden border border-[#d4a359]/30 mb-3">
            {/* Ghost trailing bar */}
            <div
              className="absolute inset-y-0 left-0 bg-[#ef4444]/60 transition-all duration-500"
              style={{ width: `${Math.max(hud.brainPower, ghostBrainPower)}%` }}
            />
            {/* Primary synaptic gold/cyan bar */}
            <div
              className="absolute inset-y-0 left-0 bg-[#eab308] transition-all duration-150"
              style={{
                width: `${hud.brainPower}%`,
                backgroundColor: hud.portalUnlocked ? '#34d399' : '#eab308',
              }}
            />
          </div>

          {/* Bottom Row of Cluster: Vitality Sockets + Speed Physics Multiplier + Score */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            {/* Discrete Vitality Pips (Full / Cracked / Empty Hollow Socket) */}
            <div className="flex items-center gap-1" aria-label={`Vitalidad ${hud.vitality} de ${hud.maxVitality}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                Salud
              </span>
              {Array.from({ length: hud.maxVitality }).map((_, idx) => {
                const isFull = idx < hud.vitality;
                const isWarning = isFull && hud.vitality === 1;
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    {/* Outer dark socket silhouette */}
                    <polygon
                      points="12,2 21,7 21,17 12,22 3,17 3,7"
                      fill={isFull ? (isWarning ? '#dc2626' : '#10b981') : '#161c28'}
                      stroke={isFull ? '#a7f3d0' : '#475569'}
                      strokeWidth="1.8"
                    />
                    {isFull ? (
                      <circle cx="12" cy="12" r="3.2" fill="#ecfdf5" />
                    ) : (
                      <path d="M8 8l8 8M16 8l-8 8" stroke="#475569" strokeWidth="1.5" />
                    )}
                  </svg>
                );
              })}
            </div>

            {/* Live Physics Speed Modifier, Cognitive Fatigue Shader & Blend Tree State Readout */}
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
              <span className="text-[10px] uppercase text-slate-400">Fatiga</span>
              <span
                data-testid="cognitive-fatigue-readout"
                className={
                  hud.cognitiveFatiguePct > 50
                    ? 'text-slate-300 font-bold'
                    : 'text-emerald-300 font-bold'
                }
              >
                {Math.round(hud.cognitiveFatiguePct)}%
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-[10px] uppercase text-slate-400">Ritmo</span>
              <span
                className={
                  isSlowed
                    ? 'text-red-400 font-bold'
                    : isBoosted
                    ? 'text-emerald-300 font-bold'
                    : 'text-slate-200 font-semibold'
                }
              >
                {speedPct}%
              </span>
              <span className="text-slate-600">·</span>
              <span
                data-testid="anim-state-readout"
                className={
                  hud.animState === 'Hit'
                    ? 'text-red-400 font-bold'
                    : hud.animState === 'Run'
                    ? 'text-sky-300 font-bold'
                    : hud.animState === 'Victory'
                    ? 'text-emerald-300 font-bold'
                    : 'text-amber-300 font-semibold'
                }
              >
                {hud.animState}
              </span>
            </div>
          </div>

          {hud.activeEffectName && (
            <div className="mt-2 text-[11px] font-medium text-amber-200/90 truncate">
              Efecto activo: {hud.activeEffectName} ({hud.effectTimer.toFixed(0)}s)
            </div>
          )}
        </div>

        {/* Top-Right Cluster: Level Indicator & Utility Square SVG Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end bg-[#111621]/95 border border-[#d4a359]/40 rounded-lg px-3 py-1.5 mr-1">
            <span className="text-[10px] uppercase tracking-wider text-[#d4a359] font-semibold">
              Nivel {level.id} de 3
            </span>
            <span className="text-xs font-semibold text-[#f4efe6] whitespace-nowrap">
              {level.name.replace(/^Nivel \d+:\s*/, '')}
            </span>
          </div>

          {/* GDD / Technical Docs Button [G] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenGdd();
            }}
            aria-label="Abrir Documento GDD y Arquitectura Técnica"
            title="Documento GDD y Código [G]"
            className="h-10 px-3 bg-[#111621]/95 hover:bg-[#1e2638] text-[#ffd166] border border-[#d4a359]/50 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>GDD [G]</span>
          </button>

          {/* Mute Toggle [M] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
            title="Sonido [M]"
            className="w-10 h-10 bg-[#111621]/95 hover:bg-[#1e2638] text-[#f4efe6] border border-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-red-400" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Restart [R] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            aria-label="Reiniciar nivel"
            title="Reiniciar [R]"
            className="w-10 h-10 bg-[#111621]/95 hover:bg-[#1e2638] text-[#f4efe6] border border-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          {/* Pause [P] */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pausar juego"
            title="Pausa [P / Esc]"
            className="w-10 h-10 bg-[#111621]/95 hover:bg-[#1e2638] text-[#f4efe6] border border-white/15 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* BOTTOM UNIFIED DOCK: Collapsible Cajal Mentor Plaque & Mobile Touch Controls */}
      <div className="flex flex-col items-center gap-2">
        {/* Mobile Touch Controls (Visible on small screens) */}
        <div className="pointer-events-auto flex md:hidden items-center justify-between w-full max-w-sm px-2 mb-1">
          <div className="grid grid-cols-3 gap-1.5">
            <div />
            <button
              type="button"
              aria-label="Mover adelante"
              onPointerDown={() => {
                virtualInputRef.current.moveZ = -1;
              }}
              onPointerUp={() => {
                virtualInputRef.current.moveZ = 0;
              }}
              onPointerLeave={() => {
                virtualInputRef.current.moveZ = 0;
              }}
              className="w-12 h-12 bg-[#111621]/90 border border-[#d4a359]/40 rounded-lg text-white font-bold flex items-center justify-center active:bg-[#d4a359]/30"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              aria-label="Mover izquierda"
              onPointerDown={() => {
                virtualInputRef.current.moveX = -1;
              }}
              onPointerUp={() => {
                virtualInputRef.current.moveX = 0;
              }}
              onPointerLeave={() => {
                virtualInputRef.current.moveX = 0;
              }}
              className="w-12 h-12 bg-[#111621]/90 border border-[#d4a359]/40 rounded-lg text-white font-bold flex items-center justify-center active:bg-[#d4a359]/30"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Mover atrás"
              onPointerDown={() => {
                virtualInputRef.current.moveZ = 1;
              }}
              onPointerUp={() => {
                virtualInputRef.current.moveZ = 0;
              }}
              onPointerLeave={() => {
                virtualInputRef.current.moveZ = 0;
              }}
              className="w-12 h-12 bg-[#111621]/90 border border-[#d4a359]/40 rounded-lg text-white font-bold flex items-center justify-center active:bg-[#d4a359]/30"
            >
              ▼
            </button>
            <button
              type="button"
              aria-label="Mover derecha"
              onPointerDown={() => {
                virtualInputRef.current.moveX = 1;
              }}
              onPointerUp={() => {
                virtualInputRef.current.moveX = 0;
              }}
              onPointerLeave={() => {
                virtualInputRef.current.moveX = 0;
              }}
              className="w-12 h-12 bg-[#111621]/90 border border-[#d4a359]/40 rounded-lg text-white font-bold flex items-center justify-center active:bg-[#d4a359]/30"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            aria-label="Disparo Sináptico"
            onClick={() => {
              virtualInputRef.current.dashPressed = true;
              window.dispatchEvent(new CustomEvent('trigger-touch-shoot'));
            }}
            className="h-14 px-4 bg-[#d4a359] text-[#0d1117] font-bold rounded-xl shadow-lg active:scale-95 text-xs uppercase tracking-wider"
          >
            Disparo
          </button>
        </div>

        {/* Collapsible Cajal Mentor Drawer Toggle */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-3xl">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setDockCollapsed((prev) => !prev);
            }}
            className="px-3 py-1 bg-[#111621]/95 border border-b-0 border-[#d4a359]/40 rounded-t-lg text-[11px] font-medium text-[#d4a359] hover:text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? '▴ Mostrar Guía de Ramón y Cajal' : '▾ Ocultar Guía'}
          </button>

          {!dockCollapsed && (
            <div className="w-full bg-[#111621]/95 border border-[#d4a359]/50 rounded-xl p-3.5 shadow-2xl flex items-center gap-3.5">
              {/* Cajal Histological Emblem Avatar */}
              <div className="w-11 h-11 rounded-lg bg-[#1d2433] border border-[#d4a359]/50 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 36 36" className="w-8 h-8" aria-hidden="true">
                  <circle cx="18" cy="14" r="6" fill="#f1c27d" />
                  <path d="M10 9h16l-2-5H12z" fill="#1e222d" />
                  <path d="M13 18h10l-5 8z" fill="#e5e7eb" />
                  <circle cx="15.5" cy="13.5" r="1.8" fill="none" stroke="#d4a359" strokeWidth="1.2" />
                  <circle cx="20.5" cy="13.5" r="1.8" fill="none" stroke="#d4a359" strokeWidth="1.2" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#ffd166] whitespace-nowrap">
                    Santiago Ramón y Cajal · Mentor
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono text-slate-400 whitespace-nowrap">
                    {hud.portalUnlocked
                      ? '¡Portal Sináptico Activo!'
                      : 'Meta: 100% Potencial Cerebral'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#f4efe6] leading-snug">
                  {hud.cajalBannerText}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
