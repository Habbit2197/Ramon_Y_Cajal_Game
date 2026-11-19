/* Service worker de Cajal: Sinapsis 3D — generado al compilar (vite.config.ts) a partir de sw-template.js.
 *
 * Vive en __BASE__sw.js y solo controla esa ruta: el resto del sitio (el archivo) no lo toca nunca.
 * - Al instalar guarda el juego: después funciona sin conexión.
 * - La página del juego se pide primero a la red (versiones nuevas); sin red, usa la copia.
 * - El resto de archivos del juego sale de la copia guardada.
 * - Cualquier petición fuera de __BASE__ se ignora: la atiende el navegador como si no hubiera service worker. */
const BASE = '__BASE__';
const CACHE_PREFIX = '__CACHE_PREFIX__';
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
// Los servidores envían «Vary: Origin» o «Vary: Accept-Encoding»: los scripts de tipo módulo llevan Origin
// y no coincidirían con la copia guardada al instalar. Se ignora Vary al buscar.
const MATCH = { ignoreVary: true };

const inScope = (url) => url.origin === self.location.origin && url.pathname.startsWith(BASE);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // solo borra versiones antiguas de ESTE juego
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!inScope(url)) return; // fuera del juego: no se intercepta

  if (req.mode === 'navigate') {
    // Solo la portada del juego tiene copia: otras rutas bajo BASE van a la red sin sustituto
    const isGamePage = url.pathname === BASE || url.pathname === BASE + 'index.html';
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isGamePage && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(BASE, copy));
          }
          return res;
        })
        .catch((err) => (isGamePage ? caches.match(BASE, MATCH).then((hit) => hit || Promise.reject(err)) : Promise.reject(err))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
