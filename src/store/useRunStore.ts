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
import { useProfileStore } from './useProfileStore';

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
/** Oleadas por región (antes había 6 y el contador llegaba a «6/5») */
export const WAVES_PER_REGION = 5;

export const REGIONS = ['corteza', 'hipocampo', 'cerebelo'] as const;

export interface RunSlice {
  phase: Phase;
  /** Modo infinito tras superar las tres regiones */
  endless: boolean;
  /** Estrellas de cada región en esta partida, y las de la última superada */
  regionStars: number[];
  lastRegionStars: number;
  continueEndless: () => void;
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
        endless: false,
        regionStars: [],
        lastRegionStars: 0,
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
          if (ups > 0 && s.mods.healOnLevel) world.player.vitality = world.player.mods.maxVitality;

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

        nextWave: () => {
          const s = get();
          const p = world.player;

          // ── Modo infinito: oleadas sin fin, cada vez más duras ──
          if (s.endless) {
            const nextW = s.wave + 1;
            world.wave = nextW;
            world.score += 200 + 20 * nextW;
            world.director.startWave(nextW % WAVES_PER_REGION, REGIONS.length + Math.floor(nextW / WAVES_PER_REGION), world);
            useProfileStore.getState().recordArcade({ endlessWave: nextW + 1 });
            set({ wave: nextW });
            // cada 5 oleadas, una mejora rara de recompensa
            if (nextW % WAVES_PER_REGION === 0) get().openDraft('region');
            return;
          }

          // ── Siguiente oleada dentro de la región ──
          if (s.wave < WAVES_PER_REGION - 1) {
            const nextW = s.wave + 1;
            world.wave = nextW;
            world.score += 150 * nextW;
            world.director.startWave(nextW, s.region, world);
            set({ wave: nextW, phase: 'playing' });
            return;
          }

          // ── Fin de la región: estrellas ──
          const stars = 1 + (p.vitality >= p.mods.maxVitality ? 1 : 0) + (world.hitsThisRegion === 0 ? 1 : 0);
          useProfileStore.getState().recordArcadeStars(s.region, stars);
          world.hitsThisRegion = 0;
          const regionStars = [...s.regionStars];
          regionStars[s.region] = stars;

          const nextR = s.region + 1;
          if (nextR >= REGIONS.length) {
            // Las tres regiones superadas: victoria (el jugador puede seguir en modo infinito)
            world.score += 3000;
            set({ runWon: true, phase: 'gameover', regionStars, lastRegionStars: stars, bestRegion: REGIONS.length, fichas: s.fichas + 5 });
            return;
          }
          world.score += 1000;
          world.region = nextR;
          world.wave = 0;
          world.director.startWave(0, nextR, world);
          set({
            wave: 0,
            region: nextR,
            regionStars,
            lastRegionStars: stars,
            rerolls: s.rerolls + 1,
            bestRegion: Math.max(s.bestRegion, nextR),
            fichas: s.fichas + 3,
          });
          // antes se ponía la fase sin repartir cartas y la partida se quedaba bloqueada
          get().openDraft('region');
        },

        continueEndless: () => {
          const s = get();
          if (!s.runWon) return;
          world.region = REGIONS.length - 1;
          world.wave = 0;
          world.director.startWave(0, REGIONS.length, world);
          set({ endless: true, wave: 0 });
          get().openDraft('region'); // recompensa al entrar en el modo infinito
        },

        newRun: (seed = (Math.random() * 2 ** 31) | 0) => {
          world.reset(seed);
          const baseMods = computeModifiers({});
          world.player.mods = baseMods;
          set({
            phase: 'playing',
            runWon: false,
            endless: false,
            regionStars: [],
            lastRegionStars: 0,
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
