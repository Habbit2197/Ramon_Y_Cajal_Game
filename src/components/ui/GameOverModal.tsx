/**
 * GameOverModal.tsx — Pantalla de fin de partida (Victoria / Muerte Sináptica)
 *
 * Muestra el balance de la partida, los datos descubiertos para el Cuaderno de Cajal
 * y citas históricas auténticas del Premio Nobel de Medicina de 1906.
 */

import { motion } from 'motion/react';
import { useRunStore, REGIONS } from '../../store/useRunStore';
import { RotateCcw, Award, BookOpen, Brain } from 'lucide-react';

const CAJAL_DEFEAT_QUOTES = [
  '«Todo ser humano puede ser, si se lo propone, escultor de su propio cerebro.» — Santiago Ramón y Cajal',
  '«Las neuronas son células de formas delicadas y elegantes, las misteriosas mariposas del alma.» — Santiago Ramón y Cajal',
  '«El cerebro es un mundo consistente en incontables continentes inexplorados y grandes extensiones de territorio desconocido.» — Santiago Ramón y Cajal',
];

export function GameOverModal() {
  const phase = useRunStore((s) => s.phase);
  const region = useRunStore((s) => s.region);
  const wave = useRunStore((s) => s.wave);
  const level = useRunStore((s) => s.level);
  const fichas = useRunStore((s) => s.fichas);
  const newRun = useRunStore((s) => s.newRun);
  const setPhase = useRunStore((s) => s.setPhase);

  if (phase !== 'gameover') return null;

  const quote = CAJAL_DEFEAT_QUOTES[region % CAJAL_DEFEAT_QUOTES.length];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg bg-neutral-950/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
      >
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
          <Brain className="w-8 h-8 text-amber-400" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-2">
          Fin de la Conducción
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          La red neuronal ha alcanzado su límite de fatiga metabólica frente a las toxinas.
        </p>

        {/* Resumen numérico */}
        <div className="grid grid-cols-3 gap-3 bg-neutral-900/80 rounded-2xl p-4 border border-neutral-800 mb-6">
          <div className="text-center">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Región</span>
            <span className="text-lg font-serif font-bold text-amber-300">
              {region + 1} / 3
            </span>
          </div>
          <div className="text-center border-x border-neutral-800">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Nivel</span>
            <span className="text-lg font-mono font-bold text-cyan-300">
              {level}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider block">Fichas</span>
            <span className="text-lg font-mono font-bold text-yellow-400">
              +{fichas}
            </span>
          </div>
        </div>

        {/* Cita de Cajal */}
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 mb-6 text-left">
          <p className="text-xs sm:text-sm text-amber-200/90 italic font-serif leading-relaxed">
            {quote}
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => newRun()}
            className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-semibold text-sm tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar Sinapsis
          </button>
          <button
            onClick={() => setPhase('title')}
            className="py-3 px-5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-medium text-sm transition-all active:scale-95 cursor-pointer"
          >
            Menú Principal
          </button>
        </div>
      </motion.div>
    </div>
  );
}
