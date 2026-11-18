/**
 * DraftModal.tsx — Selector de cartas de mejora (Draft de Neuroplasticidad)
 *
 * Muestra las 3 opciones de mejora con la paleta de tinción de Golgi (oro y ámbar),
 * nombres científicos rigurosos y metáforas de juego legibles.
 * Compatible con controles táctiles en móvil (touch targets generosos).
 */

import { motion } from 'motion/react';
import { useRunStore } from '../../store/useRunStore';
import { UPGRADES, type UpgradeId, type Rarity } from '../../game/upgrades';
import { Sparkles, RefreshCw, Zap } from 'lucide-react';

const RARITY_COLORS: Record<Rarity, { border: string; bg: string; text: string; badge: string }> = {
  common: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/40',
    text: 'text-amber-200',
    badge: 'bg-amber-600/30 text-amber-300 border-amber-500/40',
  },
  rare: {
    border: 'border-cyan-500/50',
    bg: 'bg-cyan-950/40',
    text: 'text-cyan-200',
    badge: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40',
  },
  legendary: {
    border: 'border-amber-400',
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-100',
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold border-amber-300',
  },
  evolution: {
    border: 'border-purple-400',
    bg: 'bg-purple-950/50',
    text: 'text-purple-100',
    badge: 'bg-gradient-to-r from-purple-500 to-indigo-400 text-white font-bold border-purple-300',
  },
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  legendary: 'Legendaria',
  evolution: 'Evolución Sináptica',
};

export function DraftModal() {
  const phase = useRunStore((s) => s.phase);
  const offer = useRunStore((s) => s.offer);
  const rerolls = useRunStore((s) => s.rerolls);
  const pick = useRunStore((s) => s.pick);
  const reroll = useRunStore((s) => s.reroll);
  const level = useRunStore((s) => s.level);
  const region = useRunStore((s) => s.region);

  if (phase !== 'draft' && phase !== 'regionClear') return null;

  const isRegionClear = phase === 'regionClear';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-4xl flex flex-col items-center"
      >
        {/* Cabecera del Draft */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-medium tracking-wide uppercase mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {isRegionClear ? `Región ${region + 1} Asimilada` : `Nivel ${level} Alcanzado`}
          </div>
          <h2 className="text-2xl sm:text-4xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500">
            {isRegionClear ? 'Potenciación Regional de Cajal' : 'Potenciación Sináptica'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-lg">
            {isRegionClear
              ? 'Elige una adaptación neurobiológica profunda para la siguiente estructura cerebral.'
              : 'Selecciona una modificación estructural para reforzar las vías de conducción de tu red.'}
          </p>
        </div>

        {/* Las 3 Cartas del Draft */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {offer.map((id: UpgradeId, idx) => {
            const card = UPGRADES[id];
            if (!card) return null;
            const theme = RARITY_COLORS[card.rarity];

            return (
              <motion.button
                key={id}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => pick(id)}
                className={`relative flex flex-col justify-between text-left p-5 rounded-2xl border-2 ${theme.border} ${theme.bg} shadow-xl backdrop-blur-sm transition-all duration-150 cursor-pointer group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[11px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badge}`}
                    >
                      {RARITY_LABELS[card.rarity]}
                    </span>
                    <Zap className="w-4 h-4 text-amber-400/60 group-hover:text-amber-300 transition-colors" />
                  </div>

                  <h3 className="text-lg sm:text-xl font-serif font-bold text-white group-hover:text-amber-200 transition-colors mb-2">
                    {card.name}
                  </h3>

                  <p className="text-sm font-medium text-emerald-300 mb-3 leading-snug">
                    {card.description}
                  </p>

                  <div className="border-t border-neutral-700/60 pt-2.5 mt-2">
                    <p className="text-xs text-neutral-400 italic font-serif leading-relaxed">
                      «{card.scientificIdea}»
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-amber-500/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider group-hover:underline">
                    Asimilar modificación →
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Botón de Reroll si no es regionClear */}
        {!isRegionClear && rerolls > 0 && (
          <div className="mt-6">
            <button
              onClick={reroll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-600/50 text-neutral-300 hover:text-white text-xs font-medium tracking-wide transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reorganizar sinapsis ({rerolls} restante)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
