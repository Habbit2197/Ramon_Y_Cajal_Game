/**
 * local.ts — Prueba local del juego publicado en su subruta y de la clasificación compartida.
 *
 *   npm run build && npm run serve:local      → http://localhost:4173/juegos/cajal-sinapsis/
 *
 * Sirve dist/ en BASE_PATH (por defecto /juegos/cajal-sinapsis/), una portada de ejemplo en «/»
 * y la API en /api/juegos/cajal-sinapsis/leaderboard con SQLite en memoria (mismo esquema que D1).
 * Solo para probar: en producción la API es la función de Cloudflare (server/leaderboard.ts).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onRequest, type D1Like, type D1Stmt } from './leaderboard';

const PORT = Number(process.env.PORT ?? 4173);
const BASE = process.env.BASE_PATH ?? '/juegos/cajal-sinapsis/';
const API = '/api/juegos/cajal-sinapsis/leaderboard';
const DIST = join(import.meta.dirname, '..', 'dist');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8'));
const DB: D1Like = {
  prepare(sql) {
    let args: unknown[] = [];
    const order = [...sql.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]) - 1);
    const stmt = db.prepare(sql.replace(/\?(\d+)/g, '?'));
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

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname === API) {
    const body = req.method === 'POST' ? await new Promise<string>((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); }) : undefined;
    const r = await onRequest({
      env: { DB, SALT: 'local', ADMIN_TOKEN: process.env.ADMIN_TOKEN },
      request: new Request(url, { method: req.method, headers: { ...(req.headers as Record<string, string>), 'CF-Connecting-IP': req.socket.remoteAddress ?? '' }, body }),
    });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
    return;
  }
  if (url.pathname === '/' || url.pathname === '/articulo.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Archivo</title><h1>${url.pathname === '/' ? 'Portada del archivo' : 'Artículo'}</h1><a href="${BASE}">Ir al juego</a>`);
    return;
  }
  if (url.pathname.startsWith(BASE)) {
    let rel = url.pathname.slice(BASE.length) || 'index.html';
    let file = normalize(join(DIST, rel));
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) { rel = 'index.html'; file = join(DIST, rel); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404).end('No encontrado');
}).listen(PORT, () => console.log(`Juego: http://localhost:${PORT}${BASE}\nAPI:   http://localhost:${PORT}${API}`));
