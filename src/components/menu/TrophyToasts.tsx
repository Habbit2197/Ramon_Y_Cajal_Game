/**
 * TrophyToasts.tsx — Aviso flotante al conseguir una medalla. Muestra la cola de uno en uno.
 */
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../../store/useToastStore';
import { soundEngine } from '../../game/sound';
import { Medal } from './TrophyBook';

export function TrophyToasts() {
  const current = useToastStore((s) => s.queue[0]);
  const shift = useToastStore((s) => s.shift);

  useEffect(() => {
    if (!current) return;
    if (current.kind === 'trophy') soundEngine.playPortalReady();
    const t = window.setTimeout(shift, 3800);
    return () => window.clearTimeout(t);
  }, [current, shift]);

  return (
    <div aria-live="polite" style={{ top: "max(1rem, env(safe-area-inset-top))" }} className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-[min(92vw,26rem)]">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 bg-[#121a2a]/95 border border-[#e8b45a]/50 shadow-[0_12px_40px_-12px_rgba(232,180,90,0.5)]"
            onClick={shift}
          >
            <Medal color="#e8b45a" locked={false} size={40} />
            <div className="min-w-0">
              <div className="text-xs text-[#e8b45a]">{current.kind === 'trophy' ? 'Medalla conseguida' : 'Aviso'}</div>
              <div className="font-semibold text-white truncate">{current.title}</div>
              <div className="text-xs text-[#c9c2b4] truncate">{current.body}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
