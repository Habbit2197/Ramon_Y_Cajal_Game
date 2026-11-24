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
import { activeDifficulty, activeParams, isDifficulty, setActiveDifficulty, type Difficulty, type DailyModifier } from '../game/difficulty';
import { dailyStreak, PLAY_IDS, type PlayId } from '../game/daily';
import { MUSEUM_BY_ID } from '../game/museum';
import { QUIZ_BY_ID } from '../game/quiz';
import { submitOnline } from '../net/onlineBoard';
import { scheduleClassSync, flushClassSync, syncClass } from '../net/classroom';
import { classSummary } from '../game/classroom';
import { useToastStore } from './useToastStore';

/** Modos principales (tienen onboarding y guía en partida) */
export type GameMode = 'story' | 'arcade' | 'maze';
export const GAME_MODES: GameMode[] = ['story', 'arcade', 'maze'];
/** Minijuegos del Laboratorio de Cajal */
export type LabGame = 'micro' | 'build' | 'rhythm' | 'brush';
export const LAB_GAMES: LabGame[] = ['micro', 'build', 'rhythm', 'brush'];
/** Todo lo que tiene clasificación propia */
export type { PlayId };

export interface ScoreEntry {
  id: string;
  name: string;
  avatar: number;
  score: number;
  /** Resumen legible: «Patio del Colegio, completado» o «Hipocampo, oleada 3» */
  detail: string;
  /** ISO 8601 */
  date: string;
  /** Dificultad con la que se jugó (las entradas antiguas no la tienen: Científico) */
  difficulty?: Difficulty;
  /** Modificador del Desafío Diario, si la partida era el desafío */
  modifier?: DailyModifier;
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
  /** Dificultad elegida por este alias */
  difficulty: Difficulty;
  /** Fichas del Museo descubiertas: id → fecha ISO */
  discoveries: Record<string, string>;
  /** Preguntas de Cajal ya acertadas */
  quizAnswered: string[];
  /** Desafío Diario: mejor puntuación por día y días completados */
  daily: { best: Record<string, number>; completed: string[] };
  /** Mejor puntuación en cada minijuego */
  labBest: Partial<Record<LabGame, number>>;
  /** Clase a la que se ha unido este alias (modo aula) */
  classroom?: { code: string; className: string; token: string };
}

/** Clases creadas como profe en este dispositivo */
export interface TeacherClass {
  code: string;
  className: string;
  key: string;
}

export const LEADERBOARD_SIZE = 20;
export const AVATAR_COUNT = 8;

const emptyProgress = (): PlayerProgress => ({
  stats: { ...EMPTY_STATS, levelsCompleted: [] },
  stars: {},
  arcadeStars: {},
  trophies: {},
  onboarding: { story: false, arcade: false, maze: false },
  difficulty: 'cientifico',
  discoveries: {},
  quizAnswered: [],
  daily: { best: {}, completed: [] },
  labBest: {},
});

/** Copia profunda del progreso para modificarlo sin tocar el estado anterior */
function cloneProgress(prev: PlayerProgress): PlayerProgress {
  const base = emptyProgress();
  return {
    stats: { ...EMPTY_STATS, ...prev.stats, levelsCompleted: [...(prev.stats?.levelsCompleted ?? [])] },
    stars: { ...prev.stars },
    arcadeStars: { ...(prev.arcadeStars ?? {}) },
    trophies: { ...prev.trophies },
    onboarding: { ...base.onboarding, ...prev.onboarding },
    difficulty: isDifficulty(prev.difficulty) ? prev.difficulty : 'cientifico',
    discoveries: { ...(prev.discoveries ?? {}) },
    quizAnswered: [...(prev.quizAnswered ?? [])],
    daily: { best: { ...(prev.daily?.best ?? {}) }, completed: [...(prev.daily?.completed ?? [])] },
    labBest: { ...(prev.labBest ?? {}) },
    ...(prev.classroom ? { classroom: { ...prev.classroom } } : {}),
  };
}

