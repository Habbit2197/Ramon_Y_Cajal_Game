/**
 * Leaderboard.tsx — Clasificación por modo y del Desafío Diario.
 *
 * Dos vistas: «Todos» (clasificación compartida del sitio, si está disponible) y
 * «Este dispositivo» (siempre disponible, también sin conexión).
 */
import { useEffect, useState } from 'react';
import { Globe, Smartphone, RefreshCw } from 'lucide-react';
import { useProfileStore, type ScoreEntry } from '../../store/useProfileStore';
import { NeuronGlyph, AVATAR_COLORS } from './NeuronGlyph';
import { PLAY_IDS, dailyChallenge, dateKey, type PlayId } from '../../game/daily';
import { DIFFICULTY_INFO, isDifficulty } from '../../game/difficulty';
import { fetchBoard, onlineEnabled, onBoardChange, type OnlineEntry } from '../../net/onlineBoard';
import { PLAY_COLOR } from './MenuExtras';

type Tab = PlayId | 'daily';
const TAB_LABEL: Record<Tab, string> = { daily: 'Hoy', story: 'Historia', arcade: 'Arcade', maze: 'Laberinto', micro: 'Microscopio', build: 'Construye', rhythm: 'Ritmo', brush: 'Dientes' };
const TABS: Tab[] = ['daily', ...PLAY_IDS];
const EMPTY: never[] = [];
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

type Row = Pick<ScoreEntry, 'name' | 'avatar' | 'score' | 'detail' | 'date'> & { id?: string; difficulty?: string };

function useOnline(tab: Tab, scope: 'all' | 'device', limit: number) {
  const [state, setState] = useState<{ status: 'off' | 'loading' | 'ok' | 'error'; entries: OnlineEntry[] }>({ status: onlineEnabled() ? 'loading' : 'off', entries: [] });
  const [tick, setTick] = useState(0);
  useEffect(() => onBoardChange(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (scope !== 'all' || !onlineEnabled()) return;
    let alive = true;
    setState((s) => ({ status: 'loading', entries: s.entries }));
    const today = dateKey();
    const board = tab === 'daily' ? dailyChallenge(today).mode : tab;
    fetchBoard(board, tab === 'daily' ? today : null, limit)
      .then((entries) => alive && setState({ status: 'ok', entries }))
      .catch(() => alive && setState({ status: 'error', entries: [] }));
    return () => {
      alive = false;
    };
  }, [tab, scope, limit, tick]);
  return { ...state, retry: () => setTick((t) => t + 1) };
}

