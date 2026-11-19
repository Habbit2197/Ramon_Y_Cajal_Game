/**
 * RogueliteHUD.tsx — Interfaz de usuario de alto rendimiento a 10 Hz
 *
 * REGLA DE RENDIMIENTO TDD:
 * Los valores numéricos dinámicos (Vitalidad, BrainPower, XP, Cooldown de Dash)
 * se escriben directamente en refs del DOM cada 100 ms (10 Hz).
 * NUNCA provocan re-renderizados de React a 60 Hz.
 */

import React, { useEffect, useRef } from 'react';
import { world } from '../../engine/world';
import { useRunStore } from '../../store/useRunStore';
import { Heart, Brain, Zap, Shield, Pause, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../../game/sound';

const REGION_NAMES = ['Corteza Prefrontal', 'Hipocampo', 'Cerebelo'];

export function RogueliteHUD({
  onPause,
  muted,
  onToggleMute,
}: {
  onPause: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const bpBarRef = useRef<HTMLDivElement>(null);
  const ultBarRef = useRef<HTMLDivElement>(null);
  const bpTextRef = useRef<HTMLSpanElement>(null);
  const xpBarRef = useRef<HTMLDivElement>(null);
  const lvlTextRef = useRef<HTMLSpanElement>(null);
  const vitTextRef = useRef<HTMLSpanElement>(null);
  const waveTextRef = useRef<HTMLSpanElement>(null);
  const dashBarRef = useRef<HTMLDivElement>(null);
  const shieldIconRef = useRef<HTMLDivElement>(null);

  // Intervalo desacoplado a 10 Hz (100 ms) para mutar el DOM sin reconciliación de React
  useEffect(() => {
    const timer = setInterval(() => {
      const p = world.player;
      const s = useRunStore.getState();

      // BrainPower
      if (bpBarRef.current) {
        bpBarRef.current.style.width = `${Math.max(0, Math.min(100, p.brainPower))}%`;
      }
      if (bpTextRef.current) {
        bpTextRef.current.textContent = `${Math.round(p.brainPower)}%`;
      }

      // XP & Nivel
      if (xpBarRef.current) {
        const pct = Math.max(0, Math.min(100, (s.xp / (s.xpToNext || 1)) * 100));
        xpBarRef.current.style.width = `${pct}%`;
      }
      if (lvlTextRef.current) {
        lvlTextRef.current.textContent = `NIVEL ${s.level}`;
      }

      // Vitalidad
      if (vitTextRef.current) {
        vitTextRef.current.textContent = `${p.vitality} / ${p.mods.maxVitality}`;
      }

      // Oleada y Región
      if (waveTextRef.current) {
        const rName = REGION_NAMES[s.region] ?? 'Corteza';
        waveTextRef.current.textContent = s.endless ? `Modo infinito, oleada ${s.wave + 1}` : `${rName}, oleada ${s.wave + 1}/5`;
      }

      // Dash Cooldown
      if (dashBarRef.current) {
        const cd = p.dashCooldown;
        const maxCd = 1.2 * p.mods.dashCdMult;
        const readyPct = cd <= 0 ? 100 : Math.max(0, (1 - cd / maxCd) * 100);
        dashBarRef.current.style.width = `${readyPct}%`;
      }

      // Ola de Potenciación
      if (ultBarRef.current) {
        ultBarRef.current.style.width = `${p.ultCharge}%`;
        ultBarRef.current.parentElement!.parentElement!.dataset.ready = p.ultCharge >= 100 ? 'true' : 'false';
      }

      // Escudo
      if (shieldIconRef.current) {
        shieldIconRef.current.style.opacity = p.shieldActive ? '1' : '0.25';
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between safe-pad safe-pad-sm">
      {/* Barra superior: Vitalidad, Región y Ajustes */}
      <div className="flex items-start justify-between w-full">
        {/* Vitalidad y Escudo */}
        <div className="flex items-center gap-3 bg-neutral-950/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-neutral-800 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1.5 text-rose-400">
            <Heart className="w-5 h-5 fill-rose-500/30 text-rose-400 animate-pulse" />
            <span ref={vitTextRef} className="font-mono text-sm sm:text-base font-bold text-white whitespace-nowrap">
              3 / 3
            </span>
          </div>

          <div
            ref={shieldIconRef}
            className="flex items-center text-emerald-400 border-l border-neutral-800 pl-2.5 transition-opacity"
            style={{ opacity: 0.25 }}
            title="Escudo Glial"
          >
            <Shield className="w-4 h-4 fill-emerald-500/20" />
          </div>
        </div>

        {/* Región y Oleada central */}
        <div className="bg-neutral-950/80 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-amber-500/30 shadow-lg text-center">
          <span
            ref={waveTextRef}
            className="whitespace-nowrap font-serif text-[0.7rem] sm:text-sm font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400"
          >
            Corteza Prefrontal · Oleada 1/5
          </span>
        </div>

        {/* Botones de Pausa y Sonido */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-xl bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors shadow-md"
            title={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
          </button>
          <button
            onClick={onPause}
            className="p-2.5 rounded-xl bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors shadow-md"
            title="Pausa"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra inferior: BrainPower (Salud Mental) y Barra de XP (Neurotrofinas BDNF) */}
      <div className="w-full max-w-xl pointer-coarse:landscape:max-w-[min(36rem,calc(100vw-22rem))] mx-auto flex flex-col gap-2 pointer-events-auto mb-1">
        {/* Medidor de BrainPower */}
        <div className="bg-neutral-950/85 backdrop-blur-md p-2.5 rounded-2xl border border-neutral-800 shadow-xl">
          <div className="flex items-center justify-between text-xs mb-1.5 px-1">
            <span className="flex items-center gap-1.5 text-cyan-300 font-semibold uppercase tracking-wider text-[11px]">
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              Salud Sináptica (BrainPower)
            </span>
            <span ref={bpTextRef} className="font-mono font-bold text-cyan-200">
              100%
            </span>
          </div>
          <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800">
            <div
              ref={bpBarRef}
              className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-sky-300 rounded-full transition-all duration-100 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Medidor de Neurotrofinas XP y Cooldown de Dash */}
        <div className="flex items-center gap-3">
          {/* XP */}
          <div className="flex-1 bg-neutral-950/85 backdrop-blur-md p-2 rounded-xl border border-neutral-800 shadow-lg">
            <div className="flex items-center justify-between text-[10px] mb-1 px-1">
              <span
                ref={lvlTextRef}
                className="font-bold text-amber-300 uppercase tracking-wider"
              >
                NIVEL 1
              </span>
              <span className="text-neutral-400">BDNF / Neurotrofina</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                ref={xpBarRef}
                className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-100"
                style={{ width: '0%' }}
              />
            </div>
          </div>

          {/* Dash Ready Indicator */}
          <div className="bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 shadow-lg flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <div className="w-14 h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                ref={dashBarRef}
                className="h-full bg-amber-400 rounded-full transition-all duration-75"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Ola de Potenciación: se carga con neurotrofinas, se lanza con E */}
          <div
            title="Ola de Potenciación (E)"
            className="ult-meter bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 shadow-lg flex items-center gap-2"
          >
            <span className="text-[0.7rem] font-semibold text-cyan-300">Ola</span>
            <div className="w-14 h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div ref={ultBarRef} className="h-full bg-cyan-300 rounded-full" style={{ width: '0%' }} />
            </div>
            <span className="text-[0.7rem] text-neutral-400 hidden sm:inline">E</span>
          </div>
        </div>
      </div>
    </div>
  );
}
