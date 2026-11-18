import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  ITEM_CATALOG,
  createInitialPlayerState,
  applyItemCollision,
  stepPlayerKinematics,
  isCircleCollision,
  evaluateStageOutcome,
  calculateCognitiveFatigue,
  computeAnimationBlendWeights,
} from './rules';
import { useGameStore } from '../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../shaders/FatigueShader';

test('useGameStore initializes brainPower at 50 and clamps increasePower / decreasePower between 0 and 100', () => {
  useGameStore.getState().resetPower();
  assert.equal(useGameStore.getState().brainPower, 50);

  useGameStore.getState().increasePower(30);
  assert.equal(useGameStore.getState().brainPower, 80);

  useGameStore.getState().increasePower(50);
  assert.equal(useGameStore.getState().brainPower, 100);

  useGameStore.getState().decreasePower(40);
  assert.equal(useGameStore.getState().brainPower, 60);

  useGameStore.getState().decreasePower(200);
  assert.equal(useGameStore.getState().brainPower, 0);

  assert.ok(FATIGUE_FRAGMENT_SHADER.includes('uniform float uDesaturation'));
});

test('calculateCognitiveFatigue computes grayscale desaturation and synaptic bloom proportional to BrainPower', () => {
  const full = calculateCognitiveFatigue(100);
  assert.equal(full.desaturation, 0);
  assert.equal(full.fatiguePercent, 0);
  assert.equal(full.bloomStrength, 0.85);

  const half = calculateCognitiveFatigue(50);
  assert.equal(half.desaturation, 0.5);
  assert.equal(half.fatiguePercent, 50);

  const initialLvl1 = calculateCognitiveFatigue(20);
  assert.equal(initialLvl1.desaturation, 0.8);
  assert.equal(initialLvl1.fatiguePercent, 80);

  const depleted = calculateCognitiveFatigue(0);
  assert.equal(depleted.desaturation, 1);
  assert.equal(depleted.fatiguePercent, 100);
  assert.equal(depleted.bloomStrength, 0.1);
});

test('computeAnimationBlendWeights transitions smoothly between Idle, Run, Hit, and Victory', () => {
  const idle = computeAnimationBlendWeights(0, 10.5, false, false);
  assert.equal(idle.dominantState, 'Idle');
  assert.equal(idle.idle, 1);
  assert.equal(idle.run, 0);

  const running = computeAnimationBlendWeights(9.5, 10.5, false, false);
  assert.equal(running.dominantState, 'Run');
  assert.equal(running.run, 1);
  assert.equal(running.idle, 0);

  const hit = computeAnimationBlendWeights(5.0, 10.5, true, false);
  assert.equal(hit.dominantState, 'Hit');
  assert.equal(hit.hit, 0.85);

  const victory = computeAnimationBlendWeights(0, 10.5, false, true);
  assert.equal(victory.dominantState, 'Victory');
  assert.equal(victory.victory, 1);
});

test('createInitialPlayerState initializes with level spawn and initial BrainPower', () => {
  const state = createInitialPlayerState(LEVELS[0]);
  assert.equal(state.brainPower, 20);
  assert.equal(state.vitality, 3);
  assert.equal(state.speedModifier, 1.0);
  assert.equal(state.x, LEVELS[0].playerSpawn.x);
  assert.equal(state.z, LEVELS[0].playerSpawn.z);
});

test('applyItemCollision increases BrainPower and speed on healthy items and clamps at 100%', () => {
  let state = createInitialPlayerState(LEVELS[0]); // 20%
  const { nextState: afterWater, applied } = applyItemCollision(state, ITEM_CATALOG.water);
  assert.equal(applied, true);
  assert.equal(afterWater.brainPower, 35);
  assert.equal(afterWater.speedModifier, 1.28);
  assert.equal(afterWater.synapsesCollected, 1);

  // Clamp at 100%
  let nearFull = { ...afterWater, brainPower: 90 };
  const { nextState: capped } = applyItemCollision(nearFull, ITEM_CATALOG.science_book);
  assert.equal(capped.brainPower, 100);
});

