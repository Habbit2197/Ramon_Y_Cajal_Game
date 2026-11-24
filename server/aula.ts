/**
 * aula.ts — Modo aula de Cajal: Sinapsis 3D (Cloudflare Pages Function + D1).
 *
 * El profe crea una clase y recibe dos cosas:
 *   - un CÓDIGO de 6 letras que da a sus alumnos para unirse;
 *   - una CLAVE de profe, secreta, para ver el progreso. Solo se guarda su resumen SHA-256.
 * Cada alumno que se une recibe su propio token (también guardado como resumen), con el
 * que su dispositivo envía un resumen numérico de su progreso: medallas, estrellas, fichas…
 *
 * Ruta prevista: /api/juegos/cajal-sinapsis/aula
 *   POST {action:'create', className}                    → {code, teacherKey, className}
 *   POST {action:'join', code, name, avatar}             → {className, studentToken}
 *   POST {action:'sync', code, name, token, avatar, progress}
 *   POST {action:'leave', code, name, token}
 *   GET  ?code=XXXXXX            (Authorization: Bearer <clave de profe>) → {className, students:[…]}
 *   POST {action:'remove', code, name}   (Authorization: Bearer <clave de profe>)
 *   DELETE ?code=XXXXXX          (Authorization: Bearer <clave de profe>) → borra la clase
 *
 * No se guardan nombres reales, IP, cookies ni nada fuera del juego. Las clases caducan a los 365 días.
 */
import { checkPlayerName, containsBlocked } from '../src/game/names';
import { json, ipHash, nameKey, type Env } from './leaderboard';

interface Ctx { request: Request; env: Env }

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I: se dictan sin confusión
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const CLASS_DAYS = 365;
const MAX_STUDENTS = 60;
const CREATE_PER_DAY = 5;

/** Resumen de progreso que envía cada alumno: solo números del juego */
export const PROGRESS_FIELDS = {
  medals: 200,
  stars: 18,
  museum: 200,
  quiz: 500,
  games: 100_000,
  labGames: 100_000,
  daily: 10_000,
  streak: 10_000,
  storyBest: 30_000,
  arcadeBest: 5_000_000,
  mazeBest: 500_000,
  microBest: 20_000,
  buildBest: 20_000,
  rhythmBest: 100_000,
} as const;
export type ProgressSummary = Record<keyof typeof PROGRESS_FIELDS, number> & { difficulty: string };

const randomString = (n: number, alphabet = CODE_ALPHABET) => {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
};
async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const bearer = (r: Request) => (r.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

/** Nombre de la clase («5.º B», «Grupo de ciencias»): letras, números y poco más; sin datos de contacto ni palabras feas */
export function checkClassName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.replace(/\s+/g, ' ').trim();
  if (v.length < 2 || v.length > 24) return null;
  if (!/^[\p{L}\p{N} .ºª_-]+$/u.test(v)) return null;
  if (/\d{6,}/.test(v.replace(/[\s.-]/g, '')) || /(www|http|\.com|\.es|\.net)/i.test(v)) return null;
  return containsBlocked(v) ? null : v;
}

