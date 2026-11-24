/**
 * StoryModals.tsx — Pausa y final de nivel del Modo Historia (el parque).
 * Conserva los diálogos de Cajal y el apunte neurocientífico de cada nivel.
 */
import { dailyFor } from '../store/useSession';
import { activeParams } from '../game/difficulty';
import { motion } from 'motion/react';
import { Play, RotateCcw, Home, ChevronRight, CircleHelp } from 'lucide-react';
import { StarRow } from '../components/menu/TrophyBook';
import type { HudSnapshot } from '../components/Canvas3D';
import { LEVELS, type LevelConfig } from '../game/rules';
import { Leaderboard } from '../components/menu/Leaderboard';

const shortName = (n: string) => n.replace(/^Nivel \d+:\s*/, '');

const DEFEAT_DIALOGUE =
  '«No te desanimes, joven científico. El humo del tabaco, el alcohol y el exceso de azúcares apagan el oxígeno y enlentecen tus reflejos, pero el cerebro posee una cualidad maravillosa llamada neuroplasticidad: cada vez que eliges agua pura, fruta y aire limpio, tus dendritas vuelven a brotar con más fuerza.»';

/** Bonus por terminar rápido: 600 puntos menos 4 por segundo, nunca negativo. */
export const timeBonus = (seconds: number) => Math.max(0, Math.round(600 - seconds * 4));

export function StoryPauseModal({ level, hud, onResume, onRestart, onExit, onHelp }: {
  level: LevelConfig; hud: HudSnapshot; onResume: () => void; onRestart: () => void; onExit: () => void; onHelp: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="story-pause" className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#0b1220]/75 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl p-6 bg-[#121a2a]/95 border border-[#e8b45a]/30 flex flex-col gap-4 text-[#f4efe6]">
        <div>
          <h2 id="story-pause" className="font-display text-3xl text-white">En pausa</h2>
          <p className="text-sm text-[#c9c2b4] mt-1">{shortName(level.name)}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Red neuronal" value={`${hud.brainPower}%`} />
          <Stat label="Hábitos" value={String(hud.synapsesCollected)} />
          <Stat label="Puntos" value={String(hud.score)} />
        </dl>
        <button type="button" autoFocus onClick={onResume} className="h-12 rounded-xl bg-[#e8b45a] hover:bg-[#f2c470] text-[#1a1206] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer">
          <Play className="w-4 h-4" aria-hidden /> Seguir jugando
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onRestart} className="h-11 rounded-xl border border-white/15 hover:bg-white/5 text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
            <RotateCcw className="w-4 h-4" aria-hidden /> Reiniciar
          </button>
          <button type="button" onClick={onExit} className="h-11 rounded-xl border border-white/15 hover:bg-white/5 text-sm inline-flex items-center justify-center gap-2 cursor-pointer">
            <Home className="w-4 h-4" aria-hidden /> Menú
          </button>
        </div>
        <button type="button" onClick={onHelp} className="h-10 rounded-xl text-sm text-[#c9c2b4] hover:text-white hover:bg-white/5 inline-flex items-center justify-center gap-2 cursor-pointer">
          <CircleHelp className="w-4 h-4" aria-hidden /> Cómo se juega
        </button>
      </div>
    </div>
  );
}

