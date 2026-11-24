# Clasificación compartida y modo aula (Cloudflare Pages Functions + D1)

El juego es estático. La única parte con servidor es la clasificación de todos: una función pequeña en el **mismo dominio** que el archivo. Si la función no está publicada, el juego sigue funcionando y usa solo la clasificación del dispositivo.

## Qué se envía y qué se guarda

| Dato | Ejemplo | Para qué |
| --- | --- | --- |
| Alias | `Neurona Veloz 27` | Se filtra en el juego y otra vez en el servidor: sin palabras malsonantes, emails, teléfonos ni webs |
| Color de la neurona | `2` | Avatar en la lista |
| Puntos | `1500` | Ordenar |
| Detalle | `Hipocampo, oleada 3` | Una línea, máximo 60 caracteres, sin símbolos HTML |
| Dificultad y modificador | `nobel`, `fragil` | Mostrar con qué reglas se jugó |
| Día del desafío | `2026-11-24` | Clasificación del Desafío Diario |

**No se guarda la IP, ni cookies, ni ningún identificador del dispositivo.** Para limitar envíos se guarda un resumen SHA-256 de `sal secreta + IP + fecha`. Cambia cada día y no se puede revertir. Esas filas se borran al cabo de una hora.

## Publicarlo en el archivo

1. Crear la base D1 y las tablas:
   ```bash
   npx wrangler d1 create cajal-leaderboard
   npx wrangler d1 execute cajal-leaderboard --remote --file=server/schema.sql
   ```
2. En el proyecto de Pages del archivo, añadir el binding **D1** con el nombre `DB` apuntando a `cajal-leaderboard`.
3. Añadir dos secretos de entorno:
   - `SALT`: un texto largo al azar. Sirve para los resúmenes del límite de envíos.
   - `ADMIN_TOKEN`: otro texto largo al azar, para moderar. Sin él no se puede borrar nada.
4. Compilar la función en un solo archivo, sin dependencias:
   ```bash
   npm run build:server        # → server/dist/leaderboard.js
   ```
5. Copiar ese archivo al repositorio del archivo como `functions/api/juegos/cajal-sinapsis/leaderboard.js`.

La ruta que usa el juego es `/api/juegos/cajal-sinapsis/leaderboard`. Para usar otra, compila el juego con `VITE_LEADERBOARD_API=/otra/ruta npm run build`. Para apagar la clasificación compartida, compílalo con `VITE_LEADERBOARD_API=off`.

## Modo aula

Lo usa la misma base de datos: las tablas `classes` y `members` ya están en `server/schema.sql`. `npm run build:server` genera también `server/dist/aula.js`. Cópialo como `functions/api/juegos/cajal-sinapsis/aula.js` en el repositorio del archivo.

Cómo funciona:

1. El profe pulsa «Aula», luego «Soy profe», y crea una clase con un nombre corto («5.º B»). Recibe dos cosas:
   - un **código** de 6 caracteres para los alumnos;
   - una **clave de profe** secreta. El servidor solo guarda su resumen SHA-256.
2. Cada alumno pulsa «Aula», luego «Soy alumno», y escribe el código. Se une con su alias del juego y su dispositivo recibe un token propio (del token también se guarda solo el resumen).
3. Cada vez que el alumno juega, su dispositivo envía un resumen **solo de números del juego**: medallas, estrellas, fichas del Museo, preguntas acertadas, partidas, desafíos, mejores puntuaciones y dificultad.
4. Con el código y la clave, el profe ve una tabla con todos los alumnos, la descarga en CSV y puede quitar alumnos o borrar la clase.

Límites:
- Máximo 60 alumnos por clase y 5 clases nuevas al día por conexión.
- Los alias pasan el mismo filtro que la clasificación.
- Las clases caducan a los 365 días y se borran solas.

Para apagarlo, compila el juego con `VITE_CLASSROOM_API=off`.

## Moderar

Borra un alias de todas las clasificaciones y lo bloquea:

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://santiagoramonycajal.org/api/juegos/cajal-sinapsis/leaderboard?name=Alias%20Feo"
```

Añadiendo `&board=maze` se borra solo de ese modo y el alias no se bloquea.

## Límites que aplica el servidor

- Alias válido según `src/game/names.ts`, el mismo filtro que usa el juego.
- Puntuación entera dentro de un máximo creíble por modo (`MAX_SCORE` en `leaderboard.ts`).
- Desafío Diario: solo se acepta el modo y el modificador de ese día, y solo con hasta un día de diferencia con la fecha del servidor.
- Máximo 8 envíos cada 10 minutos por conexión, y cuerpos de hasta 2 KB.
- Una fila por alias, modo y día: solo se guarda su mejor puntuación.
- Los desafíos de hace más de 30 días se borran solos.

Como cualquier clasificación de un juego web, alguien con conocimientos podría enviar una puntuación inventada que pase estos límites. Para eso está la moderación.

## Probarlo en local

```bash
npm run build && npm run serve:local
# Juego: http://localhost:4173/juegos/cajal-sinapsis/
```

Sirve el juego en su subruta, una portada de ejemplo y la API con SQLite en memoria (Node 22 o superior). Los tests de `server/leaderboard.test.ts` usan el mismo esquema contra SQLite real.