const emptyBoards = (): Record<PlayId, ScoreEntry[]> => Object.fromEntries(PLAY_IDS.map((m) => [m, []])) as unknown as Record<PlayId, ScoreEntry[]>;
/** Días de Desafío Diario que se guardan en la clasificación local */
const DAILY_KEEP = 7;

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

export interface LabResult {
  score: number;
  completed: boolean;
  /** Fichas del Museo descubiertas en la partida */
  cards: string[];
  /** Microscopio: neuronas descubiertas */
  found?: number;
  /** Sinapsis rítmica: porcentaje de aciertos */
  accuracy?: number;
  /** Cepíllate los dientes: porcentaje de limpieza */
  clean?: number;
}

interface ProfileState {
  playerName: string;
  avatar: number;
  leaderboard: Record<PlayId, ScoreEntry[]>;
  /** Clasificación local del Desafío Diario: fecha → entradas */
  dailyBoard: Record<string, ScoreEntry[]>;
  /** Publicar las puntuaciones en la clasificación de todos */
  shareOnline: boolean;
  setShareOnline: (v: boolean) => void;
  teacherClasses: TeacherClass[];
  /** Une (o quita, con null) al alias actual de una clase */
  setClassroom: (c: PlayerProgress['classroom'] | null) => void;
  addTeacherClass: (c: TeacherClass) => void;
  removeTeacherClass: (code: string) => void;
  /** Envía ya el progreso a la clase (al unirse) */
  syncClassroomNow: () => void;
  progress: Record<string, PlayerProgress>;
  /** Id de la última entrada enviada, para resaltarla */
  lastEntryId: string | null;
  setPlayerName: (raw: string) => { ok: boolean; reason?: string };
  setAvatar: (i: number) => void;
  /** Devuelve la posición (1 = primero) o null si no entra en el top. Con `daily`, va también a la del día. */
  submitScore: (mode: PlayId, score: number, detail: string, opts?: { daily?: string }) => number | null;
  setDifficulty: (d: Difficulty) => void;
  /** Desbloquea fichas del Museo (las ya vistas se ignoran) */
  discover: (ids: string[]) => void;
  /** Respuesta a una pregunta de Cajal */
  recordQuiz: (id: string, correct: boolean) => void;
  recordDaily: (key: string, score: number, completed: boolean) => void;
  recordLab: (game: LabGame, r: LabResult) => void;
  clearLeaderboard: () => void;
  recordStory: (r: StoryResult) => { stars: number };
  /** Victoria en dificultad Nobel (cualquier modo) */
  recordNobelWin: () => void;
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
        const p = cloneProgress(s.progress[key] ?? emptyProgress());
        fn(p);
        p.stats.discoveries = Object.keys(p.discoveries).length;
        const fresh = newlyUnlocked(p.stats, p.stars, p.trophies, p.arcadeStars);
        const now = new Date().toISOString();
        for (const id of fresh) {
          p.trophies[id] = now;
          const t = TROPHIES.find((x) => x.id === id)!;
          useToastStore.getState().push({ kind: 'trophy', title: t.name, body: t.how });
        }
        set({ progress: { ...s.progress, [key]: p } });
        queueClassSync();
      };

      /** Si el alias está en una clase, programa el envío de su resumen (sin bloquear el juego) */
      const queueClassSync = () => {
        const s = get();
        const p = s.playerName ? s.progress[aliasKey(s.playerName)] : undefined;
        const c = p?.classroom;
        if (!p || !c) return;
        const name = s.playerName, avatar = s.avatar;
        scheduleClassSync(() => syncClass(c.code, name, c.token, avatar, classSummary(p, get().leaderboard, name)));
      };

      /** Marca fichas nuevas en el progreso y avisa de cada una */
      const addCards = (p: PlayerProgress, ids: string[]) => {
        const now = new Date().toISOString();
        const fresh: string[] = [];
        for (const id of ids) {
          const card = MUSEUM_BY_ID[id];
          if (!card || p.discoveries[id]) continue;
          p.discoveries[id] = now;
          fresh.push(card.title);
        }
        // un solo aviso aunque se descubran varias a la vez
        if (fresh.length === 1) useToastStore.getState().push({ kind: 'discovery', title: fresh[0], body: 'Nueva ficha en el Museo' });
        else if (fresh.length > 1) useToastStore.getState().push({ kind: 'discovery', title: `${fresh.length} fichas nuevas en el Museo`, body: fresh.join(', ') });
      };

      return {
        playerName: '',
        avatar: 0,
        leaderboard: emptyBoards(),
        dailyBoard: {},
        shareOnline: true,
        progress: {},
        lastEntryId: null,

        setShareOnline: (v) => set({ shareOnline: v }),
        teacherClasses: [],
        setClassroom: (c) =>
          update((p) => {
            if (c) p.classroom = c;
            else delete p.classroom;
          }),
        addTeacherClass: (c) => set((s) => ({ teacherClasses: [c, ...s.teacherClasses.filter((x) => x.code !== c.code)].slice(0, 20) })),
        removeTeacherClass: (code) => set((s) => ({ teacherClasses: s.teacherClasses.filter((x) => x.code !== code) })),
        syncClassroomNow: () => {
          queueClassSync();
          flushClassSync();
        },

        setPlayerName: (raw) => {
          const r = checkPlayerName(raw);
          if (!r.ok) return { ok: false, reason: r.reason };
          set({ playerName: r.value });
          // cada alias juega con su dificultad
          const d = get().progress[aliasKey(r.value)]?.difficulty;
          setActiveDifficulty(isDifficulty(d) ? d : 'cientifico');
          return { ok: true };
        },

        setDifficulty: (d) => {
          setActiveDifficulty(d);
          update((p) => { p.difficulty = d; });
        },

        discover: (ids) => update((p) => addCards(p, ids)),

        recordQuiz: (id, correct) =>
          update((p) => {
            if (!correct || p.quizAnswered.includes(id)) return;
            p.quizAnswered.push(id);
            p.stats.quizCorrect++;
            const q = QUIZ_BY_ID[id];
            if (q) addCards(p, [q.card]);
          }),

        recordDaily: (key, score, completed) => {
          update((p) => {
            p.daily.best[key] = Math.max(p.daily.best[key] ?? 0, Math.round(score));
            if (completed && !p.daily.completed.includes(key)) {
              p.daily.completed.push(key);
              p.stats.dailyCompleted++;
              p.stats.dailyBestStreak = Math.max(p.stats.dailyBestStreak, dailyStreak(p.daily.completed, key));
              addCards(p, ['diario']);
            }
            // solo se guardan los últimos días
            const keys = Object.keys(p.daily.best).sort();
            for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete p.daily.best[k];
            p.daily.completed = p.daily.completed.slice(-60);
          });
        },

        recordLab: (game, r) =>
          update((p) => {
            const st = p.stats;
            st.labGames++;
            p.labBest[game] = Math.max(p.labBest[game] ?? 0, Math.round(r.score));
            if (game === 'micro' && r.found !== undefined) st.microBestFound = Math.max(st.microBestFound, r.found);
            if (game === 'build' && r.completed) st.buildCompleted++;
            if (game === 'rhythm' && r.accuracy !== undefined && r.completed) st.rhythmBestAccuracy = Math.max(st.rhythmBestAccuracy, Math.round(r.accuracy));
            if (game === 'brush' && r.clean !== undefined) st.brushBestClean = Math.max(st.brushBestClean ?? 0, Math.round(r.clean));
            if (r.completed && activeDifficulty().difficulty === 'nobel') st.nobelWins++;
            addCards(p, r.cards);
          }),

        recordNobelWin: () => update((p) => { p.stats.nobelWins++; }),

        setAvatar: (i) => set({ avatar: ((i % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT }),

        submitScore: (mode, score, detail, opts) => {
          const s = get();
          if (!s.playerName || score <= 0) return null;
          const act = activeDifficulty();
          const entry: ScoreEntry = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            name: s.playerName,
            avatar: s.avatar,
            score: Math.round(score),
            detail,
            date: new Date().toISOString(),
            difficulty: act.difficulty,
            ...(opts?.daily ? { modifier: act.modifier } : {}),
          };
          const { list, rank } = insertScore(s.leaderboard[mode] ?? [], entry);
          const patch: Partial<ProfileState> = { leaderboard: { ...s.leaderboard, [mode]: list }, lastEntryId: rank ? entry.id : null };
          if (opts?.daily) {
            const day = insertScore(s.dailyBoard[opts.daily] ?? [], entry);
            const keys = [...Object.keys(s.dailyBoard), opts.daily].filter((k, i, a) => a.indexOf(k) === i).sort().slice(-DAILY_KEEP);
            patch.dailyBoard = Object.fromEntries(keys.map((k) => [k, k === opts.daily ? day.list : s.dailyBoard[k]]));
          }
          set(patch);
          if (rank) update((p) => { p.stats.bestRank = Math.min(p.stats.bestRank, rank); });
          if (s.shareOnline) submitOnline({ board: mode, daily: opts?.daily ?? null, entry });
          return rank;
        },

        clearLeaderboard: () => set({ leaderboard: emptyBoards(), dailyBoard: {}, lastEntryId: null }),

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
              stars = starsForWin(r.vitality, r.maxVitality, r.seconds, activeParams().story.starSeconds);
              if (activeDifficulty().difficulty === 'nobel') st.nobelWins++;
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
            if (r.won) {
              st.arcadeWins++;
              if (activeDifficulty().difficulty === 'nobel') st.nobelWins++;
            }
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
      version: 5,
      storage: safeStorage,
      partialize: (s) => ({
        playerName: s.playerName,
        avatar: s.avatar,
        leaderboard: s.leaderboard,
        dailyBoard: s.dailyBoard,
        shareOnline: s.shareOnline,
        teacherClasses: s.teacherClasses,
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
        // v5: minijuegos, Desafío Diario, dificultad, Museo y preguntas
        s.leaderboard = Object.assign(emptyBoards(), s.leaderboard);
        s.dailyBoard = s.dailyBoard ?? {};
        s.shareOnline = s.shareOnline ?? true;
        s.teacherClasses = s.teacherClasses ?? [];
        const progress: Record<string, PlayerProgress> = {};
        for (const [k, p] of Object.entries(s.progress ?? {})) {
          const c = cloneProgress(p as PlayerProgress);
          c.stats.fastestWin = p.stats?.fastestWin ?? 1e9;
          c.stats.bestRank = p.stats?.bestRank ?? 1e9;
          progress[k] = c;
        }
        s.progress = progress;
        return s as ProfileState;
      },
      onRehydrateStorage: () => (st) => {
        // al cargar, la dificultad activa es la del alias guardado
        const d = st?.playerName ? st.progress[aliasKey(st.playerName)]?.difficulty : undefined;
        setActiveDifficulty(isDifficulty(d) ? d : 'cientifico');
      },
    },
  ),
);

/** Dificultad del alias actual */
export function useDifficulty(): Difficulty {
  return useProfileStore((s) => {
    const d = s.playerName ? s.progress[aliasKey(s.playerName)]?.difficulty : undefined;
    return isDifficulty(d) ? d : 'cientifico';
  });
}

/** Progreso del alias actual (o vacío si aún no hay alias). */
export function useCurrentProgress(): PlayerProgress {
  return useProfileStore((s) => (s.playerName && s.progress[aliasKey(s.playerName)]) || EMPTY_PROGRESS);
}
const EMPTY_PROGRESS = emptyProgress();
