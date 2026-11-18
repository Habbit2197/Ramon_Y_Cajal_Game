/**
 * TrophyBook.tsx — El Cuaderno de Cajal: medallas, estrellas y estadísticas del alias actual.
 * Cada medalla conseguida «revela» un dato de neurociencia.
 */
import { X, Lock, Star } from 'lucide-react';
import { TROPHIES, type TrophyGroup } from '../../game/trophies';
import { LEVELS } from '../../game/rules';
import { useCurrentProgress, useProfileStore } from '../../store/useProfileStore';
import { NeuronGlyph } from './NeuronGlyph';

const GROUPS: { id: TrophyGroup; title: string; color: string }[] = [
  { id: 'general', title: 'Generales', color: '#f4efe6' },
  { id: 'story', title: 'Modo Historia', color: '#e8b45a' },
  { id: 'arcade', title: 'Modo Arcade', color: '#5ee6ff' },
];

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

export function Medal({ color, locked, size = 44 }: { color: string; locked: boolean; size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: locked ? 'rgb(255 255 255 / 0.04)' : `radial-gradient(circle at 35% 30%, ${color}55, ${color}18 70%)`,
        boxShadow: locked ? 'inset 0 0 0 1px rgb(255 255 255 / 0.12)' : `inset 0 0 0 1.5px ${color}`,
      }}
      aria-hidden
    >
      {locked ? <Lock className="w-4 h-4 text-[#6f6a60]" /> : <NeuronGlyph color={color} size={size * 0.62} />}
    </span>
  );
}

export function StarRow({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i < n ? 'fill-[#ffd166] text-[#ffd166]' : 'text-[#5d584f]'} aria-hidden />
      ))}
    </span>
  );
}

export function TrophyBook({ onClose }: { onClose: () => void }) {
  const progress = useCurrentProgress();
  const playerName = useProfileStore((s) => s.playerName);
  const got = Object.keys(progress.trophies).length;
  const st = progress.stats;
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="book-title" className="fixed inset-0 z-40 bg-[#0b1220]/90 backdrop-blur-md overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="book-title" className="font-display text-3xl md:text-4xl text-white">Cuaderno de Cajal</h2>
            <p className="mt-1 text-sm text-[#c9c2b4]">
              {playerName ? `${playerName}: ${got} de ${TROPHIES.length} medallas y ${totalStars} de 9 estrellas.` : 'Elige un alias para empezar a coleccionar medallas.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" autoFocus className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[#c9c2b4] hover:text-white hover:bg-white/8 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-white/8 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={TROPHIES.length} aria-valuenow={got} aria-label="Medallas conseguidas">
          <div className="h-full bg-gradient-to-r from-[#e8b45a] to-[#5ee6ff]" style={{ width: `${(got / TROPHIES.length) * 100}%` }} />
        </div>

        {/* Estrellas por nivel y estadísticas */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="menu-panel rounded-2xl p-5">
            <h3 className="font-display text-lg text-white">Estrellas del Modo Historia</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {LEVELS.map((l, i) => (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[#e9e3d6]">{l.name.replace(/^Nivel \d+:\s*/, '')}</span>
                  <StarRow n={progress.stars[i] ?? 0} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#a9a293] leading-relaxed">
              Una estrella por completar el nivel, otra por terminar con todos los corazones y otra por hacerlo en menos de 90 segundos.
            </p>
          </section>
          <section className="menu-panel rounded-2xl p-5">
            <h3 className="font-display text-lg text-white">Tus números</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Stat label="Partidas" value={st.storyGames + st.arcadeGames} />
              <Stat label="Hábitos recogidos" value={st.habitsCollected} />
              <Stat label="Niveles completados" value={st.levelsCompleted.length} suffix=" de 3" />
              <Stat label="Toxinas eliminadas" value={st.totalKills} />
              <Stat label="Impulsos perfectos" value={st.perfectDashes} />
              <Stat label="Mejor nivel arcade" value={st.arcadeBestLevel} />
            </dl>
          </section>
        </div>

        {GROUPS.map((g) => (
          <section key={g.id} className="mt-10" aria-labelledby={`g-${g.id}`}>
            <h3 id={`g-${g.id}`} className="font-display text-xl text-white">{g.title}</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {TROPHIES.filter((t) => t.group === g.id).map((t) => {
                const date = progress.trophies[t.id];
                const pr = !date && t.progress ? t.progress(st, progress.stars) : null;
                return (
                  <li key={t.id} className={`rounded-2xl p-4 flex gap-3.5 ${date ? 'menu-panel' : 'bg-white/[0.03] border border-white/5'}`}>
                    <Medal color={g.color} locked={!date} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`font-semibold ${date ? 'text-white' : 'text-[#a9a293]'}`}>{t.name}</span>
                        {date && <span className="text-xs text-[#8e887c] shrink-0">{dateFmt.format(new Date(date))}</span>}
                      </div>
                      <p className="text-sm text-[#c9c2b4] mt-0.5">{t.how}</p>
                      {date ? (
                        <p className="text-sm text-[#e8d5a8] mt-2 leading-relaxed">{t.fact}</p>
                      ) : pr !== null ? (
                        <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden" aria-label={`Progreso ${Math.round(pr * 100)} %`}>
                          <div className="h-full" style={{ width: `${pr * 100}%`, background: g.color }} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <dt className="text-xs text-[#a9a293]">{label}</dt>
      <dd className="text-lg font-semibold text-white [font-variant-numeric:tabular-nums]">
        {value.toLocaleString('es-ES')}
        <span className="text-sm text-[#a9a293] font-normal">{suffix}</span>
      </dd>
    </div>
  );
}
