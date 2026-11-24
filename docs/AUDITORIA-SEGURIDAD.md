# Auditoría de seguridad: Cajal: Sinapsis 3D

- Fecha: 24/11/2026
- Publicación prevista: `https://santiagoramonycajal.org/juegos/cajal-sinapsis/`
- Cambio importante desde la auditoría del 19/11: ahora hay una **clasificación compartida**. Es la única parte que usa la red y solo habla con el propio sitio. Si no se publica la función del servidor, el juego funciona igual que antes, sin red.

## Resumen

| Punto | Resultado |
|---|---|
| Peticiones de red al jugar | Solo a **la misma dirección del sitio**: `/api/juegos/cajal-sinapsis/leaderboard` (`src/net/onlineBoard.ts`) y, si se usa el modo aula, `/api/juegos/cajal-sinapsis/aula` (`src/net/classroom.ts`). No hay más `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` ni `sendBeacon`. Se envía sin cookies (`credentials: 'omit'`). |
| Servicios externos / CDNs | **Ninguno.** Fuentes autoalojadas, sin analítica, sin anuncios, sin cargadores remotos. |
| Variables de entorno | `import.meta.env.PROD`, `BASE_URL`, `MODE` y la opcional `VITE_LEADERBOARD_API`: solo una ruta, no es secreta. Ningún `.env` en el repositorio. |
| Claves, tokens, contraseñas | **Ninguno** en el juego ni en el historial. El servidor usa dos secretos (`SALT`, `ADMIN_TOKEN`) que se configuran en Cloudflare, nunca en el código. |
| Datos que salen del dispositivo | Solo si se publica la función: alias filtrado, color de avatar, puntos, una línea de detalle, la dificultad y el día del desafío. Se puede desactivar en Ajustes («Publicar en la clasificación de todos»). |
| Datos en el servidor | Sin IP, sin cookies, sin identificadores. Límite de envíos con un resumen SHA-256 de sal + IP + fecha, que se borra al cabo de una hora. Ver `server/README.md`. |
| Datos en el navegador | `localStorage`: `cajal-profile` (alias, progreso, medallas, fichas del Museo, ajustes, clasificación local), `cajal-meta` (ajustes y cartas del Arcade), `cajal-pending-scores` (puntuaciones esperando conexión, máximo 20) y la prueba temporal `__cajal_probe__`. |
| Modo aula | Opcional. El profe tiene una clave secreta (en el servidor solo se guarda su resumen SHA-256). El alumno comparte con su clase su alias y números del juego, nada más. Las clases caducan en un año. Ver `server/README.md`. |
| Alias | Entre 2 y 16 caracteres; sin emails, teléfonos, webs ni palabras malsonantes (también disfrazadas con números). El filtro se aplica en el juego y otra vez en el servidor. Moderación con borrado y bloqueo. |
| Dependencias | `npm audit --omit=dev`: 0 vulnerabilidades. Un único lockfile (`package-lock.json`). Eliminado `@types/express`, que no se usaba. |
| Service worker | Acotado a `/juegos/cajal-sinapsis/`. No intercepta la API (está fuera de su ruta), ni ninguna otra parte del sitio. Solo usa cachés con el prefijo `cajal-sinapsis-`. |

## URLs que aparecen dentro de `dist/`

Todas son texto de las librerías y ninguna se llama al jugar:
- `http://www.w3.org/...`: espacios de nombres SVG, XML y MathML.
- `https://react.dev/errors/`: enlace dentro de los mensajes de error de React.
- `github.com/pmndrs/...`, `opencollective.com`, `docs.pmnd.rs`, `tailwindcss.com`: créditos y mensajes de las librerías.

La única petición real es la ruta relativa de la clasificación.

## Cómo repetir la auditoría

Peticiones, variables y secretos en el código:

```bash
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\.meta\.env|process\.env|api[_-]?key|secret|password" src
```

URLs dentro de la versión compilada:

```bash
npm run build && grep -rhoE "https?://[a-zA-Z0-9./_-]+" dist | sort | uniq -c
```

Secretos en el historial de git:

```bash
git log -p | grep -iE "api[_-]?key\s*[:=]|secret\s*[:=]|password\s*[:=]|ghp_|AIza"
```

Vulnerabilidades en las dependencias:

```bash
npm audit --omit=dev
```

Tests del juego y del servidor (este último contra SQLite):

```bash
npx vitest run
```

## Comprobación del service worker

Probado con un sitio simulado: portada y artículo en la raíz, juego en `/juegos/cajal-sinapsis/` y la API en `/api/...`.

1. El alcance registrado es `/juegos/cajal-sinapsis/`.
2. Después de abrir el juego, la portada y los artículos **no** quedan controlados por el service worker.
3. Sin conexión, el juego abre y se puede jugar. La portada, los artículos y `/juegos/otro-juego/` dan el error normal del navegador, no el juego.
4. Sin conexión, las puntuaciones se guardan en cola y se envían al volver la red.

## Para publicar

1. Juego: `npm ci && npm run build`. Subir el contenido de `dist/` a `/juegos/cajal-sinapsis/`. Para otra ruta: `BASE_PATH=/juegos/otro-slug/ npm run build`.
2. Cabeceras: añadir las de `docs/archivo-headers.txt` al `_headers` de la raíz del sitio.
3. Clasificación compartida (opcional): seguir `server/README.md`. Hay que crear la base D1, configurar los secretos y copiar `server/dist/leaderboard.js` a `functions/`.
