/* Service worker de Cajal: Sinapsis 3D — generado al compilar (vite.config.ts) a partir de sw-template.js.
 * - Al instalar guarda todo el juego: después funciona sin conexión, también en el aula.
 * - La página (index.html) se pide primero a la red para recibir versiones nuevas; sin red, usa la copia.
 * - El resto (JS, CSS, iconos, fuentes) sale de la copia guardada: carga instantánea. */
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
// Los servidores envían «Vary: Origin» o «Vary: Accept-Encoding»: los scripts de tipo módulo llevan Origin
// y no coincidirían con la copia guardada al instalar. Se ignora Vary al buscar.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cajal-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/', MATCH).then((hit) => hit || caches.match('/index.html', MATCH))),
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
