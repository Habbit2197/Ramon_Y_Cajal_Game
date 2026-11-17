import React, { useState } from 'react';
import {
  ENGINE_COMPARISON,
  INITIAL_TYPESCRIPT_SCRIPT,
  PROJECT_SCAFFOLDING,
} from '../game/gddData';
import { ITEM_CATALOG, LEVELS } from '../game/rules';

interface GddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GddTab = 'core-loop' | 'levels' | 'stack' | 'scaffolding' | 'script';

export const GddModal: React.FC<GddModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GddTab>('core-loop');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gdd-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 pointer-events-auto"
    >
      <div className="bg-[#121722] border border-[#d4a359]/60 rounded-2xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-[#f4efe6]">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#0d1117]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#d4a359]">
              Documento de Diseño del Juego (GDD) y Arquitectura Técnica
            </span>
            <h2 id="gdd-modal-title" className="text-xl md:text-2xl font-bold font-display text-white">
              Cajal: El Jardín de las Neuronas (Sinapsis 3D)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar documento GDD"
            className="px-4 py-2 bg-[#1e2638] hover:bg-[#2a354d] text-[#f4efe6] border border-white/15 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Volver al Juego [Esc]
          </button>
        </div>

        {/* Navigation Tabs for the 5 Requested Sections */}
        <div className="flex items-center gap-1.5 px-6 py-3 bg-[#0f141d] border-b border-white/10 overflow-x-auto">
          {[
            { id: 'core-loop', label: '1. Core Loop y Mecánicas' },
            { id: 'levels', label: '2. Niveles y Diálogos de Cajal' },
            { id: 'stack', label: '3. Motor y Stack (Godot vs Three.js)' },
            { id: 'scaffolding', label: '4. Estructura (Scaffolding)' },
            { id: 'script', label: '5. Primer Script (BrainPower 3D)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as GddTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#d4a359] text-[#0d1117]'
                  : 'bg-[#182030] text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm leading-relaxed">
          {activeTab === 'core-loop' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold font-display text-[#ffd166] mb-2">
                  1. Core Loop y Mecánicas Neuro-Físicas
                </h3>
                <p className="text-slate-300">
                  El jugador controla a un joven estudiante en una avenida tridimensional vista en tercera
                  persona con cámara amortiguada exponencialmente. Su objetivo en cada nivel es esculpir su{' '}
                  <strong className="text-white">Red Neuronal (Potencial Cerebral / BrainPower)</strong>{' '}
                  desde el valor inicial hasta el <strong className="text-emerald-300">100%</strong> y cruzar
                  el Portal Sináptico custodiado por <strong className="text-amber-300">Santiago Ramón y Cajal</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#182030] border border-white/10 rounded-xl p-4">
                  <h4 className="font-bold text-[#ffd166] mb-1.5">Locomoción e Impulso</h4>
                  <p className="text-xs text-slate-300">
                    Movimiento continuo en el plano XZ (`WASD` / Flechas / D-Pad táctil) con velocidad base
                    de `9.0 m/s` y habilidad de <strong className="text-white">Impulso Sináptico</strong> (`Espacio`,
                    multiplicador `2.15x` durante `0.24s`) para esquivar embestidas de toxinas.
                  </p>
                </div>
                <div className="bg-[#182030] border border-white/10 rounded-xl p-4">
                  <h4 className="font-bold text-emerald-300 mb-1.5">Estímulos Neurotróficos (Buenos)</h4>
                  <p className="text-xs text-slate-300">
                    El agua, la fruta antioxidante, las nueces (Omega-3) y los libros de ciencia incrementan
                    el <strong className="text-white">Potencial Cerebral (+15% a +25%)</strong>, hacen crecer la
                    Corona Dendrítica 3D sobre la cabeza del niño y aceleran la velocidad de movimiento hasta un `128%`.
                  </p>
                </div>
                <div className="bg-[#182030] border border-white/10 rounded-xl p-4">
                  <h4 className="font-bold text-red-400 mb-1.5">Neurotoxinas y Penalización Física</h4>
                  <p className="text-xs text-slate-300">
                    Colisionar con humo de tabaco, comida ultraprocesada o alcohol aplica un `hitstop` de `55ms`,
                    resta <strong className="text-white">-12% a -18% de BrainPower</strong>, reduce la velocidad
                    física (`0.48x–0.62x`) y degrada el factor de inercia (`inertiaDrag = 0.32`), simulando
                    fatiga por hipoxia o pérdida de equilibrio cerebeloso.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-[#d4a359] mb-3">
                  Tabla de Objetos Interactivos y Modificadores Físicos
                </h4>
                <div className="overflow-x-auto border border-white/10 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0d1117] text-slate-300 border-b border-white/10">
                        <th className="p-3">Objeto 3D</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">BrainPower Δ</th>
                        <th className="p-3">Velocidad Física</th>
                        <th className="p-3">Control / Inercia</th>
                        <th className="p-3">Efecto Neurobiológico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 font-mono tabular-nums">
                      {Object.values(ITEM_CATALOG).map((item) => (
                        <tr key={item.subType} className="bg-[#151c2a]">
                          <td className="p-3 font-sans font-semibold text-white">{item.label}</td>
                          <td className="p-3 font-sans">
                            {item.category === 'healthy' ? (
                              <span className="text-emerald-300">Hábito Saludable</span>
                            ) : (
                              <span className="text-red-400">Agente Nocivo</span>
                            )}
                          </td>
                          <td className="p-3 font-bold">
                            {item.brainDelta > 0 ? `+${item.brainDelta}%` : `${item.brainDelta}%`}
                          </td>
                          <td className="p-3">{Math.round(item.speedMultiplier * 100)}% ({item.effectDuration}s)</td>
                          <td className="p-3">{Math.round(item.inertiaDrag * 100)}% precisión</td>
                          <td className="p-3 font-sans text-slate-300">{item.scientificNote}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'levels' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold font-display text-[#ffd166] mb-1">
                  2. Diseño de Niveles y Narrativa de Santiago Ramón y Cajal
                </h3>
                <p className="text-xs text-slate-300">
                  Tres niveles cotidianos con progresión de dificultad y diálogos educativos redactados
                  con el rigor científico y tono humanista de Santiago Ramón y Cajal (Premio Nobel de Medicina, 1906).
                </p>
              </div>

              <div className="space-y-4">
                {LEVELS.map((lvl) => (
                  <div
                    key={lvl.id}
                    className="bg-[#182030] border border-[#d4a359]/35 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-base font-bold font-display text-white">{lvl.name}</h4>
                      <span className="text-xs text-[#d4a359]">{lvl.subtitle}</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      <strong className="text-white">Introducción de Cajal:</strong> {lvl.cajalIntroQuote}
                    </p>
                    <div className="bg-[#0f141d] border border-white/10 rounded-lg p-3.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1">
                        {lvl.cajalVictoryTitle}
                      </div>
                      <p className="text-xs text-[#f4efe6] italic leading-relaxed">
                        {lvl.cajalVictoryDialogue}
                      </p>
                    </div>
                    <p className="text-xs text-amber-200/90">
                      <strong>Cápsula Científica:</strong> {lvl.neuroscienceFact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stack' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold font-display text-[#ffd166] mb-1">
                  3. Elección de Motor y Stack: Godot 4 vs. Three.js + React + TypeScript
                </h3>
                <p className="text-xs text-slate-300">
                  Para un videojuego educativo 3D con despliegue simultáneo en{' '}
                  <strong className="text-white">Web, Móvil (iOS/Android), PC y Mac</strong>, recomendamos{' '}
                  <strong className="text-emerald-300">Three.js + React + TypeScript (con Vite + Tauri/Capacitor)</strong>.
                </p>
              </div>

              <div className="overflow-x-auto border border-white/10 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0d1117] text-slate-300 border-b border-white/10">
                      <th className="p-3">Criterio Técnico</th>
                      <th className="p-3 text-emerald-300">Three.js + React + TypeScript</th>
                      <th className="p-3 text-amber-300">Godot Engine 4 (GDScript)</th>
                      <th className="p-3">Veredicto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {ENGINE_COMPARISON.map((row) => (
                      <tr key={row.criterion} className="bg-[#151c2a]">
                        <td className="p-3 font-bold text-white">{row.criterion}</td>
                        <td className="p-3 text-slate-200">{row.threeReactStack}</td>
                        <td className="p-3 text-slate-300">{row.godot4Stack}</td>
                        <td className="p-3 font-semibold text-[#ffd166]">{row.verdict}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'scaffolding' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold font-display text-[#ffd166]">
                    4. Estructura de Código Recomendada (Scaffolding)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Arquitectura modular desacoplando reglas puras (`src/game/rules.ts`), renderizador WebGL (`Canvas3D.tsx`) y capa UI/HUD.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(PROJECT_SCAFFOLDING, 'scaffolding')}
                  className="px-3 py-1.5 bg-[#1e2638] hover:bg-[#2a354d] border border-[#d4a359]/40 rounded-lg text-xs font-semibold text-[#ffd166] cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'scaffolding' ? '¡Copiado!' : 'Copiar Estructura'}
                </button>
              </div>
              <pre className="bg-[#0a0d14] border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                {PROJECT_SCAFFOLDING}
              </pre>
            </div>
          )}

          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold font-display text-[#ffd166]">
                    5. Primer Script: Movimiento 3D, Físicas y Colisión de BrainPower
                  </h3>
                  <p className="text-xs text-slate-300">
                    Implementación en TypeScript + Three.js con delta-clamping, amortiguación exponencial de inercia y clamp `[0, 100]` de `BrainPower`.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(INITIAL_TYPESCRIPT_SCRIPT, 'script')}
                  className="px-3 py-1.5 bg-[#1e2638] hover:bg-[#2a354d] border border-[#d4a359]/40 rounded-lg text-xs font-semibold text-[#ffd166] cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'script' ? '¡Script Copiado!' : 'Copiar Script TypeScript'}
                </button>
              </div>
              <pre className="bg-[#0a0d14] border border-white/10 rounded-xl p-4 text-xs font-mono text-sky-200 overflow-x-auto leading-relaxed">
                {INITIAL_TYPESCRIPT_SCRIPT}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