export function Leaderboard({
  initialMode = 'story',
  limit = 10,
  compact = false,
}: {
  initialMode?: Tab;
  limit?: number;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialMode);
  const [scope, setScope] = useState<'all' | 'device'>(onlineEnabled() ? 'all' : 'device');
  const today = dateKey();
  const local = useProfileStore((s) => (tab === 'daily' ? s.dailyBoard[today] : s.leaderboard[tab])) ?? EMPTY;
  const lastEntryId = useProfileStore((s) => s.lastEntryId);
  const playerName = useProfileStore((s) => s.playerName);
  const shareOnline = useProfileStore((s) => s.shareOnline);
  const clear = useProfileStore((s) => s.clearLeaderboard);
  const [confirming, setConfirming] = useState(false);
  const online = useOnline(tab, scope, Math.max(limit, 20));

  const showOnline = scope === 'all' && online.status !== 'off';
  const rows: Row[] = showOnline ? online.entries : local;
  const what = tab === 'daily' ? 'el desafío de hoy' : TAB_LABEL[tab].toLowerCase();

  return (
    <section aria-labelledby="lb-title" className="flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="lb-title" className="font-display text-xl text-[#f4efe6]">Clasificación</h2>
        {onlineEnabled() && (
          <div role="radiogroup" aria-label="Qué clasificación ver" className="flex rounded-full bg-white/5 p-0.5 text-xs">
            {(['all', 'device'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                onClick={() => setScope(s)}
                className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${scope === s ? 'bg-[#f4efe6] text-[#14110b] font-semibold' : 'text-[#c9c2b4] hover:text-white'}`}
              >
                {s === 'all' ? <Globe className="w-3 h-3" aria-hidden /> : <Smartphone className="w-3 h-3" aria-hidden />}
                {s === 'all' ? 'Todos' : 'Este dispositivo'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Modo" className="flex flex-wrap gap-1 text-xs">
        {TABS.map((m) => {
          const c = m === 'daily' ? { bg: '#7fe0a8', fg: '#06200f' } : PLAY_COLOR[m];
          return (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={tab === m}
              onClick={() => setTab(m)}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer border ${tab === m ? 'font-semibold border-transparent' : 'border-white/10 text-[#c9c2b4] hover:text-white'}`}
              style={tab === m ? { background: c.bg, color: c.fg } : undefined}
            >
              {TAB_LABEL[m]}
            </button>
          );
        })}
      </div>

      {showOnline && online.status === 'loading' && rows.length === 0 ? (
        <p className="text-sm text-[#a9a293] py-4" role="status">Cargando la clasificación…</p>
      ) : showOnline && online.status === 'error' ? (
        <div className="text-sm text-[#a9a293] py-3 flex flex-col items-start gap-2">
          <p>No se puede cargar la clasificación de todos ahora mismo. Tus puntuaciones se envían cuando vuelva la conexión.</p>
          <span className="flex gap-3">
            <button type="button" onClick={online.retry} className="inline-flex items-center gap-1 text-[#e9e3d6] hover:underline cursor-pointer"><RefreshCw className="w-3.5 h-3.5" aria-hidden /> Reintentar</button>
            <button type="button" onClick={() => setScope('device')} className="text-[#e9e3d6] hover:underline cursor-pointer">Ver este dispositivo</button>
          </span>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#a9a293] leading-relaxed py-4">Aún no hay puntuaciones en {what}. Termina una partida y aparecerás aquí.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.slice(0, limit).map((e, i) => {
            const isLast = !showOnline && e.id === lastEntryId;
            const isMe = e.name === playerName;
            const d = isDifficulty(e.difficulty) ? e.difficulty : null;
            return (
              <li
                key={e.id ?? `${e.name}-${e.date}-${i}`}
                className={`grid grid-cols-[1.75rem_1.5rem_1fr_auto] items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg ${isLast || (showOnline && isMe) ? 'bg-[#e8b45a]/15 ring-1 ring-[#e8b45a]/50' : ''}`}
              >
                <span className={`text-right [font-variant-numeric:tabular-nums] font-sans font-semibold ${i === 0 ? 'text-[#ffd166] text-lg' : i < 3 ? 'text-[#f4efe6]' : 'text-[#8e887c]'}`}>{i + 1}</span>
                <NeuronGlyph color={AVATAR_COLORS[((e.avatar % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length]} size={22} />
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${isMe ? 'text-white font-semibold' : 'text-[#e9e3d6]'}`}>{e.name}</span>
                  {!compact && (
                    <span className="block truncate text-xs text-[#8e887c]">
                      {e.detail}
                      {d && d !== 'cientifico' ? `, ${DIFFICULTY_INFO[d].label}` : ''}, {dateFmt.format(new Date(e.date))}
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
          <span>
            {showOnline
              ? shareOnline
                ? 'Se ve tu alias y tus puntos, nada más. Puedes dejar de publicar en Ajustes.'
                : 'No publicas tus puntuaciones (Ajustes).'
              : 'Solo se guarda en este dispositivo.'}
          </span>
          {!showOnline &&
            local.length > 0 &&
            (confirming ? (
              <span className="flex gap-2 shrink-0">
                <button type="button" onClick={() => { clear(); setConfirming(false); }} className="text-[#ff8f8f] hover:underline cursor-pointer">Sí, borrar todo</button>
                <button type="button" onClick={() => setConfirming(false)} className="hover:underline cursor-pointer">Cancelar</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="hover:text-[#c9c2b4] hover:underline cursor-pointer shrink-0">Borrar</button>
            ))}
        </div>
      )}
    </section>
  );
}
