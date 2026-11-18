/**
 * Leaderboard.tsx — Clasificación de este dispositivo, por modo de juego.
 */
import { useState } from 'react';
import { useProfileStore, type GameMode } from '../../store/useProfileStore';
import { NeuronGlyph, AVATAR_COLORS } from './NeuronGlyph';

const MODE_LABEL: Record<GameMode, string> = { story: 'Historia', arcade: 'Arcade' };

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

export function Leaderboard({
  initialMode = 'story',
  limit = 10,
  compact = false,
}: {
  initialMode?: GameMode;
  limit?: number;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<GameMode>(initialMode);
  const entries = useProfileStore((s) => s.leaderboard[mode]);
  const lastEntryId = useProfileStore((s) => s.lastEntryId);
  const playerName = useProfileStore((s) => s.playerName);
  const clear = useProfileStore((s) => s.clearLeaderboard);
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby="lb-title" className="flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="lb-title" className="font-display text-xl text-[#f4efe6]">
          Clasificación
        </h2>
        <div role="tablist" aria-label="Modo" className="flex rounded-full bg-white/5 p-0.5 text-xs">
          {(['story', 'arcade'] as GameMode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                mode === m
                  ? m === 'story'
                    ? 'bg-[#e8b45a] text-[#1a1206] font-semibold'
                    : 'bg-[#5ee6ff] text-[#03141a] font-semibold'
                  : 'text-[#c9c2b4] hover:text-white'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-[#a9a293] leading-relaxed py-4">
          Aún no hay puntuaciones en {MODE_LABEL[mode].toLowerCase()}. Termina una partida y aparecerás aquí.
        </p>
      ) : (
        <ol className="flex flex-col">
          {entries.slice(0, limit).map((e, i) => {
            const isLast = e.id === lastEntryId;
            const isMe = e.name === playerName;
            return (
              <li
                key={e.id}
                className={`grid grid-cols-[1.75rem_1.5rem_1fr_auto] items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg ${
                  isLast ? 'bg-[#e8b45a]/15 ring-1 ring-[#e8b45a]/50' : ''
                }`}
              >
                <span
                  className={`text-right [font-variant-numeric:tabular-nums] font-sans font-semibold ${
                    i === 0 ? 'text-[#ffd166] text-lg' : i < 3 ? 'text-[#f4efe6]' : 'text-[#8e887c]'
                  }`}
                >
                  {i + 1}
                </span>
                <NeuronGlyph color={AVATAR_COLORS[e.avatar % AVATAR_COLORS.length]} size={22} />
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${isMe ? 'text-white font-semibold' : 'text-[#e9e3d6]'}`}>
                    {e.name}
                  </span>
                  {!compact && (
                    <span className="block truncate text-xs text-[#8e887c]">
                      {e.detail}, {dateFmt.format(new Date(e.date))}
                    </span>
                  )}
                </span>
                <span className="[font-variant-numeric:tabular-nums] font-sans font-semibold text-[#f4efe6]">{e.score.toLocaleString('es-ES')}</span>
              </li>
            );
          })}
        </ol>
      )}

      {!compact && (
        <div className="pt-1 text-xs text-[#8e887c] flex items-center justify-between gap-3">
          <span>Solo se guarda en este dispositivo.</span>
          {entries.length > 0 &&
            (confirming ? (
              <span className="flex gap-2">
                <button type="button" onClick={() => { clear(); setConfirming(false); }} className="text-[#ff8f8f] hover:underline cursor-pointer">
                  Sí, borrar todo
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="hover:underline cursor-pointer">
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="hover:text-[#c9c2b4] hover:underline cursor-pointer">
                Borrar clasificación
              </button>
            ))}
        </div>
      )}
    </section>
  );
}
