/**
 * leaderboard.ts — Clasificación compartida de Cajal: Sinapsis 3D (Cloudflare Pages Function + D1).
 *
 * Ruta prevista: /api/juegos/cajal-sinapsis/leaderboard (mismo dominio que el juego).
 *   GET    ?board=story|arcade|maze|micro|build|rhythm [&day=AAAA-MM-DD] [&limit=1..50]
 *   POST   { v:1, board, day|null, name, avatar, score, detail, difficulty, modifier|null }
 *   DELETE ?name=Alias [&board=…]   (moderación; cabecera Authorization: Bearer ADMIN_TOKEN)
 *
 * Qué guarda: alias (filtrado), color de avatar, puntos, una línea de detalle y la dificultad.
 * No guarda IP ni nada que identifique a la persona: para limitar envíos usa un resumen
 * (hash SHA-256) de la IP con una sal secreta y la fecha, que cambia cada día y no se puede revertir.
 *
 * Se compila a un solo archivo con `npm run build:server` → server/dist/leaderboard.js
 */
import { checkPlayerName } from '../src/game/names';
import { PLAY_IDS, dailyChallenge, type PlayId } from '../src/game/daily';
import { isDifficulty, type DailyModifier } from '../src/game/difficulty';

// ── Tipos mínimos de D1 (sin dependencias) ────────────────────────────────
export interface D1Result<T = Record<string, unknown>> { results?: T[] }
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Like { prepare(sql: string): D1Stmt }

export interface Env {
  DB: D1Like;
  /** Sal secreta para el resumen de IP (configúrala en Cloudflare como secreto) */
  SALT?: string;
  /** Token para moderar (borrar alias). Sin él, DELETE está desactivado. */
  ADMIN_TOKEN?: string;
}

interface Ctx { request: Request; env: Env }

/** Puntuación máxima creíble por modo (con todos los multiplicadores). Más alto → se rechaza. */
export const MAX_SCORE: Record<PlayId, number> = {
  story: 30_000,
  arcade: 5_000_000,
  maze: 500_000,
  micro: 20_000,
  build: 20_000,
  rhythm: 100_000,
  brush: 5_000,
};
const MODIFIERS: DailyModifier[] = ['clasico', 'veloces', 'fragil', 'contrarreloj'];
const RATE_WINDOW_MIN = 10;
const RATE_MAX = 8;
const DAILY_DAYS_KEPT = 30;

export const json = (data: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });

const isPlayId = (v: unknown): v is PlayId => typeof v === 'string' && (PLAY_IDS as string[]).includes(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const nameKey = (n: string) => n.trim().toLowerCase();

/** Días entre una fecha AAAA-MM-DD y hoy (UTC). Sirve para aceptar zonas horarias de todo el mundo. */
function dayDistance(day: string, now: Date): number {
  const t = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((t - today) / 86_400_000);
}

/** Limpia la línea de detalle: sin caracteres de control ni símbolos de HTML */
export function cleanDetail(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export type Validated = {
  board: PlayId; day: string; name: string; key: string; avatar: number; score: number; detail: string; difficulty: string; modifier: string | null;
};

/** Valida un envío. Función pura: devuelve el registro limpio o el motivo del rechazo. */
export function validateSubmission(body: unknown, now = new Date()): { ok: true; value: Validated } | { ok: false; error: string } {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== 'object' || b.v !== 1) return { ok: false, error: 'formato' };
  if (!isPlayId(b.board)) return { ok: false, error: 'modo' };
  let day = '';
  let modifier: string | null = null;
  if (b.day !== null && b.day !== undefined) {
    if (typeof b.day !== 'string' || !DAY_RE.test(b.day) || Math.abs(dayDistance(b.day, now)) > 1) return { ok: false, error: 'dia' };
    // el desafío de ese día tiene un modo y un modificador fijos
    const d = dailyChallenge(b.day);
    if (d.mode !== b.board || b.modifier !== d.modifier) return { ok: false, error: 'desafio' };
    day = b.day;
    modifier = d.modifier;
  } else if (b.modifier !== null && b.modifier !== undefined && !MODIFIERS.includes(b.modifier as DailyModifier)) {
    return { ok: false, error: 'modificador' };
  }
  if (typeof b.name !== 'string') return { ok: false, error: 'alias' };
  const n = checkPlayerName(b.name);
  if (!n.ok) return { ok: false, error: 'alias' };
  const avatar = Number(b.avatar);
  if (!Number.isInteger(avatar) || avatar < 0 || avatar > 7) return { ok: false, error: 'avatar' };
  const score = Number(b.score);
  if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE[b.board]) return { ok: false, error: 'puntos' };
  const difficulty = isDifficulty(b.difficulty) ? b.difficulty : 'cientifico';
  if (day && difficulty !== 'cientifico') return { ok: false, error: 'dificultad' };
  return { ok: true, value: { board: b.board, day, name: n.value, key: nameKey(n.value), avatar, score, detail: cleanDetail(b.detail), difficulty, modifier } };
}

