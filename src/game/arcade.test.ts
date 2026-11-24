/**
 * arcade.test.ts — Partida automática del Arcade con enemigos de verdad.
 *
 * Rapier no corre en los tests, así que cada pool recibe cuerpos simulados que integran
 * velocidad e impulsos. Con eso la simulación completa (director, IA, disparos, oleadas,
 * regiones, estrellas, modo infinito) se ejecuta igual que en el navegador.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RapierRigidBody } from '@react-three/rapier';
import { world } from '../engine/world';
import { simulate } from '../engine/simulate';
import { STEP } from '../engine/clock';
import { useRunStore, WAVES_PER_REGION } from '../store/useRunStore';
import { useProfileStore } from '../store/useProfileStore';

class MockBody {
  p = { x: 0, y: -50, z: 0 };
  v = { x: 0, y: 0, z: 0 };
  enabled = true;
  constructor(private m = 1) {}
  translation() { return { ...this.p }; }
  linvel() { return { ...this.v }; }
  mass() { return this.m; }
  setEnabled(e: boolean) { this.enabled = e; }
  isEnabled() { return this.enabled; }
  setTranslation(t: { x: number; y: number; z: number }) { this.p = { ...t }; }
  setLinvel(v: { x: number; y: number; z: number }) { this.v = { ...v }; }
  applyImpulse(i: { x: number; y: number; z: number }) { this.v.x += i.x / this.m; this.v.z += i.z / this.m; }
  step(dt: number) {
    if (!this.enabled) return;
    this.p.x += this.v.x * dt;
    this.p.z += this.v.z * dt;
    this.v.x *= Math.exp(-2 * dt);
    this.v.z *= Math.exp(-2 * dt);
  }
}

const SIZES: Record<string, number> = { swarmer: 64, tank0: 8, tank1: 16, tank2: 32, homing: 16 };
let bodies: MockBody[] = [];

function setup() {
  bodies = [];
  for (const [kind, n] of Object.entries(SIZES)) {
    const list = Array.from({ length: n }, () => new MockBody(kind.startsWith('tank') ? 3 : 1));
    bodies.push(...list);
    (world.pools as Record<string, { attach: (b: RapierRigidBody[]) => void }>)[kind].attach(list as unknown as RapierRigidBody[]);
  }
  useProfileStore.setState({ playerName: 'Test Arcade', progress: {}, leaderboard: { story: [], arcade: [], maze: [], micro: [], build: [], rhythm: [], brush: [] } });
  useRunStore.getState().newRun(7);
}

/** Avanza la partida: el jugador es invulnerable y una «Ola» elimina todo lo que se acerca. */
function play(seconds: number, onDraft: (offer: string[]) => void, stopWhen: () => boolean) {
  for (let i = 0; i < seconds / STEP; i++) {
    const s = useRunStore.getState();
    if (s.phase === 'draft' || s.phase === 'regionClear') {
      onDraft(s.offer);
      s.pick(s.offer[0]);
      continue;
    }
    if (stopWhen()) return;
    if (s.phase !== 'playing') return;
    world.player.invulnerableTimer = 1; // nunca muere: lo que se prueba es la progresión
    simulate(world, STEP);
    for (const b of bodies) b.step(STEP);
    for (let j = 0; j < world.enemyMirror.count; j++) {
      if (world.enemyMirror.alive[j]) world.damageEnemy(j, 9999, 0, 1);
    }
  }
}

describe('Arcade: partida completa con enemigos', () => {
  beforeEach(setup);

  it('5 oleadas por región, cartas al superar cada región, estrellas y victoria', () => {
    const wavesSeen = new Set<string>();
    let regionDrafts = 0;
    let emptyDrafts = 0;
    const record = (s: { region: number; wave: number }) => wavesSeen.add(`${s.region}-${s.wave}`);
    record(useRunStore.getState()); // la oleada inicial ya está puesta antes de suscribirse
    const unsub = useRunStore.subscribe(record);
    play(
      1800,
      (offer) => {
        if (offer.length === 0) emptyDrafts++;
        if (useRunStore.getState().phase === 'regionClear') regionDrafts++;
      },
      () => useRunStore.getState().phase === 'gameover',
    );
    unsub();
    const s = useRunStore.getState();

    expect(emptyDrafts, 'nunca debe aparecer una elección sin cartas').toBe(0);
    expect(s.phase).toBe('gameover');
    expect(s.runWon).toBe(true);
    expect(regionDrafts).toBe(2); // tras Corteza y tras Hipocampo
    for (let r = 0; r < 3; r++) {
      for (let w = 0; w < WAVES_PER_REGION; w++) expect(wavesSeen.has(`${r}-${w}`), `región ${r} oleada ${w}`).toBe(true);
      expect(wavesSeen.has(`${r}-${WAVES_PER_REGION}`), 'no debe haber una sexta oleada').toBe(false);
    }
    // sin golpes y con todos los corazones: 3 estrellas en cada región
    expect(s.regionStars).toEqual([3, 3, 3]);
    const p = Object.values(useProfileStore.getState().progress)[0];
    expect(p.arcadeStars).toEqual({ 0: 3, 1: 3, 2: 3 });
    expect(p.trophies['regiones-perfectas']).toBeTruthy();
    // ninguna posición rota
    for (const b of bodies) expect(Number.isFinite(b.p.x) && Number.isFinite(b.p.z)).toBe(true);
  });

  it('tras la victoria se puede seguir en modo infinito y las oleadas no se acaban', () => {
    play(1800, () => {}, () => useRunStore.getState().phase === 'gameover');
    expect(useRunStore.getState().runWon).toBe(true);

    useRunStore.getState().continueEndless();
    expect(useRunStore.getState().endless).toBe(true);
    expect(useRunStore.getState().offer.length).toBeGreaterThan(0); // recompensa al entrar

    play(900, () => {}, () => useRunStore.getState().wave >= 11);
    const s = useRunStore.getState();
    expect(s.wave).toBeGreaterThanOrEqual(11);
    expect(s.phase).not.toBe('gameover');
    const p = Object.values(useProfileStore.getState().progress)[0];
    expect(p.stats.arcadeBestEndless).toBeGreaterThanOrEqual(10);
    expect(p.trophies['sin-fin']).toBeTruthy();
  });

  it('las cartas reparadas funcionan: escudo glial y sueño reparador', () => {
    const run = useRunStore.getState();
    // Escudo: al elegirlo aparece y, tras absorber un golpe, se recarga solo
    useRunStore.setState({ phase: 'draft', offer: ['escudoGlial'] });
    run.pick('escudoGlial');
    expect(world.player.shieldActive).toBe(true);
    world.player.shieldActive = false;
    world.player.shieldTimer = 0.05;
    useRunStore.getState().setPhase('playing');
    for (let i = 0; i < 10; i++) simulate(world, STEP);
    expect(world.player.shieldActive).toBe(true);

    // Sueño reparador: subir de nivel cura todos los corazones
    useRunStore.setState({ phase: 'draft', offer: ['suenoReparador'] });
    useRunStore.getState().pick('suenoReparador' as never);
    world.player.vitality = 1;
    useRunStore.getState().addXp(10_000);
    expect(world.player.vitality).toBe(world.player.mods.maxVitality);
  });
});
