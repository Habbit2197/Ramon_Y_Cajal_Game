/**
 * TitleScreen.tsx — Pantalla de inicio con estética de tinción de Golgi (oro y ámbar)
 */

import { motion } from 'motion/react';
import { useRunStore } from '../../store/useRunStore';
import { Play, BookOpen, Volume2, VolumeX, Shield, Zap, Sparkles } from 'lucide-react';

export function TitleScreen({
  onOpenGdd,
  muted,
  onToggleMute,
}: {
  onOpenGdd: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const phase = useRunStore((s) => s.phase);
  const newRun = useRunStore((s) => s.newRun);
  const fichas = useRunStore((s) => s.fichas);

  if (phase !== 'title') return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-gradient-to-b from-black/90 via-[#0a0703]/90 to-black/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl flex flex-col items-center text-center"
      >
        {/* Insignia conmemorativa */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium tracking-widest uppercase mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Homenaje a Santiago Ramón y Cajal · 1906
        </div>

        {/* Título principal */}
        <h1 className="text-4xl sm:text-6xl font-serif font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 mb-3 drop-shadow-lg">
          Cajal: Sinapsis 3D
        </h1>

        <p className="text-sm sm:text-base text-amber-200/80 max-w-lg mb-8 font-serif italic">
          «Defiende los circuitos de la corteza, el hipocampo y el cerebelo contra la toxicidad metabólica mediante impulsos sinápticos y conducción saltatoria.»
        </p>

        {/* Guía rápida de controles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 text-left">
          <div className="bg-neutral-900/60 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Movimiento</span>
              <span className="text-[11px] text-neutral-400">WASD o Joystick virtual</span>
            </div>
          </div>

          <div className="bg-neutral-900/60 border border-cyan-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Impulsos</span>
              <span className="text-[11px] text-neutral-400">Ratón / Toque (Arborización)</span>
            </div>
          </div>

          <div className="bg-neutral-900/60 border border-emerald-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Salto Mielina</span>
              <span className="text-[11px] text-neutral-400">Espacio / Shift (i-frames)</span>
            </div>
          </div>
        </div>

        {/* Botón de Jugar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => newRun()}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-serif font-bold text-base tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all transform active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-black" />
            Comenzar Conducción Sináptica
          </button>

          <button
            onClick={onOpenGdd}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium text-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            Cuaderno de Cajal
          </button>
        </div>

        {/* Barra inferior: Fichas y Audio */}
        <div className="mt-8 flex items-center justify-between w-full text-xs text-neutral-400 px-2">
          <span>Fichas históricas acumuladas: <strong className="text-amber-300">{fichas}</strong></span>
          <button
            onClick={onToggleMute}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
            <span>{muted ? 'Sonido desactivado' : 'Sonido activado'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
