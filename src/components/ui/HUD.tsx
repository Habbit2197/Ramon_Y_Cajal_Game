import React from 'react';
import { motion } from 'motion/react';
import { useGameStore } from '../../store/useGameStore';

interface HUDProps {
  onPowerChange?: (nextPower: number) => void;
}

/**
 * Overlay de interfaz flotante animado con `framer-motion` y conectado al store global
 * de Zustand (`useGameStore`). Permite visualizar y probar en tiempo real `increasePower`
 * y `decreasePower` (0% - 100%) junto al nivel de desaturación (`uDesaturation`) del shader.
 */
export const HUD: React.FC<HUDProps> = ({ onPowerChange }) => {
  const brainPower = useGameStore((state) => state.brainPower);
  const increasePower = useGameStore((state) => state.increasePower);
  const decreasePower = useGameStore((state) => state.decreasePower);

  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  const handleIncrease = () => {
    increasePower(15);
    const updated = useGameStore.getState().brainPower;
    onPowerChange?.(updated);
  };

  const handleDecrease = () => {
    decreasePower(15);
    const updated = useGameStore.getState().brainPower;
    onPowerChange?.(updated);
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="Zustand BrainPower Control"
      className="pointer-events-auto bg-[#111621]/95 border border-[#d4a359]/45 rounded-xl px-3.5 py-2.5 shadow-xl text-[#f4efe6] flex items-center gap-3"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#d4a359]">
          Zustand Store · Red Neuronal
        </span>
        <div className="flex items-baseline gap-2 font-mono tabular-nums">
          <span data-testid="zustand-brain-power" className="text-sm font-bold text-[#ffd166]">
            {Math.round(brainPower)}%
          </span>
          <span className="text-[11px] text-slate-400">
            uDesaturation: {uDesaturation.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            handleDecrease();
          }}
          title="Simular impacto neurotóxico (-15% BrainPower)"
          className="px-2 py-1 bg-red-950/80 hover:bg-red-900/90 text-red-200 border border-red-500/40 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          -15%
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            handleIncrease();
          }}
          title="Simular hábito neurotrófico (+15% BrainPower)"
          className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          +15%
        </button>
      </div>
    </motion.aside>
  );
};

export default HUD;
