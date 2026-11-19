/**
 * GameOverModal.tsx — Fin de partida del modo Arcade, con puesto en la clasificación.
 */
import { motion } from 'motion/react';
import { RotateCcw, Home, Infinity as InfinityIcon, Save } from 'lucide-react';
import { StarRow } from '../menu/TrophyBook';
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
  /** estrellas de cada región superada en esta partida */
  regionStars: number[];
}

const REGION_NAMES = ['Corteza prefrontal', 'Hipocampo', 'Cerebelo'];

function RegionStars({ stars }: { stars: number[] }) {
  if (!stars.some((n) => n > 0)) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {REGION_NAMES.map((r, i) =>
        stars[i] ? (
          <li key={r} className="flex items-center justify-between gap-3 text-sm text-[#e9e3d6] max-w-xs">
            {r}
            <StarRow n={stars[i]} />
          </li>
        ) : null,
      )}
    </ul>
  );
}

/** Pantalla de victoria: elegir entre guardar o seguir en modo infinito */
export function VictoryModal({ score, regionStars, onContinue, onFinish }: { score: number; regionStars: number[]; onContinue: () => void; onFinish: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="arcade-win-title" className="absolute inset-0 z-50 bg-[#020a0d]/85 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg rounded-3xl p-6 sm:p-8 bg-[#06161c]/95 border border-[#5ee6ff]/40 flex flex-col gap-5">
          <div>
            <h2 id="arcade-win-title" className="font-display text-3xl sm:text-4xl text-white">¡Cerebro protegido!</h2>
            <p className="mt-1.5 text-sm text-[#9fc6cf]">Has superado las tres regiones.</p>
          </div>
          <div className="text-5xl font-semibold text-[#7ff3ff] [font-variant-numeric:tabular-nums] leading-none">{score.toLocaleString('es-ES')}</div>
          <RegionStars stars={regionStars} />
          <p className="text-sm text-[#cfe9ee] leading-relaxed">
            Puedes guardar ahora tu puntuación o seguir en el <strong className="text-white">modo infinito</strong>: oleadas sin fin, cada vez más duras, sumando a estos puntos.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" autoFocus onClick={onContinue} className="h-12 px-6 rounded-xl bg-[#5ee6ff] hover:bg-[#8ff0ff] text-[#03141a] font-semibold inline-flex items-center gap-2 cursor-pointer">
              <InfinityIcon className="w-4 h-4" aria-hidden /> Seguir en modo infinito
            </button>
            <button type="button" onClick={onFinish} className="h-12 px-5 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer">
              <Save className="w-4 h-4" aria-hidden /> Terminar y guardar
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
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

          <RegionStars stars={result.regionStars} />

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
