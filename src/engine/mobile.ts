/**
 * mobile.ts — Detalles de navegador y móvil que no son del juego en sí.
 *
 * - Audio en iPhone/iPad: Safari solo deja sonar el audio si se activa dentro de un toque.
 * - Al cambiar de app o de pestaña: el audio se suspende y la partida se pausa.
 * - Pantalla encendida mientras se juega (Wake Lock), donde el navegador lo permita.
 */
import { useEffect } from 'react';
import { soundEngine } from '../game/sound';

let installed = false;

/** Llamar una vez al arrancar. Desbloquea el audio con el primer toque, clic o tecla. */
export function installAudioUnlock() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const unlock = () => {
    soundEngine.unlock();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchend', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchend', unlock, true);
  window.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) soundEngine.suspend();
    else soundEngine.resume();
  });
}

/** Pausa la partida si la pestaña o la app pasan a segundo plano. */
export function useAutoPause(active: boolean, pause: () => void) {
  useEffect(() => {
    if (!active) return;
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', pause);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', pause);
    };
  }, [active, pause]);
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Mantiene la pantalla encendida mientras `active` (si el navegador lo admite). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!active || !nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.hidden) return;
      nav.wakeLock!.request('screen').then((l) => {
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      }).catch(() => {}); // sin permiso o sin batería: no pasa nada
    };
    acquire();
    const onVisible = () => { if (!document.hidden) acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
