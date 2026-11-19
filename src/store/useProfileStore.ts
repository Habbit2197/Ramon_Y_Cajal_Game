/**
 * useProfileStore.ts — Alias, progreso por jugador y clasificación local
 *
 * Todo se guarda en localStorage de ESTE dispositivo: no hay servidor, cuentas ni red.
 * En un aula con ordenadores compartidos, cada alias tiene su propio progreso
 * (medallas, estrellas, tutoriales vistos) y la clasificación reúne a todos.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { checkPlayerName } from '../game/names';
import { EMPTY_STATS, TROPHIES, newlyUnlocked, starsForWin, type PlayerStats } from '../game/trophies';
import { useToastStore } from './useToastStore';

export type GameMode = 'story' | 'arcade' | 'maze';
export const GAME_MODES: GameMode[] = ['story', 'arcade', 'maze'];

export interface ScoreEntry {
  id: string;
  name: string;
  avatar: number;
  score: number;
  /** Resumen legible: «Patio del Colegio, completado» o «Hipocampo, oleada 3» */
  detail: string;
  /** ISO 8601 */
  date: string;
}

export interface PlayerProgress {
  stats: PlayerStats;
  /** índice de nivel → mejores estrellas (0..3) */
  stars: Record<number, number>;
  /** región del Arcade → mejores estrellas (0..3) */
  arcadeStars: Record<number, number>;
  /** id de medalla → fecha ISO */
  trophies: Record<string, string>;
  onboarding: Record<GameMode, boolean>;
}

export const LEADERBOARD_SIZE = 20;
export const AVATAR_COUNT = 8;

const emptyProgress = (): PlayerProgress => ({
  stats: { ...EMPTY_STATS, levelsCompleted: [] },
  stars: {},
  arcadeStars: {},
  trophies: {},
  onboarding: { story: false, arcade: false, maze: false },
});

/** Clave del progreso: el alias sin mayúsculas ni espacios sobrantes */
export const aliasKey = (name: string) => name.trim().toLowerCase();

export interface StoryResult {
  won: boolean;
  levelIndex: number;
  seconds: number;
  vitality: number;
  maxVitality: number;
  hazardsHit: number;
  habits: number;
}

export interface ArcadeCheckpoint {
  region?: number;
  wave?: number;
  level?: number;
  evolutions?: number;
  perfectDashes?: number; // incrementos
  tankSplits?: number; // incrementos
  endlessWave?: number;
}

interface ProfileState {
  playerName: string;
  avatar: number;
  leaderboard: Record<GameMode, ScoreEntry[]>;
  progress: Record<string, PlayerProgress>;
  /** Id de la última entrada enviada, para resaltarla */
  lastEntryId: string | null;
  setPlayerName: (raw: string) => { ok: boolean; reason?: string };
  setAvatar: (i: number) => void;
  /** Devuelve la posición (1 = primero) o null si no entra en el top. */
  submitScore: (mode: GameMode, score: number, detail: string) => number | null;
  clearLeaderboard: () => void;
  recordStory: (r: StoryResult) => { stars: number };
  recordArcade: (c: ArcadeCheckpoint) => void;
  recordArcadeStars: (region: number, stars: number) => void;
  recordArcadeEnd: (r: { won: boolean; kills: number; region: number; wave: number; level: number }) => void;
  /** Avances durante la partida del Laberinto (los incrementos se suman) */
  recordMaze: (c: { level?: number; stuns?: number; bestChain?: number }) => void;
  recordMazeEnd: (r: { level: number; score: number }) => void;
  setOnboardingSeen: (mode: GameMode, seen: boolean) => void;
}

/** Inserta y ordena: más puntos primero; a igualdad, quien llegó antes. Función pura (testeable). */
export function insertScore(list: ScoreEntry[], entry: ScoreEntry, size = LEADERBOARD_SIZE): { list: ScoreEntry[]; rank: number | null } {
  const next = [...list, entry]
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
    .slice(0, size);
  const idx = next.findIndex((e) => e.id === entry.id);
  return { list: next, rank: idx >= 0 ? idx + 1 : null };
}

const memoryFallback = new Map<string, string>();
const safeStorage = createJSONStorage(() => {
  try {
    const k = '__cajal_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    // Modo incógnito estricto o navegador escolar con almacenamiento bloqueado
    return {
      getItem: (n: string) => memoryFallback.get(n) ?? null,
      setItem: (n: string, v: string) => void memoryFallback.set(n, v),
      removeItem: (n: string) => void memoryFallback.delete(n),
    };
  }
});

