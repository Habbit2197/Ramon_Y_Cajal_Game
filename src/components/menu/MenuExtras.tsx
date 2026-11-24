/**
 * MenuExtras.tsx — Piezas del menú principal: Desafío Diario, dificultad y Laboratorio de Cajal.
 */
import { CalendarCheck, Check, Flame, Microscope, Puzzle, Music, Smile } from 'lucide-react';
import { dailyChallenge, dailyStreak, dateKey, type PlayId } from '../../game/daily';
import { DIFFICULTIES, DIFFICULTY_INFO, MODIFIER_INFO } from '../../game/difficulty';
import { useCurrentProgress, useDifficulty, useProfileStore, type LabGame } from '../../store/useProfileStore';
import { LEVELS } from '../../game/rules';

export const PLAY_LABEL: Record<PlayId, string> = {
  story: 'Historia',
  arcade: 'Arcade',
  maze: 'Laberinto',
  micro: 'Microscopio',
  build: 'Construye la neurona',
  rhythm: 'Sinapsis rítmica',
  brush: 'Cepíllate los dientes',
};

/** Color de acento de cada modo (botón Jugar, pestañas de la clasificación) */
export const PLAY_COLOR: Record<PlayId, { bg: string; fg: string }> = {
  story: { bg: '#e8b45a', fg: '#1a1206' },
  arcade: { bg: '#5ee6ff', fg: '#03141a' },
  maze: { bg: '#b49cff', fg: '#150a2e' },
  micro: { bg: '#7fe0a8', fg: '#06200f' },
  build: { bg: '#ffb86b', fg: '#2a1404' },
  rhythm: { bg: '#ff8fb1', fg: '#2b0614' },
  brush: { bg: '#9fe7f5', fg: '#052a33' },
};

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export function DailyCard({ onPlay }: { onPlay: () => void }) {
  const progress = useCurrentProgress();
  const today = dateKey();
  const d = dailyChallenge(today);
  const best = progress.daily.best[today] ?? 0;
  const done = progress.daily.completed.includes(today);
  const streak = dailyStreak(progress.daily.completed, today);
  const where = d.mode === 'story' ? `${PLAY_LABEL.story}: ${LEVELS[d.levelIndex].name.replace(/^Nivel \d+:\s*/, '')}` : PLAY_LABEL[d.mode];
  const c = PLAY_COLOR[d.mode];

  return (
    <section aria-labelledby="daily-title" className="daily-card rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="daily-title" className="flex items-center gap-2 text-[#f4efe6] font-semibold">
            <CalendarCheck className="w-4 h-4 text-[#7fe0a8]" aria-hidden />
            Desafío del día
          </h2>
          <p className="text-xs text-[#a9a293] first-letter:uppercase">{dayFmt.format(new Date())}</p>
        </div>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-[#ff8f5a]/15 text-[#ffb38f]" title="Días seguidos completados">
            <Flame className="w-3.5 h-3.5" aria-hidden />
            {streak} {streak === 1 ? 'día' : 'días'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-xl text-white">{where}</span>
        <span className="text-xs rounded-full px-2 py-0.5 border" style={{ borderColor: `${c.bg}66`, color: c.bg }}>{MODIFIER_INFO[d.modifier].label}</span>
      </div>
      <p className="text-sm text-[#c9c2b4] leading-snug">
        <strong className="text-[#e9e3d6] font-semibold">Reto:</strong> {d.goal} {MODIFIER_INFO[d.modifier].blurb} El mismo para todos hoy.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          className="h-11 px-5 rounded-xl font-semibold text-sm bg-[#7fe0a8] hover:bg-[#9cebbd] text-[#06200f] cursor-pointer active:scale-[0.98] transition-transform"
        >
          {done ? 'Mejorar mi puntuación' : 'Jugar el desafío'}
        </button>
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[#7fe0a8]"><Check className="w-4 h-4" aria-hidden /> Completado: {best.toLocaleString('es-ES')} puntos</span>
        ) : best > 0 ? (
          <span className="text-sm text-[#a9a293]">Tu mejor intento: {best.toLocaleString('es-ES')}</span>
        ) : null}
      </div>
    </section>
  );
}

export function DifficultyPicker({ compact = false }: { compact?: boolean }) {
  const current = useDifficulty();
  const setDifficulty = useProfileStore((s) => s.setDifficulty);
  const hasAlias = useProfileStore((s) => !!s.playerName);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={compact ? 'text-white font-semibold' : 'text-sm text-[#e9e3d6]'}>Dificultad</legend>
      <div role="radiogroup" aria-label="Dificultad" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/30 p-1">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={current === d}
            disabled={!hasAlias}
            onClick={() => setDifficulty(d)}
            className={`h-10 rounded-xl text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              current === d ? 'bg-[#f4efe6] text-[#14110b] font-semibold' : 'text-[#c9c2b4] hover:text-white hover:bg-white/5'
            }`}
          >
            {DIFFICULTY_INFO[d].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-[#a9a293] leading-snug">{hasAlias ? DIFFICULTY_INFO[current].blurb : 'Elige un alias para guardar tu dificultad.'}</p>
    </fieldset>
  );
}

const LAB: { id: LabGame; title: string; blurb: string; icon: typeof Microscope }[] = [
  { id: 'micro', title: 'Microscopio', blurb: 'Tiñe una muestra como Cajal y descubre neuronas ocultas.', icon: Microscope },
  { id: 'build', title: 'Construye la neurona', blurb: 'Monta sus partes y envía un impulso.', icon: Puzzle },
  { id: 'rhythm', title: 'Sinapsis rítmica', blurb: 'Lanza neurotransmisores al ritmo justo.', icon: Music },
  { id: 'brush', title: 'Cepíllate los dientes', blurb: 'Dos minutos, cuatro zonas y ni una mancha de placa.', icon: Smile },
];

export function LabTiles({ mode, onSelect }: { mode: PlayId; onSelect: (m: LabGame) => void }) {
  const progress = useCurrentProgress();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-[#e9e3d6] mb-1">Laboratorio de Cajal</legend>
      <div role="radiogroup" aria-label="Minijuegos" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LAB.map(({ id, title, blurb, icon: Icon }) => {
          const sel = mode === id;
          const c = PLAY_COLOR[id];
          const best = progress.labBest[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onSelect(id)}
              className={`lab-tile text-left rounded-xl p-3 border flex sm:flex-col gap-3 sm:gap-2 items-start transition-[border-color,background-color,opacity] cursor-pointer ${
                sel ? 'bg-white/[0.07]' : 'border-white/10 bg-black/25 opacity-80 hover:opacity-100 hover:border-white/25'
              }`}
              style={sel ? { borderColor: c.bg } : undefined}
            >
              <span className="w-9 h-9 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: `${c.bg}22`, color: c.bg }}>
                <Icon className="w-5 h-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white leading-tight">{title}</span>
                <span className="block text-xs text-[#a9a293] leading-snug mt-0.5">{blurb}</span>
                {best ? <span className="block text-[0.7rem] mt-1" style={{ color: c.bg }}>Récord: {best.toLocaleString('es-ES')}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
