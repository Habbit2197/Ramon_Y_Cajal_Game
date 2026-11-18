/**
 * useRunStore.ts — Store global de baja frecuencia (Zustand) con slices y meta-persistencia
 *
 * REGLA DE RENDIMIENTO:
 * Zustand SOLO almacena estados de baja frecuencia (fases, oleadas, cartas de mejora,
 * fichas de Cajal y ajustes de accesibilidad). NUNCA recibe datos a 60 Hz.
 * Toda mutación de modificadores sincroniza atómicamente con `world.player.mods`.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { mulberry32 } from '../engine/rng';
import {
  type UpgradeId,
  type Modifiers,
  computeModifiers,
  drawOffer,
  applyInstantEffects,
  STARTER_CARDS,
} from '../game/upgrades';
import { world } from '../engine/world';

const safeStorage = createJSONStorage(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const memoryMap = new Map<string, string>();
  return {
    getItem: (key: string) => memoryMap.get(key) ?? null,
    setItem: (key: string, value: string) => memoryMap.set(key, value),
    removeItem: (key: string) => memoryMap.delete(key),
  };
});

export type Phase = 'title' | 'playing' | 'draft' | 'regionClear' | 'paused' | 'gameover';
export const REGIONS = ['corteza', 'hipocampo', 'cerebelo'] as const;

export interface RunSlice {
  phase: Phase;
  /** true si se superaron las tres regiones */
  runWon: boolean;
  region: number;
  wave: number;
  level: number;
  xp: number;
  xpToNext: number;
  owned: Partial<Record<UpgradeId, number>>;
  mods: Modifiers;
  offer: UpgradeId[];
  rerolls: number;
  seed: number;
  addXp: (n: number) => void;
  openDraft: (kind: 'level' | 'region') => void;
  pick: (id: UpgradeId) => void;
  reroll: () => void;
  nextWave: () => void;
  newRun: (seed?: number) => void;
  setPhase: (phase: Phase) => void;
}

export interface MetaSlice {
  fichas: number;
  factsSeen: string[];
  unlockedCards: UpgradeId[];
  cosmetics: string[];
  bestRegion: number;
  settings: { shakeScale: number; haptics: boolean; reducedFlashes: boolean };
  discoverFact: (id: string) => void;
  updateSettings: (partial: Partial<MetaSlice['settings']>) => void;
}

export const useRunStore = create<RunSlice & MetaSlice>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ── Slice de Partida Actual ──
        phase: 'title',
        runWon: false,
        region: 0,
        wave: 0,
        level: 1,
        xp: 0,
        xpToNext: 60,
        owned: {} as Partial<Record<UpgradeId, number>>,
        mods: computeModifiers({}),
        offer: [],
        rerolls: 1,
        seed: 1,

        addXp: (n: number) => {
          const s = get();
          let xp = s.xp + n * s.mods.xpMult;
          let level = s.level;
          let next = s.xpToNext;
          let ups = 0;

          while (xp >= next) {
            xp -= next;
            level++;
            ups++;
            next = Math.round(60 * 1.22 ** level);
          }

          set({ xp, level, xpToNext: next });

          if (ups > 0) {
            get().openDraft('level');
          }
        },

        openDraft: (kind: 'level' | 'region') => {
          const s = get();
          const rng = mulberry32(s.seed + s.level * 97 + s.region * 7919);
          set({
            phase: kind === 'level' ? 'draft' : 'regionClear',
            offer: drawOffer(s.owned, s.unlockedCards, kind, rng),
          });
        },

        pick: (id: UpgradeId) =>
          set((s) => {
            const owned = { ...s.owned, [id]: (s.owned[id] ?? 0) + 1 };
            const mods = computeModifiers(owned);
            world.player.mods = mods;
            applyInstantEffects(id, world);
            return {
              owned,
              mods,
              offer: [],
              phase: 'playing',
            };
          }),

        reroll: () =>
          set((s) => {
            if (s.rerolls <= 0) return s;
            const nextSeed = (s.seed ^ Date.now()) | 0;
            return {
              rerolls: s.rerolls - 1,
              offer: drawOffer(s.owned, s.unlockedCards, 'level', mulberry32(nextSeed)),
            };
          }),

        nextWave: () =>
          set((s) => {
            if (s.wave < 5) {
              const nextW = s.wave + 1;
              world.wave = nextW;
              world.score += 150 * nextW;
              world.director.startWave(nextW, s.region, world);
              return { wave: nextW, phase: 'playing' };
            } else {
              // Fin de la región
              const nextR = s.region + 1;
              if (nextR >= REGIONS.length) {
                // Las tres regiones superadas: victoria de la partida
                world.score += 3000;
                return { runWon: true, phase: 'gameover', bestRegion: REGIONS.length, fichas: s.fichas + 5 };
              }
              world.score += 1000;
              world.region = nextR;
              world.wave = 0;
              world.director.startWave(0, nextR, world);
              return {
                wave: 0,
                region: nextR,
                rerolls: s.rerolls + 1,
                bestRegion: Math.max(s.bestRegion, nextR),
                fichas: s.fichas + 3,
                phase: 'regionClear',
              };
            }
          }),

        newRun: (seed = (Math.random() * 2 ** 31) | 0) => {
          world.reset(seed);
          const baseMods = computeModifiers({});
          world.player.mods = baseMods;
          set({
            phase: 'playing',
            runWon: false,
            region: 0,
            wave: 0,
            level: 1,
            xp: 0,
            xpToNext: 60,
            owned: {},
            mods: baseMods,
            offer: [],
            rerolls: 1,
            seed,
          });
        },

        setPhase: (phase: Phase) => set({ phase }),

        // ── Meta Progresión Persistente (Cuaderno de Cajal) ──
        fichas: 0,
        factsSeen: [],
        unlockedCards: [...STARTER_CARDS],
        cosmetics: [],
        bestRegion: 0,
        settings: {
          shakeScale: 1,
          haptics: true,
          reducedFlashes: false,
        },

        discoverFact: (id: string) =>
          set((s) =>
            s.factsSeen.includes(id)
              ? s
              : { factsSeen: [...s.factsSeen, id], fichas: s.fichas + 1 }
          ),

        updateSettings: (partial) =>
          set((s) => ({
            settings: { ...s.settings, ...partial },
          })),
      }),
      {
        name: 'cajal-meta',
        version: 1,
        storage: safeStorage,
        partialize: (s) => ({
          fichas: s.fichas,
          factsSeen: s.factsSeen,
          unlockedCards: s.unlockedCards,
          cosmetics: s.cosmetics,
          bestRegion: s.bestRegion,
          settings: s.settings,
        }),
      }
    )
  )
);
