-- Clasificación compartida de Cajal: Sinapsis 3D (Cloudflare D1)
-- Crear: npx wrangler d1 execute <NOMBRE_DE_LA_BASE> --remote --file=server/schema.sql

-- Una fila por alias, modo y día (day = '' en la clasificación general): solo su mejor puntuación
CREATE TABLE IF NOT EXISTS scores (
  board      TEXT    NOT NULL,             -- story | arcade | maze | micro | build | rhythm
  day        TEXT    NOT NULL DEFAULT '',  -- AAAA-MM-DD en el Desafío Diario
  name_key   TEXT    NOT NULL,             -- alias en minúsculas (para no duplicar)
  name       TEXT    NOT NULL,             -- alias tal como se muestra (ya filtrado)
  avatar     INTEGER NOT NULL,             -- color de la neurona (0..7)
  score      INTEGER NOT NULL,
  detail     TEXT    NOT NULL DEFAULT '',  -- «Hipocampo, oleada 3», máx. 60 caracteres
  difficulty TEXT    NOT NULL DEFAULT 'cientifico',
  modifier   TEXT,
  updated    TEXT    NOT NULL,             -- fecha ISO del récord
  PRIMARY KEY (board, day, name_key)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (board, day, score DESC);

-- Límite de envíos: resumen SHA-256 de (sal secreta + IP + fecha). No se guarda la IP.
CREATE TABLE IF NOT EXISTS rate (
  ip_hash TEXT NOT NULL,
  at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_lookup ON rate (ip_hash, at);

-- Alias bloqueados por moderación
CREATE TABLE IF NOT EXISTS banned (
  name_key TEXT PRIMARY KEY
);

-- ── Modo aula ──────────────────────────────────────────────────────────────
-- Clase: código para unirse y resumen SHA-256 de la clave del profe (la clave no se guarda)
CREATE TABLE IF NOT EXISTS classes (
  code         TEXT PRIMARY KEY,   -- 6 letras/números, p. ej. K7QMZP
  name         TEXT NOT NULL,      -- «5.º B»
  teacher_hash TEXT NOT NULL,
  created      TEXT NOT NULL,
  expires      TEXT NOT NULL       -- caduca a los 365 días
);

-- Alumnos de cada clase: alias del juego y un resumen numérico de su progreso
CREATE TABLE IF NOT EXISTS members (
  code       TEXT NOT NULL,
  name_key   TEXT NOT NULL,
  name       TEXT NOT NULL,
  avatar     INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT NOT NULL,        -- resumen del token del dispositivo del alumno
  progress   TEXT NOT NULL DEFAULT '{}',
  updated    TEXT NOT NULL,
  PRIMARY KEY (code, name_key)
);
