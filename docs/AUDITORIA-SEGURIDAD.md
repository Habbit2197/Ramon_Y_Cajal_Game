# Auditoría de seguridad — Cajal: Sinapsis 3D

Fecha: 19/11/2026 · Rama: `archivo-subruta` · Publicación prevista: `https://santiagoramonycajal.org/juegos/cajal-sinapsis/`

## Resumen

| Punto | Resultado |
|---|---|
| Peticiones de red en tiempo de ejecución | **Ninguna.** Sin `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` ni `sendBeacon` en `src/`. |
| Servicios externos / CDNs | **Ninguno.** Fuentes autoalojadas (`@fontsource-variable`), sin analítica, sin anuncios, sin cargadores de modelos remotos. |
| Variables de entorno | Solo `import.meta.env.PROD` y `import.meta.env.BASE_URL` (las pone Vite al compilar). Ningún `.env` en el repositorio; `.env*` está en `.gitignore`. |
| Claves, tokens, contraseñas | **Ninguno** en el código ni en el historial de git. |
| Datos guardados | Solo en el navegador del jugador (`localStorage`): `cajal-profile` (alias, progreso, trofeos, ajustes, clasificación local) y la prueba temporal `__cajal_probe__`. Nada sale del dispositivo. |
| Datos personales | El alias es libre y opcional, pasa por un filtro de palabras malsonantes y no se envía a ningún sitio. La clasificación es local. |
| Dependencias | `npm audit --omit=dev`: 0 vulnerabilidades. Un único lockfile (`package-lock.json`). |
| Service worker | Acotado a `/juegos/cajal-sinapsis/`. No intercepta ninguna otra ruta del sitio, solo usa cachés con prefijo `cajal-sinapsis-` y solo sirve la copia sin conexión para la portada del juego. |

## URLs que aparecen dentro de `dist/`

Todas son texto inerte de las librerías, ninguna se llama al jugar:

- `http://www.w3.org/...` — espacios de nombres SVG/XML/MathML.
- `https://react.dev/errors/` — enlace dentro de mensajes de error de React.
- `https://github.com/pmndrs/...`, `opencollective.com`, `docs.pmnd.rs`, `tailwindcss.com` — créditos y mensajes de las librerías.

## Cómo repetir la auditoría

```bash
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\.meta\.env|process\.env|api[_-]?key|secret|password" src
npm run build && grep -rhoE "https?://[a-zA-Z0-9./_-]+" dist | sort | uniq -c
git log -p | grep -iE "api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]|ghp_|AIza"
npm audit --omit=dev
```

## Comprobación del alcance del service worker

Probado con un sitio simulado (portada y artículo en la raíz, juego en `/juegos/cajal-sinapsis/`):

1. Alcance registrado: `/juegos/cajal-sinapsis/`.
2. Tras abrir el juego, el artículo de la raíz **no** queda controlado por el service worker.
3. Sin conexión: el juego abre y se juega; la portada, el artículo y `/juegos/otro-juego/` dan el error normal del navegador (no reciben el juego).

## Para publicar

- Compilar: `npm ci && npm run build` → subir el contenido de `dist/` a `/juegos/cajal-sinapsis/` del sitio.
- Otra ruta: `BASE_PATH=/juegos/otro-slug/ npm run build` (empieza y acaba en `/`).
- Añadir las cabeceras de `docs/archivo-headers.txt` al `_headers` de la raíz del sitio.
