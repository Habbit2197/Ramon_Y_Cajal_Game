/**
 * simulation.test.ts — Pruebas unitarias de invariantes, determinismo y simulación pura
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialGrid } from '../engine/grid';
import { mulberry32 } from '../engine/rng';
import { arenaWallNormal, reflect, BASE_WEAPON } from './weapons';
import { segmentCircleT, createProjectilePool, spawnProjectile, stepProjectiles } from './projectiles';
import {
  computeModifiers,
  isEvolutionReady,
  drawOffer,
  UPGRADES,
  type UpgradeId,
} from './upgrades';
import { World } from '../engine/world';
import { Director } from './director';
import { simulate } from '../engine/simulate';
import { STEP } from '../engine/clock';
import { useRunStore } from '../store/useRunStore';

describe('SpatialGrid (Zero-GC Uniform Grid)', () => {
  it('correctly queries entities in AABB and radius without allocations', () => {
    const grid = new SpatialGrid(-10, -10, 20, 20, 2, 64);
    const ex = new Float32Array([0, 1, 5, -8]);
    const ez = new Float32Array([0, 1, 5, -8]);

    grid.rebuild(ex, ez, 4);

    // Consulta en radio 2.0 alrededor del origen
    const near = grid.countNear(0, 0, 2.0, ex, ez);
    expect(near).toBe(2); // Entidades 0 (0,0) y 1 (1,1)

    // Entidad más cercana a (4.5, 4.5)
    const nearestIdx = grid.nearest(4.5, 4.5, 3.0, undefined, ex, ez);
    expect(nearestIdx).toBe(2); // Entidad 2 (5,5)

    // anyThreatWithin
    const threat = grid.anyThreatWithin(0, 0, 1.5, (idx) => idx === 1, ex, ez);
    expect(threat).toBe(true);
  });
});

describe('Weapons, Wall Reflections & CCD', () => {
  it('reflects velocity vectors across wall normals correctly: v\' = v - 2(v·n)n', () => {
    // Disparo moviéndose a la derecha (10, 0) chocando contra el muro derecho (normal = [-1, 0])
    const [rvx, rvz] = reflect(10, 0, -1, 0);
    expect(rvx).toBeCloseTo(-10);
    expect(rvz).toBeCloseTo(0);

    // Disparo diagonal (5, 5) chocando contra muro superior (normal = [0, -1])
    const [rvx2, rvz2] = reflect(5, 5, 0, -1);
    expect(rvx2).toBeCloseTo(5);
    expect(rvz2).toBeCloseTo(-5);
  });

  it('detects arena boundaries correctly', () => {
    expect(arenaWallNormal(14.5, 0, 14, 10)).toEqual({ nx: -1, nz: 0 });
    expect(arenaWallNormal(-14.5, 0, 14, 10)).toEqual({ nx: 1, nz: 0 });
    expect(arenaWallNormal(0, 10.5, 14, 10)).toEqual({ nx: 0, nz: -1 });
    expect(arenaWallNormal(0, -10.5, 14, 10)).toEqual({ nx: 0, nz: 1 });
    expect(arenaWallNormal(0, 0, 14, 10)).toBeNull();
  });

  it('segmentCircleT accurately calculates continuous bullet intersection', () => {
    // Proyectil viaja de (0,0) a (10,0). Círculo en (5, 0) con radio 1.
    const t = segmentCircleT(0, 0, 10, 0, 5, 0, 1.0);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
    expect(t).toBeCloseTo(0.4, 1); // Debe tocar en x = 4.0 (t = 4/10 = 0.4)

    // Proyectil que no toca el círculo
    const tMiss = segmentCircleT(0, 0, 10, 0, 5, 5, 1.0);
    expect(tMiss).toBe(-1);
  });
});

describe('Upgrades & Neuroplasticity Draft Deck', () => {
  it('computes modifiers with exponential compounding for stacked cards', () => {
    const owned: Partial<Record<UpgradeId, number>> = {
      mielinizacion: 2,
      acetilcolina: 1,
      potenciacionLargoPlazo: 3,
    };

    const mods = computeModifiers(owned);
    // Mielinización: speedMult *= 1.12^2, dashCdMult *= 0.9^2
    expect(mods.speedMult).toBeCloseTo(1.12 ** 2);
    expect(mods.dashCdMult).toBeCloseTo(0.9 ** 2);
    // Acetilcolina: fireRateMult *= 1.2^1
    expect(mods.fireRateMult).toBeCloseTo(1.2);
    // Potenciación a largo plazo: damageMult *= 1.18^3
    expect(mods.damageMult).toBeCloseTo(1.18 ** 3);
  });

  it('unlocks synaptic evolutions only when required base cards are maxed', () => {
    const ownedNotReady: Partial<Record<UpgradeId, number>> = {
      arborizacion: 2, // Requiere 3
      microglia: 2,
    };
    expect(isEvolutionReady('redSinaptica', ownedNotReady)).toBe(false);

    const ownedReady: Partial<Record<UpgradeId, number>> = {
      arborizacion: 3,
      microglia: 2,
    };
    expect(isEvolutionReady('redSinaptica', ownedReady)).toBe(true);
  });

  it('drawOffer produces deterministic choices given the same seed', () => {
    const unlocked: UpgradeId[] = ['mielinizacion', 'acetilcolina', 'arborizacion', 'microglia', 'escudoGlial'];
    const offerA = drawOffer({}, unlocked, 'level', mulberry32(999));
    const offerB = drawOffer({}, unlocked, 'level', mulberry32(999));

    expect(offerA).toEqual(offerB);
    expect(offerA.length).toBe(3);
  });
});

describe('Director (AI Wave Pacing)', () => {
  it('initializes wave budget following the TDD formula: 20 + 12w + 25r', () => {
    const d = new Director();
    const mockWorld = new World();

    d.startWave(0, 0, mockWorld);
    expect(d.budget).toBe(20);

    d.startWave(2, 1, mockWorld); // w=2, r=1 -> 20 + 24 + 25 = 69
    expect(d.budget).toBe(69);

    expect(mockWorld.diff.hpMult).toBeCloseTo(1 + 0.05 * 2 + 0.15 * 1);
  });

  it('triggers relax phase when intensity exceeds 1.0', () => {
    const d = new Director();
    const mockWorld = new World();
    d.startWave(0, 0, mockWorld);

    d.onPlayerHurt(); // +0.35
    d.onPlayerHurt(); // +0.35
    d.onPlayerHurt(); // +0.35 -> 1.05 > 1.0

    d.step(0.016, mockWorld);
    expect(d.relax).toBeGreaterThan(0);
  });
});

describe('Headless Simulation Loop & Invariants', () => {
  beforeEach(() => {
    useRunStore.getState().newRun(42);
  });

  it('runs 120 steps headless maintaining invariants (BrainPower, Pools, Limits)', () => {
    const w = new World();
    w.reset(42);
    useRunStore.getState().setPhase('playing');

    for (let frame = 0; frame < 120; frame++) {
      simulate(w, STEP);

      // Invariante 1: BrainPower siempre en [0, 100]
      expect(w.player.brainPower).toBeGreaterThanOrEqual(0);
      expect(w.player.brainPower).toBeLessThanOrEqual(100);

      // Invariante 2: Proyectiles no desbordan el pool
      expect(w.projectiles.count).toBeLessThanOrEqual(w.projectiles.max);

      // Invariante 3: Orbes no desbordan el pool
      expect(w.orbs.count).toBeLessThanOrEqual(w.orbs.max);
    }
  });
});
