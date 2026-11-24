/**
 * names.ts — Alias de jugador seguros para un público infantil
 *
 * El alias solo vive en este dispositivo (localStorage). Aun así se filtra:
 * - longitud 2–16, letras (con tildes y ñ), números, espacio, guion, punto y guion bajo;
 * - nada que parezca un email, un teléfono o una web;
 * - una lista corta de palabras malsonantes, también escritas con números (p0ll0 → pollo).
 */

export const NAME_MAX = 16;

const ALLOWED = /^[\p{L}\p{N} ._-]+$/u;

const BLOCKED = [
  'puta', 'puto', 'mierda', 'joder', 'jodete', 'cono', 'cabron', 'gilipollas', 'polla', 'follar',
  'maricon', 'zorra', 'imbecil', 'subnormal', 'retrasad', 'nazi', 'hitler', 'sexo', 'culo',
  'pene', 'verga', 'hostia', 'capullo', 'pendej', 'mamon', 'chinga', 'fuck', 'shit', 'bitch', 'porn',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

/** Minúsculas, sin tildes, sin separadores y con los números «leet» convertidos en letras. */
export function normalizeForFilter(s: string): string {
  return s
    .split(/[\s._-]+/)
    .filter((tok) => !/^\d+$/.test(tok)) // un número suelto («Tenaz 12») no es «leet»: evita falsos positivos
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134579@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-zñ]/g, '');
}

/** ¿Contiene alguna palabra bloqueada (también disfrazada)? */
export function containsBlocked(value: string): boolean {
  const n = normalizeForFilter(value);
  return BLOCKED.some((w) => n.includes(w));
}

export type NameCheck = { ok: true; value: string } | { ok: false; reason: string };

export function checkPlayerName(raw: string): NameCheck {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (value.length < 2) return { ok: false, reason: 'Escribe al menos 2 letras.' };
  if (value.length > NAME_MAX) return { ok: false, reason: `Máximo ${NAME_MAX} caracteres.` };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'Usa solo letras, números, espacios, «-», «_» o «.».' };
  if (/\d{6,}/.test(value.replace(/[\s.-]/g, ''))) return { ok: false, reason: 'No pongas números de teléfono.' };
  if (/(www|http|\.com|\.es|\.net)/i.test(value)) return { ok: false, reason: 'No pongas direcciones web.' };
  const n = normalizeForFilter(value);
  if (BLOCKED.some((w) => n.includes(w))) return { ok: false, reason: 'Ese nombre no está permitido. Prueba otro.' };
  return { ok: true, value };
}

// Adjetivos invariables en género: sirven para cualquier sustantivo.
const NOUNS = ['Neurona', 'Dendrita', 'Axón', 'Sinapsis', 'Mielina', 'Astrocito', 'Impulso', 'Soma', 'Glía', 'Cerebelo'];
const ADJS = ['Veloz', 'Brillante', 'Valiente', 'Audaz', 'Feliz', 'Fugaz', 'Genial', 'Ágil', 'Tenaz', 'Sutil'];

/** Alias aleatorio tipo «Neurona Veloz 27» (cabe siempre en 16 caracteres). */
export function randomAlias(rng: () => number = Math.random): string {
  for (let tries = 0; tries < 20; tries++) {
    const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
    const adj = ADJS[Math.floor(rng() * ADJS.length)];
    const num = 10 + Math.floor(rng() * 90);
    const alias = `${noun} ${adj} ${num}`;
    if (alias.length <= NAME_MAX) return alias;
  }
  return `Neurona ${10 + Math.floor(rng() * 90)}`;
}
