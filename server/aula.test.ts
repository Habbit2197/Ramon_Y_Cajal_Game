/**
 * aula.test.ts — Modo aula contra SQLite real (mismo esquema que D1).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest, checkClassName, cleanProgress, CODE_RE } from './aula';
import type { D1Like, D1Stmt, Env } from './leaderboard';

function fakeD1(db: DatabaseSync): D1Like {
  return {
    prepare(sql: string): D1Stmt {
      let args: unknown[] = [];
      const stmt = db.prepare(sql.replace(/\?(\d+)/g, '?'));
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
const U = 'https://santiagoramonycajal.org/api/juegos/cajal-sinapsis/aula';
const post = async (body: unknown, auth?: string, ip = '1.1.1.1') => {
  const r = await onRequest({ env, request: new Request(U, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) }) });
  return { status: r.status, data: (await r.json()) as Record<string, unknown> };
};
const view = async (code: string, key?: string) => {
  const r = await onRequest({ env, request: new Request(`${U}?code=${code}`, { headers: key ? { Authorization: `Bearer ${key}` } : {} }) });
  return { status: r.status, data: (await r.json()) as { className: string; students: { name: string; progress: Record<string, number> }[] } };
};
const progress = { medals: 5, stars: 7, museum: 12, quiz: 9, games: 20, labGames: 4, daily: 2, streak: 2, storyBest: 3400, arcadeBest: 12000, mazeBest: 4000, microBest: 1800, buildBest: 2900, rhythmBest: 7000, difficulty: 'nobel' };

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  env = { DB: fakeD1(db), SALT: 'prueba' };
});

describe('Modo aula', () => {
  it('el profe crea una clase, los alumnos se unen y envían su progreso, y el profe lo ve', async () => {
    const c = await post({ action: 'create', className: '5.º B' });
    expect(c.status).toBe(200);
    const code = c.data.code as string, key = c.data.teacherKey as string;
    expect(code).toMatch(CODE_RE);
    expect(key.length).toBeGreaterThanOrEqual(24);

    const j = await post({ action: 'join', code, name: 'Neurona Veloz 27', avatar: 3 });
    expect(j.status).toBe(200);
    expect(j.data.className).toBe('5.º B');
    const token = j.data.studentToken as string;
    expect((await post({ action: 'sync', code, name: 'Neurona Veloz 27', token, avatar: 3, progress })).status).toBe(200);
    await post({ action: 'join', code: code.toLowerCase(), name: 'Axón Ágil 12', avatar: 1 });

    const v = await view(code, key);
    expect(v.status).toBe(200);
    expect(v.data.students.map((s) => s.name)).toEqual(['Axón Ágil 12', 'Neurona Veloz 27']);
    expect(v.data.students[1].progress).toMatchObject({ medals: 5, museum: 12, difficulty: 'nobel' });
  });

  it('sin la clave del profe no se ve nada; sin el token del alumno no se puede escribir', async () => {
    const { data } = await post({ action: 'create', className: 'Ciencias' });
    const code = data.code as string;
    await post({ action: 'join', code, name: 'Soma Sutil 80' });
    expect((await view(code)).status).toBe(401);
    expect((await view(code, 'clave-inventada-0000000000')).status).toBe(401);
    expect((await post({ action: 'sync', code, name: 'Soma Sutil 80', token: 'falso', progress })).status).toBe(401);
    expect((await post({ action: 'leave', code, name: 'Soma Sutil 80', token: 'falso' })).status).toBe(401);
  });

  it('no deja alias repetidos, malsonantes ni clases inexistentes', async () => {
    const { data } = await post({ action: 'create', className: 'Grupo A' });
    const code = data.code as string;
    await post({ action: 'join', code, name: 'Mielina Feliz 40' });
    expect((await post({ action: 'join', code, name: 'mielina feliz 40' })).status).toBe(409);
    expect((await post({ action: 'join', code, name: 'p0ll4' })).status).toBe(400);
    expect((await post({ action: 'join', code: 'ZZZZZZ', name: 'Glía Ágil 11' })).status).toBe(404);
    expect((await post({ action: 'create', className: 'mierda' })).status).toBe(400);
  });

  it('el profe puede quitar alumnos y borrar la clase; el alumno puede salir', async () => {
    const { data } = await post({ action: 'create', className: 'Grupo B' });
    const code = data.code as string, key = data.teacherKey as string;
    const a = await post({ action: 'join', code, name: 'Soma Fugaz 33' });
    await post({ action: 'join', code, name: 'Impulso Tenaz 21' });
    expect((await post({ action: 'remove', code, name: 'Impulso Tenaz 21' }, key)).status).toBe(200);
    expect((await post({ action: 'leave', code, name: 'Soma Fugaz 33', token: a.data.studentToken })).status).toBe(200);
    expect((await view(code, key)).data.students).toHaveLength(0);
    const del = await onRequest({ env, request: new Request(`${U}?code=${code}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } }) });
    expect(del.status).toBe(200);
    expect((await view(code, key)).status).toBe(401);
  });

  it('limita cuántas clases se crean al día desde una conexión', async () => {
    for (let i = 0; i < 5; i++) expect((await post({ action: 'create', className: `Clase ${i + 1}` }, undefined, '9.9.9.9')).status).toBe(200);
    expect((await post({ action: 'create', className: 'Clase 6' }, undefined, '9.9.9.9')).status).toBe(429);
  });

  it('valida nombres de clase y recorta el progreso a valores posibles', () => {
    expect(checkClassName('3.º ESO A')).toBe('3.º ESO A');
    expect(checkClassName('ana@cole')).toBeNull();
    expect(checkClassName('x')).toBeNull();
    expect(cleanProgress({ ...progress, stars: 999, medals: -1 })).toBeNull();
    expect(cleanProgress({ ...progress, stars: 999 })!.stars).toBe(18);
    expect(cleanProgress({ medals: 1 })!.difficulty).toBe('cientifico');
  });
});