export function StoryOutcomeModal({ outcome, levelIndex, stats, finalScore, rank, stars, onNext, onRetry, onExit }: {
  outcome: 'victory' | 'defeat';
  levelIndex: number;
  stats: HudSnapshot;
  finalScore: number;
  rank: number | null;
  stars: number;
  /** Sin siguiente nivel (p. ej. en el Desafío Diario) */
  onNext?: () => void;
  onRetry: () => void;
  onExit: () => void;
}) {
  const level = LEVELS[levelIndex];
  const won = outcome === 'victory';
  const hasNext = won && !!onNext && levelIndex < LEVELS.length - 1;
  const fast = activeParams().story.starSeconds;
  const bonus = won ? timeBonus(stats.elapsedTime) : 0;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="story-outcome" className="fixed inset-0 z-30 bg-[#0b1220]/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-3xl grid gap-6 md:grid-cols-[1fr_17rem] rounded-3xl p-6 sm:p-8 bg-[#121a2a]/95 border border-[#e8b45a]/30 text-[#f4efe6]"
      >
        <div className="flex flex-col gap-5">
          <div>
            <h2 id="story-outcome" className="font-display text-3xl sm:text-4xl text-white leading-tight">
              {won ? `${shortName(level.name)}: completado` : 'Tu red necesita descansar'}
            </h2>
            <p className="mt-1.5 text-sm text-[#c9c2b4]">{won ? 'Red neuronal al 100 % y portal alcanzado.' : 'La fatiga sináptica ha ganado esta vez.'}</p>
            {won && (
              <div className="mt-3 flex items-center gap-3">
                <StarRow n={stars} size={26} />
                <span className="text-sm text-[#c9c2b4]">
                  {stars === 3 ? '¡Nivel perfecto!' : stars === 2 ? `Te falta una estrella: termina en menos de ${fast} s con todos los corazones.` : `Termina con todos los corazones y en menos de ${fast} s para más estrellas.`}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="text-5xl sm:text-6xl font-semibold [font-variant-numeric:tabular-nums] text-[#ffd166] leading-none">{finalScore.toLocaleString('es-ES')}</div>
            <p className="mt-2 text-sm text-[#e9e3d6]">
              {won && bonus > 0 && <>Incluye puntos por rapidez{activeParams().scoreMult !== 1 ? ' y el multiplicador de dificultad' : ''}. </>}
              {rank === 1 ? '¡Nuevo récord en este dispositivo!' : rank ? `Puesto ${rank} de la clasificación.` : finalScore > 0 ? 'No ha entrado en el top 20 esta vez.' : ''}
            </p>
          </div>

          <figure className="rounded-2xl bg-black/25 border border-[#e8b45a]/25 p-4 flex flex-col gap-2">
            <figcaption className="text-sm font-semibold text-[#ffd166]">Santiago Ramón y Cajal</figcaption>
            <blockquote className="font-display italic text-[0.95rem] leading-relaxed text-[#f4efe6]">
              {won ? level.cajalVictoryDialogue : DEFEAT_DIALOGUE}
            </blockquote>
            <p className="text-xs text-[#e8d5a8] pt-2 border-t border-white/10 leading-relaxed">{level.neuroscienceFact}</p>
          </figure>

          <div className="flex flex-wrap gap-3">
            {hasNext ? (
              <button type="button" autoFocus onClick={onNext} className="h-12 px-6 rounded-xl bg-[#e8b45a] hover:bg-[#f2c470] text-[#1a1206] font-semibold inline-flex items-center gap-2 cursor-pointer">
                Siguiente: {shortName(LEVELS[levelIndex + 1].name)}
                <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            ) : (
              <button type="button" autoFocus onClick={onRetry} className="h-12 px-6 rounded-xl bg-[#e8b45a] hover:bg-[#f2c470] text-[#1a1206] font-semibold inline-flex items-center gap-2 cursor-pointer">
                <RotateCcw className="w-4 h-4" aria-hidden />
                {won ? 'Jugar otra vez' : 'Reintentar'}
              </button>
            )}
            <button type="button" onClick={onExit} className="h-12 px-5 rounded-xl border border-white/15 hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer">
              <Home className="w-4 h-4" aria-hidden /> Menú principal
            </button>
          </div>
        </div>

        <div className="md:border-l md:border-white/10 md:pl-6">
          <Leaderboard initialMode={dailyFor('story') ? 'daily' : 'story'} limit={8} compact />
        </div>
      </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-2 py-2.5">
      <dt className="text-[0.7rem] text-[#a9a293]">{label}</dt>
      <dd className="[font-variant-numeric:tabular-nums] text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}
