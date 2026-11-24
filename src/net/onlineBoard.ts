/**
 * onlineBoard.ts — Clasificación compartida entre jugadores.
 *
 * Es la ÚNICA parte del juego que usa la red, y solo habla con el propio sitio
 * (misma dirección que el juego, sin servicios de terceros). Envía alias, color de
 * neurona, puntos, una línea de detalle y la dificultad: ningún dato personal.
 *
 * - Ruta por defecto: /api/juegos/cajal-sinapsis/leaderboard (función del sitio, ver server/).
 * - Se cambia al compilar con VITE_LEADERBOARD_API=/otra/ruta, o se apaga con VITE_LEADERBOARD_API=off.
 * - Sin conexión, las puntuaciones esperan en una cola local y se envían más tarde.
 * - Si el servidor no existe o falla, el juego sigue con la clasificación del dispositivo.
 */
import type { ScoreEntry } from '../store/useProfileStore';
import type { PlayId } from '../game/daily';

const RAW = (import.meta.env.VITE_LEADERBOARD_API as string | undefined) ?? '/api/juegos/cajal-sinapsis/leaderboard';
export const ONLINE_ENDPOINT = RAW === 'off' || import.meta.env.MODE === 'test' ? '' : RAW;
export const onlineEnabled = () => ONLINE_ENDPOINT !== '' && typeof fetch === 'function';

export interface OnlineEntry {
  name: string;
  avatar: number;
  score: number;
  detail: string;
  date: string;
  difficulty?: string;
  modifier?: string;
}

interface Submission {
  board: PlayId;
  daily: string | null;
  entry: ScoreEntry;
}

const QUEUE_KEY = 'cajal-pending-scores';
const QUEUE_MAX = 20;

function readQueue(): Submission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as Submission[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeQueue(list: Submission[]) {
  try {
    if (list.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-QUEUE_MAX)));
  } catch {
    /* almacenamiento bloqueado: se pierde la cola, no la partida */
  }
}

/** Cuerpo que se envía: solo lo imprescindible para la clasificación */
export function toPayload(s: Submission) {
  return {
    v: 1,
    board: s.board,
    day: s.daily,
    name: s.entry.name,
    avatar: s.entry.avatar,
    score: s.entry.score,
    detail: s.entry.detail.slice(0, 60),
    difficulty: s.entry.difficulty ?? 'cientifico',
    modifier: s.entry.modifier ?? null,
  };
}

async function post(s: Submission): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const res = await fetch(ONLINE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(s)),
      credentials: 'omit',
      cache: 'no-store',
    });
    if (res.ok) return 'ok';
    // 4xx: el servidor la rechaza (alias no válido, puntuación imposible…): no se reintenta
    if (res.status >= 400 && res.status < 500 && res.status !== 429) return 'drop';
    return 'retry';
  } catch {
    return 'retry'; // sin red
  }
}

let flushing = false;
/** Envía la cola pendiente (al recuperar la conexión o al abrir la clasificación) */
export async function flushQueue() {
  if (!onlineEnabled() || flushing) return;
  flushing = true;
  try {
    const queue = readQueue();
    const keep: Submission[] = [];
    for (const s of queue) {
      const r = await post(s);
      if (r === 'retry') keep.push(s);
    }
    writeQueue(keep);
  } finally {
    flushing = false;
  }
}

/** Envía una puntuación sin bloquear el juego. Si falla por la red, queda en cola. */
export function submitOnline(s: Submission) {
  if (!onlineEnabled()) return;
  void post(s).then((r) => {
    if (r === 'retry') writeQueue([...readQueue(), s]);
    cache.clear();
    notify();
  });
}

// ── Lectura con caché corta ───────────────────────────────────────────────
const cache = new Map<string, { at: number; entries: OnlineEntry[] }>();
const CACHE_MS = 30_000;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const onBoardChange = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export async function fetchBoard(board: PlayId, daily: string | null, limit = 20): Promise<OnlineEntry[]> {
  if (!onlineEnabled()) throw new Error('off');
  const key = `${board}|${daily ?? ''}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.entries;
  const url = new URL(ONLINE_ENDPOINT, window.location.href);
  url.searchParams.set('board', board);
  if (daily) url.searchParams.set('day', daily);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { entries?: OnlineEntry[] };
  const entries = Array.isArray(data.entries) ? data.entries.filter(isEntry) : [];
  cache.set(key, { at: Date.now(), entries });
  void flushQueue();
  return entries;
}

function isEntry(e: unknown): e is OnlineEntry {
  const o = e as OnlineEntry;
  return !!o && typeof o.name === 'string' && typeof o.score === 'number' && typeof o.avatar === 'number';
}

if (typeof window !== 'undefined' && onlineEnabled()) {
  window.addEventListener('online', () => void flushQueue());
}
