# Clasificación compartida (Cloudflare Pages Functions + D1)

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
