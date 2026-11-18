/**
 * GameOverModal.tsx — Fin de partida del modo Arcade, con puesto en la clasificación.
 */
import { motion } from 'motion/react';
import { RotateCcw, Home } from 'lucide-react';
import { Leaderboard } from '../menu/Leaderboard';

const CAJAL_QUOTES = [
  '«Todo ser humano, si se lo propone, puede ser escultor de su propio cerebro.»',
  '«Las misteriosas mariposas del alma, cuyo batir de alas quién sabe si esclarecerá algún día el secreto de la vida mental.»',
];

export interface ArcadeResult {
  won: boolean;
  score: number;
  kills: number;
  detail: string;
  seconds: number;
  rank: number | null;
}

export function GameOverModal({ result, onRetry, onExit }: { result: ArcadeResult; onRetry: () => void; onExit: () => void }) {
  const quote = CAJAL_QUOTES[result.kills % CAJAL_QUOTES.length];
  const mins = Math.floor(result.seconds / 60);
  const secs = Math.round(result.seconds % 60).toString().padStart(2, '0');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="arcade-over-title" className="absolute inset-0 z-50 bg-[#020a0d]/85 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-3xl grid gap-6 md:grid-cols-[1fr_17rem] rounded-3xl p-6 sm:p-8 bg-[#06161c]/95 border border-[#5ee6ff]/25"
      >
        <div className="flex flex-col gap-5">
          <div>
            <h2 id="arcade-over-title" className="font-display text-3xl sm:text-4xl text-white leading-tight">
              {result.won ? 'Cerebro protegido' : 'Fin de la conducción'}
            </h2>
            <p className="mt-1.5 text-sm text-[#9fc6cf]">{result.detail}</p>
          </div>

          <div>
            <div className="text-5xl sm:text-6xl font-semibold [font-variant-numeric:tabular-nums] text-[#7ff3ff] leading-none">{result.score.toLocaleString('es-ES')}</div>
            <p className="mt-2 text-sm text-[#cfe9ee]">
              {result.rank === 1
                ? '¡Nuevo récord en este dispositivo!'
                : result.rank
                  ? `Puesto ${result.rank} de la clasificación.`
                  : 'No ha entrado en el top 20 esta vez.'}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <dt className="text-[#9fc6cf] text-xs">Toxinas eliminadas</dt>
              <dd className="[font-variant-numeric:tabular-nums] text-lg text-white font-semibold">{result.kills}</dd>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <dt className="text-[#9fc6cf] text-xs">Tiempo</dt>
              <dd className="[font-variant-numeric:tabular-nums] text-lg text-white font-semibold">
                {mins}:{secs}
              </dd>
            </div>
          </dl>

          <blockquote className="text-sm italic font-display text-[#e8d5a8] leading-relaxed border-l-2 border-[#e8b45a]/50 pl-3">
            {quote} <span className="not-italic text-[#a9a293]">Santiago Ramón y Cajal</span>
          </blockquote>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              autoFocus
              className="h-12 px-6 rounded-xl bg-[#5ee6ff] hover:bg-[#8ff0ff] text-[#03141a] font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Jugar otra vez
            </button>
            <button
              type="button"
              onClick={onExit}
              className="h-12 px-5 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" aria-hidden />
              Menú principal
            </button>
          </div>
        </div>

        <div className="md:border-l md:border-white/10 md:pl-6">
          <Leaderboard initialMode="arcade" limit={8} compact />
        </div>
      </motion.div>
      </div>
    </div>
  );
}