// JSON no guarda Infinity: lo convertimos a un número grande al leer/escribir
const BIG = 1e9;

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => {
      /** Aplica un cambio al progreso del alias actual, evalúa medallas y avisa de las nuevas. */
      const update = (fn: (p: PlayerProgress) => void) => {
        const s = get();
        if (!s.playerName) return;
        const key = aliasKey(s.playerName);
        const prev = s.progress[key] ?? emptyProgress();
        const p: PlayerProgress = {
          stats: { ...EMPTY_STATS, ...prev.stats, levelsCompleted: [...(prev.stats.levelsCompleted ?? [])] },
          stars: { ...prev.stars },
          arcadeStars: { ...(prev.arcadeStars ?? {}) },
          trophies: { ...prev.trophies },
          onboarding: { ...prev.onboarding },
        };
        fn(p);
        const fresh = newlyUnlocked(p.stats, p.stars, p.trophies, p.arcadeStars);
        const now = new Date().toISOString();
        for (const id of fresh) {
          p.trophies[id] = now;
          const t = TROPHIES.find((x) => x.id === id)!;
          useToastStore.getState().push({ kind: 'trophy', title: t.name, body: t.how });
        }
        set({ progress: { ...s.progress, [key]: p } });
      };

      return {
        playerName: '',
        avatar: 0,
        leaderboard: { story: [], arcade: [], maze: [] },
        progress: {},
        lastEntryId: null,

        setPlayerName: (raw) => {
          const r = checkPlayerName(raw);
          if (!r.ok) return { ok: false, reason: r.reason };
          set({ playerName: r.value });
          return { ok: true };
        },

        setAvatar: (i) => set({ avatar: ((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT }),

        submitScore: (mode, score, detail) => {
          const s = get();
          if (!s.playerName || score <= 0) return null;
          const entry: ScoreEntry = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            name: s.playerName,
            avatar: s.avatar,
            score: Math.round(score),
            detail,
            date: new Date().toISOString(),
          };
          const { list, rank } = insertScore(s.leaderboard[mode] ?? [], entry);
          set({ leaderboard: { ...s.leaderboard, [mode]: list }, lastEntryId: rank ? entry.id : null });
          if (rank) update((p) => { p.stats.bestRank = Math.min(p.stats.bestRank, rank); });
          return rank;
        },

        clearLeaderboard: () => set({ leaderboard: { story: [], arcade: [], maze: [] }, lastEntryId: null }),

        recordStory: (r) => {
          let stars = 0;
          update((p) => {
            const st = p.stats;
            st.storyGames++;
            st.habitsCollected += r.habits;
            if (r.won) {
              st.storyWins++;
              if (!st.levelsCompleted.includes(r.levelIndex)) st.levelsCompleted.push(r.levelIndex);
              if (r.hazardsHit === 0) st.flawlessWins++;
              st.fastestWin = Math.min(st.fastestWin, r.seconds);
              stars = starsForWin(r.vitality, r.maxVitality, r.seconds);
              p.stars[r.levelIndex] = Math.max(p.stars[r.levelIndex] ?? 0, stars);
            }
          });
          return { stars };
        },

        recordArcade: (c) =>
          update((p) => {
            const st = p.stats;
            if (c.region !== undefined) st.arcadeBestRegion = Math.max(st.arcadeBestRegion, c.region);
            if (c.wave !== undefined) st.arcadeBestWave = Math.max(st.arcadeBestWave, c.wave);
            if (c.level !== undefined) st.arcadeBestLevel = Math.max(st.arcadeBestLevel, c.level);
            if (c.evolutions !== undefined) st.evolutions = Math.max(st.evolutions, c.evolutions);
            if (c.perfectDashes) st.perfectDashes += c.perfectDashes;
            if (c.tankSplits) st.tankSplits += c.tankSplits;
            if (c.endlessWave !== undefined) st.arcadeBestEndless = Math.max(st.arcadeBestEndless, c.endlessWave);
          }),

        recordArcadeStars: (region, stars) =>
          update((p) => { p.arcadeStars[region] = Math.max(p.arcadeStars[region] ?? 0, stars); }),

        recordArcadeEnd: (r) =>
          update((p) => {
            const st = p.stats;
            st.arcadeGames++;
            st.totalKills += r.kills;
            st.arcadeBestRegion = Math.max(st.arcadeBestRegion, r.region);
            st.arcadeBestWave = Math.max(st.arcadeBestWave, r.wave);
            st.arcadeBestLevel = Math.max(st.arcadeBestLevel, r.level);
            if (r.won) st.arcadeWins++;
          }),

        recordMaze: (c) =>
          update((p) => {
            const st = p.stats;
            if (c.level !== undefined) st.mazeBestLevel = Math.max(st.mazeBestLevel, c.level);
            if (c.bestChain !== undefined) st.mazeBestChain = Math.max(st.mazeBestChain, c.bestChain);
            if (c.stuns) st.mazeStuns += c.stuns;
          }),

        recordMazeEnd: (r) =>
          update((p) => {
            const st = p.stats;
            st.mazeGames++;
            st.mazeBestLevel = Math.max(st.mazeBestLevel, r.level);
            st.mazeBestScore = Math.max(st.mazeBestScore, r.score);
          }),

        setOnboardingSeen: (mode, seen) => update((p) => { p.onboarding[mode] = seen; }),
      };
    },
    {
      name: 'cajal-profile',
      version: 4,
      storage: safeStorage,
      partialize: (s) => ({
        playerName: s.playerName,
        avatar: s.avatar,
        leaderboard: s.leaderboard,
        progress: Object.fromEntries(
          Object.entries(s.progress).map(([k, p]) => [
            k,
            { ...p, stats: { ...p.stats, fastestWin: Math.min(p.stats.fastestWin, BIG), bestRank: Math.min(p.stats.bestRank, BIG) } },
          ]),
        ),
      }),
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<ProfileState>;
        if (version < 2) s.progress = {};
        // v3: modo Laberinto (clasificación propia y estadísticas nuevas con valor por defecto)
        s.leaderboard = Object.assign({ story: [], arcade: [], maze: [] }, s.leaderboard);
        for (const p of Object.values(s.progress ?? {})) {
          p.stats = { ...EMPTY_STATS, ...p.stats, fastestWin: p.stats?.fastestWin ?? 1e9, bestRank: p.stats?.bestRank ?? 1e9 };
          p.onboarding = Object.assign({ story: false, arcade: false, maze: false }, p.onboarding);
          p.arcadeStars = p.arcadeStars ?? {}; // v4
        }
        return s as ProfileState;
      },
    },
  ),
);

/** Progreso del alias actual (o vacío si aún no hay alias). */
export function useCurrentProgress(): PlayerProgress {
  return useProfileStore((s) => (s.playerName && s.progress[aliasKey(s.playerName)]) || EMPTY_PROGRESS);
}
const EMPTY_PROGRESS = emptyProgress();
