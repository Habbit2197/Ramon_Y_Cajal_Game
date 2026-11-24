/**
 * useSession.ts — Qué se está jugando ahora mismo (no se guarda).
 *
 * Si la partida es el Desafío Diario, aquí está el desafío; al terminar, `finishRun`
 * envía la puntuación a la clasificación (general y del día) y apunta el resultado.
 */
import { create } from 'zustand';
import type { DailyChallenge, PlayId } from '../game/daily';
import { setActiveDifficulty } from '../game/difficulty';
import { useProfileStore, aliasKey } from './useProfileStore';

interface SessionState {
  daily: DailyChallenge | null;
  /** Empieza una partida normal (dificultad del alias) o el desafío (Científico + modificador) */
  begin: (daily: DailyChallenge | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  daily: null,
  begin: (daily) => {
    if (daily) setActiveDifficulty('cientifico', daily.modifier);
    else {
      const p = useProfileStore.getState();
      setActiveDifficulty(p.progress[aliasKey(p.playerName)]?.difficulty ?? 'cientifico');
    }
    set({ daily });
  },
}));

/** El desafío activo si corresponde a este modo */
export const dailyFor = (mode: PlayId) => {
  const d = useSession.getState().daily;
  return d && d.mode === mode ? d : null;
};

/**
 * Cierra una partida: clasificación (y la del día si es el desafío) y resultado del desafío.
 * Devuelve el puesto en la clasificación local, o null.
 */
export function finishRun(mode: PlayId, score: number, detail: string, completed: boolean): number | null {
  const daily = dailyFor(mode);
  const profile = useProfileStore.getState();
  const rank = profile.submitScore(mode, score, detail, daily ? { daily: daily.key } : undefined);
  if (daily) profile.recordDaily(daily.key, score, completed);
  return rank;
}