test('applyItemCollision decreases BrainPower, slows movement, and grants i-frames on hazards', () => {
  const state = createInitialPlayerState(LEVELS[0]); // 20%
  const { nextState: hitSmoke, applied } = applyItemCollision(state, ITEM_CATALOG.tobacco_smoke);
  assert.equal(applied, true);
  assert.equal(hitSmoke.brainPower, 6);
  assert.equal(hitSmoke.vitality, 2);
  assert.equal(hitSmoke.speedModifier, 0.52);
  assert.ok(hitSmoke.invulnerableTimer > 0);

  // Subsequent hazard collision during i-frames should be ignored
  const { nextState: ignoredHit, applied: secondApplied } = applyItemCollision(
    hitSmoke,
    ITEM_CATALOG.alcohol_toxin
  );
  assert.equal(secondApplied, false);
  assert.equal(ignoredHit.brainPower, 6);
  assert.equal(ignoredHit.vitality, 2);
});

test('stepPlayerKinematics advances player position and resets expired speed modifiers', () => {
  let state = createInitialPlayerState(LEVELS[0]);
  state = { ...state, speedModifier: 0.52, effectTimer: 0.02 };

  const moved = stepPlayerKinematics(
    state,
    { moveX: 0, moveZ: -1, dashJustPressed: true },
    0.04
  );
  // Effect timer expired -> speedModifier resets to 1.0
  assert.equal(moved.effectTimer, 0);
  assert.equal(moved.speedModifier, 1.0);
  assert.ok(moved.z < state.z);
  assert.ok(moved.dashActiveTimer > 0);
});

test('isCircleCollision and evaluateStageOutcome verify victory at portal with 100% BrainPower', () => {
  assert.equal(isCircleCollision(0, 0, 1.0, 1.2, 0, 0.5), true);
  assert.equal(isCircleCollision(0, 0, 1.0, 5.0, 0, 0.5), false);

  const level = LEVELS[0];
  let state = createInitialPlayerState(level);
  assert.equal(evaluateStageOutcome(state, level), 'playing');

  // Move to portal with 100% BrainPower
  state = {
    ...state,
    brainPower: 100,
    x: level.portalPosition.x,
    z: level.portalPosition.z + 1.0,
  };
  assert.equal(evaluateStageOutcome(state, level), 'victory');

  // Vitality 0 triggers defeat
  const defeated = { ...state, vitality: 0 };
  assert.equal(evaluateStageOutcome(defeated, level), 'defeat');
});

test('All 3 levels include Santiago Ramon y Cajal educational completion dialogues', () => {
  assert.equal(LEVELS.length, 3);
  for (const lvl of LEVELS) {
    assert.ok(lvl.cajalVictoryDialogue.length > 120);
    assert.ok(lvl.cajalIntroQuote.length > 40);
  }
});

test('Agile Shooter: adding projectile, destroying enemy and increasing BrainPower', () => {
  useGameStore.getState().resetPower();
  useGameStore.getState().clearProjectiles();

  // Test projectile creation
  useGameStore.getState().addProjectile({
    id: 'proj-test',
    position: [0, 0.5, 0],
    direction: [0, 0, -1],
  });
  assert.equal(useGameStore.getState().projectiles.length, 1);
  assert.equal(useGameStore.getState().projectiles[0].id, 'proj-test');

  // Test enemy spawn
  useGameStore.getState().spawnEnemies([
    { id: 'enemy-1', position: [0, 0.5, -5], type: 'smoke', hp: 1 },
  ]);
  assert.equal(useGameStore.getState().enemies.length, 1);

  // Impact: destroy enemy, remove from store, increase BrainPower
  const initialPower = useGameStore.getState().brainPower;
  useGameStore.getState().removeEnemy('enemy-1');
  useGameStore.getState().removeProjectile('proj-test');

  assert.equal(useGameStore.getState().enemies.length, 0);
  assert.equal(useGameStore.getState().projectiles.length, 0);
  assert.equal(useGameStore.getState().brainPower, Math.min(100, initialPower + 10));
});