/** Valida y recorta el resumen de progreso. Función pura. */
export function cleanProgress(p: unknown): ProgressSummary | null {
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const out: Partial<ProgressSummary> = {};
  for (const [k, max] of Object.entries(PROGRESS_FIELDS)) {
    const v = Number(o[k] ?? 0);
    if (!Number.isFinite(v) || v < 0) return null;
    (out as Record<string, number>)[k] = Math.min(max, Math.round(v));
  }
  out.difficulty = ['explorador', 'cientifico', 'nobel'].includes(o.difficulty as string) ? (o.difficulty as string) : 'cientifico';
  return out as ProgressSummary;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const t = await request.text();
    if (t.length > 4096) return null;
    const v = JSON.parse(t);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

async function teacherOk(env: Env, code: string, key: string): Promise<{ name: string } | null> {
  if (!CODE_RE.test(code) || key.length < 16) return null;
  const row = await env.DB.prepare('SELECT name, teacher_hash, expires FROM classes WHERE code = ?1').bind(code).first<{ name: string; teacher_hash: string; expires: string }>();
  if (!row || row.expires < new Date().toISOString()) return null;
  return row.teacher_hash === (await sha256(`${code}|${key}`)) ? { name: row.name } : null;
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const code = (new URL(request.url).searchParams.get('code') ?? '').toUpperCase();
  const cls = await teacherOk(env, code, bearer(request));
  if (!cls) return json({ error: 'no autorizado' }, 401);
  const res = await env.DB.prepare('SELECT name, avatar, progress, updated FROM members WHERE code = ?1 ORDER BY name_key').bind(code).all<{ name: string; avatar: number; progress: string; updated: string }>();
  const students = (res.results ?? []).map((r) => ({ name: r.name, avatar: r.avatar, updated: r.updated, progress: JSON.parse(r.progress || '{}') }));
  return json({ className: cls.name, code, students });
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const b = await readJson(request);
  if (!b) return json({ error: 'formato' }, 400);
  const now = new Date();
  const action = b.action;

  if (action === 'create') {
    const className = checkClassName(b.className);
    if (!className) return json({ error: 'nombre' }, 400);
    const hash = await ipHash(request, env.SALT ?? 'cajal', now);
    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate WHERE ip_hash = ?1 AND at > ?2").bind(`aula:${hash}`, since).first<{ n: number }>();
    if ((n?.n ?? 0) >= CREATE_PER_DAY) return json({ error: 'espera' }, 429);
    await env.DB.prepare('INSERT INTO rate (ip_hash, at) VALUES (?1, ?2)').bind(`aula:${hash}`, now.toISOString()).run();
    let code = '';
    for (let i = 0; i < 6; i++) {
      code = randomString(6);
      const exists = await env.DB.prepare('SELECT 1 AS x FROM classes WHERE code = ?1').bind(code).first();
      if (!exists) break;
    }
    const teacherKey = randomString(24, 'abcdefghijkmnpqrstuvwxyz23456789');
    const expires = new Date(now.getTime() + CLASS_DAYS * 86_400_000).toISOString();
    await env.DB.prepare('INSERT INTO classes (code, name, teacher_hash, created, expires) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(code, className, await sha256(`${code}|${teacherKey}`), now.toISOString(), expires)
      .run();
    // limpieza ocasional de clases caducadas
    if (Math.random() < 0.1) {
      await env.DB.prepare('DELETE FROM members WHERE code IN (SELECT code FROM classes WHERE expires < ?1)').bind(now.toISOString()).run();
      await env.DB.prepare('DELETE FROM classes WHERE expires < ?1').bind(now.toISOString()).run();
    }
    return json({ code, teacherKey, className });
  }

  const code = typeof b.code === 'string' ? b.code.toUpperCase().trim() : '';
  if (!CODE_RE.test(code)) return json({ error: 'codigo' }, 400);

  if (action === 'remove') {
    const cls = await teacherOk(env, code, bearer(request));
    if (!cls) return json({ error: 'no autorizado' }, 401);
    if (typeof b.name !== 'string') return json({ error: 'alias' }, 400);
    await env.DB.prepare('DELETE FROM members WHERE code = ?1 AND name_key = ?2').bind(code, nameKey(b.name)).run();
    return json({ ok: true });
  }

  const cls = await env.DB.prepare('SELECT name, expires FROM classes WHERE code = ?1').bind(code).first<{ name: string; expires: string }>();
  if (!cls || cls.expires < now.toISOString()) return json({ error: 'clase' }, 404);
  if (typeof b.name !== 'string') return json({ error: 'alias' }, 400);
  const n = checkPlayerName(b.name);
  if (!n.ok) return json({ error: 'alias' }, 400);
  const key = nameKey(n.value);
  const avatar = Number.isInteger(b.avatar) && (b.avatar as number) >= 0 && (b.avatar as number) <= 7 ? (b.avatar as number) : 0;

  if (action === 'join') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE code = ?1').bind(code).first<{ n: number }>();
    const existing = await env.DB.prepare('SELECT 1 AS x FROM members WHERE code = ?1 AND name_key = ?2').bind(code, key).first();
    if (existing) return json({ error: 'alias ocupado' }, 409);
    if ((count?.n ?? 0) >= MAX_STUDENTS) return json({ error: 'clase llena' }, 409);
    const token = randomString(24, 'abcdefghijkmnpqrstuvwxyz23456789');
    await env.DB.prepare('INSERT INTO members (code, name_key, name, avatar, token_hash, progress, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(code, key, n.value, avatar, await sha256(`${code}|${key}|${token}`), '{}', now.toISOString())
      .run();
    return json({ className: cls.name, studentToken: token });
  }

  // sync y leave: el alumno demuestra que es él con su token
  const token = typeof b.token === 'string' ? b.token : '';
  const row = await env.DB.prepare('SELECT token_hash FROM members WHERE code = ?1 AND name_key = ?2').bind(code, key).first<{ token_hash: string }>();
  if (!row || row.token_hash !== (await sha256(`${code}|${key}|${token}`))) return json({ error: 'no autorizado' }, 401);

  if (action === 'leave') {
    await env.DB.prepare('DELETE FROM members WHERE code = ?1 AND name_key = ?2').bind(code, key).run();
    return json({ ok: true });
  }
  if (action === 'sync') {
    const progress = cleanProgress(b.progress);
    if (!progress) return json({ error: 'progreso' }, 400);
    await env.DB.prepare('UPDATE members SET avatar = ?3, progress = ?4, updated = ?5 WHERE code = ?1 AND name_key = ?2')
      .bind(code, key, avatar, JSON.stringify(progress), now.toISOString())
      .run();
    return json({ ok: true, className: cls.name });
  }
  return json({ error: 'accion' }, 400);
}

export async function onRequestDelete({ request, env }: Ctx): Promise<Response> {
  const code = (new URL(request.url).searchParams.get('code') ?? '').toUpperCase();
  const cls = await teacherOk(env, code, bearer(request));
  if (!cls) return json({ error: 'no autorizado' }, 401);
  await env.DB.prepare('DELETE FROM members WHERE code = ?1').bind(code).run();
  await env.DB.prepare('DELETE FROM classes WHERE code = ?1').bind(code).run();
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
