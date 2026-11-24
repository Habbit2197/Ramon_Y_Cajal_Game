/**
 * leaderboard.test.ts — La función de la clasificación compartida contra una base SQLite real
 * (node:sqlite), con el mismo esquema que D1.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest, validateSubmission, cleanDetail, type D1Like, type D1Stmt, type Env } from './leaderboard';
import { dailyChallenge, dateKey } from '../src/game/daily';

/** Adaptador mínimo de node:sqlite a la API de D1 */
function fakeD1(db: DatabaseSync): D1Like {
  return {
    prepare(sql: string): D1Stmt {
      let args: unknown[] = [];
      const stmt = db.prepare(sql.replace(/\?(\d+)/g, '?'));
      // D1 usa ?1, ?2…; aquí se reordenan según el número
      const order = [...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]) - 1);
      const vals = () => order.map((i) => args[i] as never);
      const self: D1Stmt = {
        bind: (...v) => ((args = v), self),
        all: async <T,>() => ({ results: stmt.all(...vals()) as T[] }),
        first: async <T,>() => (stmt.get(...vals()) as T) ?? null,
        run: async () => stmt.run(...vals()),
      };
      return self;
    },
  };
}

let env: Env;
const URL_ = 'https://santiagoramonycajal.org/api/juegos/cajal-sinapsis/leaderboard';
const post = (body: unknown, ip = '1.2.3.4') =>
  onRequest({ env, request: new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) }) });
const get = async (q: string) => (await (await onRequest({ env, request: new Request(`${URL_}?${q}`) })).json()) as { entries: { name: string; score: number }[] };
const entry = (o: Record<string, unknown> = {}) => ({ v: 1, board: 'maze', day: null, name: 'Neurona Veloz 27', avatar: 2, score: 1500, detail: 'Nivel 3', difficulty: 'cientifico', modifier: null, ...o });

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  env = { DB: fakeD1(db), SALT: 'prueba', ADMIN_TOKEN: 'secreto' };
});

describe('Clasificación compartida', () => {
  it('guarda y devuelve las puntuaciones ordenadas, una por alias con su mejor marca', async () => {
    expect((await post(entry())).status).toBe(200);
    await post(entry({ name: 'Axón Ágil 12', score: 3000 }), '5.5.5.5');
    await post(entry({ score: 900 })); // peor que la suya: no cambia
    await post(entry({ score: 2000 })); // mejor: se actualiza
    const r = await get('board=maze');
    expect(r.entries.map((e) => [e.name, e.score])).toEqual([['Axón Ágil 12', 3000], ['Neurona Veloz 27', 2000]]);
    expect((await get('board=story')).entries).toEqual([]);
  });

  it('rechaza alias malsonantes, puntuaciones imposibles y datos raros', async () => {
    expect((await post(entry({ name: 'p0ll4' }))).status).toBe(400);
    expect((await post(entry({ name: 'ana@cole' }))).status).toBe(400);
    expect((await post(entry({ score: 10_000_000 }))).status).toBe(400);
    expect((await post(entry({ score: 1.5 }))).status).toBe(400);
    expect((await post(entry({ board: 'poker' }))).status).toBe(400);
    expect((await post(entry({ avatar: 99 }))).status).toBe(400);
    expect((await get('board=maze')).entries).toHaveLength(0);
  });

  it('el desafío del día solo acepta el modo y el modificador de ese día', async () => {
    const day = dateKey(new Date());
    const d = dailyChallenge(day);
    expect((await post(entry({ board: d.mode, day, modifier: d.modifier, score: 500 }))).status).toBe(200);
    const other = d.mode === 'maze' ? 'arcade' : 'maze';
    expect((await post(entry({ board: other, day, modifier: d.modifier }), '9.9.9.9')).status).toBe(400);
    expect((await post(entry({ board: d.mode, day: '2020-01-01', modifier: dailyChallenge('2020-01-01').modifier }), '9.9.9.8')).status).toBe(400);
    expect((await get(`board=${d.mode}&day=${day}`)).entries).toHaveLength(1);
    expect((await get(`board=${d.mode}`)).entries).toHaveLength(0); // la general va aparte
  });

  it('limita los envíos por conexión sin guardar la IP', async () => {
    for (let i = 0; i < 8; i++) expect((await post(entry({ score: 100 + i }))).status).toBe(200);
    expect((await post(entry({ score: 999 }))).status).toBe(429);
    expect((await post(entry({ score: 999, name: 'Otra Neurona' }), '8.8.8.8')).status).toBe(200);
  });

  it('moderación: borrar y bloquear un alias necesita el token', async () => {
    await post(entry());
    const del = (auth?: string) => onRequest({ env, request: new Request(`${URL_}?name=neurona%20veloz%2027`, { method: 'DELETE', headers: auth ? { Authorization: auth } : {} }) });
    expect((await del()).status).toBe(401);
    expect((await del('Bearer secreto')).status).toBe(200);
    expect((await get('board=maze')).entries).toHaveLength(0);
    expect((await post(entry(), '7.7.7.7')).status).toBe(400); // bloqueado
  });

  it('limpia el detalle y valida sin red', () => {
    expect(cleanDetail('<b>Hola</b>\n"mundo"')).toBe('bHola/bmundo');
    expect(validateSubmission(entry({ difficulty: 'nobel' })).ok).toBe(true);
    expect(validateSubmission({ v: 2 }).ok).toBe(false);
  });

  it('otros métodos no están permitidos', async () => {
    expect((await onRequest({ env, request: new Request(URL_, { method: 'PUT' }) })).status).toBe(405);
  });
});