export async function ipHash(request: Request, salt: string, now: Date): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'desconocida';
  const data = new TextEncoder().encode(`${salt}|${ip}|${now.toISOString().slice(0, 10)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const board = url.searchParams.get('board');
  const day = url.searchParams.get('day') ?? '';
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 20));
  if (!isPlayId(board)) return json({ error: 'modo' }, 400);
  if (day && !DAY_RE.test(day)) return json({ error: 'dia' }, 400);
  const res = await env.DB.prepare(
    `SELECT name, avatar, score, detail, difficulty, modifier, updated AS date
       FROM scores WHERE board = ?1 AND day = ?2
       ORDER BY score DESC, updated ASC LIMIT ?3`,
  )
    .bind(board, day, limit)
    .all();
  return json({ entries: res.results ?? [] }, 200, 'public, max-age=15');
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const len = Number(request.headers.get('Content-Length') ?? 0);
  if (len > 2048) return json({ error: 'grande' }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return json({ error: 'grande' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'formato' }, 400);
  }
  const now = new Date();
  const v = validateSubmission(body, now);
  if (!v.ok) return json({ error: v.error }, 400);
  const s = v.value;

  const banned = await env.DB.prepare('SELECT 1 AS x FROM banned WHERE name_key = ?1').bind(s.key).first();
  if (banned) return json({ error: 'alias' }, 400);

  // Límite de envíos por conexión, sin guardar la IP
  const hash = await ipHash(request, env.SALT ?? 'cajal', now);
  const since = new Date(now.getTime() - RATE_WINDOW_MIN * 60_000).toISOString();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate WHERE ip_hash = ?1 AND at > ?2').bind(hash, since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= RATE_MAX) return json({ error: 'espera' }, 429);
  await env.DB.prepare('INSERT INTO rate (ip_hash, at) VALUES (?1, ?2)').bind(hash, now.toISOString()).run();

  // Una fila por alias, modo y día: solo se guarda su mejor puntuación
  await env.DB.prepare(
    `INSERT INTO scores (board, day, name_key, name, avatar, score, detail, difficulty, modifier, updated)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (board, day, name_key) DO UPDATE SET
       name = excluded.name, avatar = excluded.avatar, score = excluded.score, detail = excluded.detail,
       difficulty = excluded.difficulty, modifier = excluded.modifier, updated = excluded.updated
     WHERE excluded.score > scores.score`,
  )
    .bind(s.board, s.day, s.key, s.name, s.avatar, s.score, s.detail, s.difficulty, s.modifier, now.toISOString())
    .run();

  // Limpieza ocasional: límites de envío de más de una hora y desafíos de hace más de 30 días
  if (Math.random() < 0.05) {
    await env.DB.prepare('DELETE FROM rate WHERE at < ?1').bind(new Date(now.getTime() - 3_600_000).toISOString()).run();
    const old = new Date(now.getTime() - DAILY_DAYS_KEPT * 86_400_000).toISOString().slice(0, 10);
    await env.DB.prepare("DELETE FROM scores WHERE day <> '' AND day < ?1").bind(old).run();
  }
  return json({ ok: true });
}

/** Moderación: borra un alias (de un modo o de todos) y lo bloquea para el futuro */
export async function onRequestDelete({ request, env }: Ctx): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? '';
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'no autorizado' }, 401);
  const url = new URL(request.url);
  const name = url.searchParams.get('name');
  const board = url.searchParams.get('board');
  if (!name) return json({ error: 'alias' }, 400);
  const key = nameKey(name);
  if (board) {
    if (!isPlayId(board)) return json({ error: 'modo' }, 400);
    await env.DB.prepare('DELETE FROM scores WHERE name_key = ?1 AND board = ?2').bind(key, board).run();
  } else {
    await env.DB.prepare('DELETE FROM scores WHERE name_key = ?1').bind(key).run();
    await env.DB.prepare('INSERT OR IGNORE INTO banned (name_key) VALUES (?1)').bind(key).run();
  }
  return json({ ok: true });
}

export async function onRequest(ctx: Ctx): Promise<Response> {
  switch (ctx.request.method) {
    case 'GET':
      return onRequestGet(ctx);
    case 'POST':
      return onRequestPost(ctx);
    case 'DELETE':
      return onRequestDelete(ctx);
    default:
      return json({ error: 'método' }, 405);
  }
}
