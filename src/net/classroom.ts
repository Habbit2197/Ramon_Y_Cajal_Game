/**
 * classroom.ts — Modo aula: crear clase, unirse, enviar el progreso y verlo como profe.
 *
 * Habla solo con el propio sitio (/api/juegos/cajal-sinapsis/aula). Se apaga al compilar con
 * VITE_CLASSROOM_API=off. Si el servidor no existe, el panel lo dice y el juego sigue igual.
 */
import type { ClassProgress } from '../game/classroom';

const RAW = (import.meta.env.VITE_CLASSROOM_API as string | undefined) ?? '/api/juegos/cajal-sinapsis/aula';
export const CLASSROOM_ENDPOINT = RAW === 'off' || import.meta.env.MODE === 'test' ? '' : RAW;
export const classroomEnabled = () => CLASSROOM_ENDPOINT !== '' && typeof fetch === 'function';

export class ClassroomError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

/** Mensaje claro para cada error del servidor */
export function classroomMessage(e: unknown): string {
  const code = e instanceof ClassroomError ? e.code : 'red';
  return (
    {
      clase: 'No existe ninguna clase con ese código. Revísalo con tu profe.',
      codigo: 'El código tiene 6 letras y números.',
      'alias ocupado': 'En esa clase ya hay alguien con tu alias. Cámbialo y vuelve a probar.',
      'clase llena': 'La clase está llena.',
      alias: 'Tu alias no vale para la clase. Prueba con otro.',
      nombre: 'Ese nombre de clase no vale. Usa algo como «5.º B».',
      espera: 'Has creado muchas clases hoy. Prueba mañana.',
      'no autorizado': 'El código o la clave de profe no coinciden.',
      red: 'No hay conexión con el servidor del aula. Inténtalo más tarde.',
    } as Record<string, string>
  )[code] ?? 'Algo ha fallado. Inténtalo más tarde.';
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', body?: unknown, opts: { auth?: string; code?: string } = {}): Promise<T> {
  if (!classroomEnabled()) throw new ClassroomError('red', 0);
  const url = new URL(CLASSROOM_ENDPOINT, window.location.href);
  if (opts.code) url.searchParams.set('code', opts.code);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(opts.auth ? { Authorization: `Bearer ${opts.auth}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new ClassroomError('red', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ClassroomError(data.error ?? (res.status === 404 ? 'red' : 'error'), res.status);
  return data;
}

export const createClass = (className: string) => call<{ code: string; teacherKey: string; className: string }>('POST', { action: 'create', className });
export const joinClass = (code: string, name: string, avatar: number) => call<{ className: string; studentToken: string }>('POST', { action: 'join', code, name, avatar });
export const leaveClass = (code: string, name: string, token: string) => call<{ ok: true }>('POST', { action: 'leave', code, name, token });
export const syncClass = (code: string, name: string, token: string, avatar: number, progress: ClassProgress) =>
  call<{ ok: true; className: string }>('POST', { action: 'sync', code, name, token, avatar, progress });

export interface ClassView {
  className: string;
  code: string;
  students: { name: string; avatar: number; updated: string; progress: Partial<ClassProgress> }[];
}
export const viewClass = (code: string, teacherKey: string) => call<ClassView>('GET', undefined, { auth: teacherKey, code });
export const removeStudent = (code: string, teacherKey: string, name: string) => call<{ ok: true }>('POST', { action: 'remove', code, name }, { auth: teacherKey });
export const deleteClass = (code: string, teacherKey: string) => call<{ ok: true }>('DELETE', undefined, { auth: teacherKey, code });

// ── Envío automático del progreso (como mucho cada 20 s, y al cerrar la pestaña) ──
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: (() => Promise<unknown>) | null = null;
let lastSent = 0;
export function scheduleClassSync(send: () => Promise<unknown>) {
  if (!classroomEnabled()) return;
  pending = send;
  if (timer) return;
  const wait = Math.max(3000, 20_000 - (Date.now() - lastSent));
  timer = setTimeout(flushClassSync, wait);
}
export function flushClassSync() {
  if (timer) clearTimeout(timer);
  timer = null;
  const p = pending;
  pending = null;
  if (!p) return;
  lastSent = Date.now();
  void p().catch(() => {});
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushClassSync);
