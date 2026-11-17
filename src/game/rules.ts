/**
 * Pure game logic, physics modifiers, level definitions, and Cajal dialogues.
 * Decoupled from Three.js and React DOM for deterministic unit testing.
 */

export type ItemCategory = 'healthy' | 'hazard';

export type ItemSubType =
  | 'water'
  | 'apple'
  | 'walnut'
  | 'science_book'
  | 'tobacco_smoke'
  | 'alcohol_toxin'
  | 'junk_food';

export type HazardPolicy = 'chaser_smoke' | 'charger_junk' | 'orbiter_alcohol';

export interface CollectibleSpec {
  id: string;
  subType: ItemSubType;
  category: ItemCategory;
  label: string;
  brainDelta: number;      // Percentage points added/subtracted from BrainPower (0..100)
  vitalityDelta: number;   // Health pips delta (-1, 0, +1)
  speedMultiplier: number; // Temporary movement speed factor (e.g., 1.25 for water, 0.55 for smoke)
  effectDuration: number;  // Duration in seconds of the physical buff/debuff
  inertiaDrag: number;     // 1.0 = normal crisp control, 0.35 = sluggish/dizzy alcohol drift
  scientificNote: string;  // Cajal's micro-explanation shown on pickup/hit
}

export interface PlayerPhysicsState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingAngle: number;
  brainPower: number;        // 0 to 100 (%)
  vitality: number;          // 0 to 3 discrete pips
  maxVitality: number;
  baseSpeed: number;         // Base units/sec (e.g., 8.5)
  speedModifier: number;     // Current multiplier (0.45 .. 1.4)
  inertiaFactor: number;     // 1.0 normal, lower = dizzy/sluggish response
  effectTimer: number;       // Remaining seconds of active buff/debuff
  activeEffectName: string | null;
  dashCooldown: number;      // Cooldown timer for Impulso Sináptico
  dashActiveTimer: number;   // Active dash burst timer
  invulnerableTimer: number; // Post-hit i-frames
  synapsesCollected: number;
  hazardsHit: number;
  score: number;
}

export interface LevelConfig {
  id: number;
  slug: string;
  name: string;
  subtitle: string;
  environmentTheme: 'park' | 'school' | 'party';
  initialBrainPower: number;
  targetBrainPower: number;
  playerSpawn: { x: number; z: number };
  portalPosition: { x: number; z: number };
  skyColor: number;
  fogColor: number;
  groundColor: number;
  pathColor: number;
  cajalIntroQuote: string;
  cajalVictoryTitle: string;
  cajalVictoryDialogue: string;
  neuroscienceFact: string;
}

export const ITEM_CATALOG: Record<ItemSubType, Omit<CollectibleSpec, 'id'>> = {
  water: {
    subType: 'water',
    category: 'healthy',
    label: 'Agua Pura (Hidratación)',
    brainDelta: 15,
    vitalityDelta: 0,
    speedMultiplier: 1.28,
    effectDuration: 4.0,
    inertiaDrag: 1.0,
    scientificNote: '¡Excelente! El cerebro es un 75% agua: la hidratación acelera la transmisión eléctrica entre axones.',
  },
  apple: {
    subType: 'apple',
    category: 'healthy',
    label: 'Manzana Antioxidante',
    brainDelta: 15,
    vitalityDelta: 1,
    speedMultiplier: 1.15,
    effectDuration: 3.5,
    inertiaDrag: 1.0,
    scientificNote: 'Los antioxidantes de la fruta fresca protegen la mielina y fortalecen las espinas dendríticas.',
  },
  walnut: {
    subType: 'walnut',
    category: 'healthy',
    label: 'Nueces (Omega-3)',
    brainDelta: 20,
    vitalityDelta: 0,
    speedMultiplier: 1.2,
    effectDuration: 4.5,
    inertiaDrag: 1.0,
    scientificNote: 'Los ácidos grasos Omega-3 construyen membranas celulares flexibles para nuevas sinapsis.',
  },
  science_book: {
    subType: 'science_book',
    category: 'healthy',
    label: 'Tratado de Histología',
    brainDelta: 25,
    vitalityDelta: 1,
    speedMultiplier: 1.3,
    effectDuration: 5.0,
    inertiaDrag: 1.0,
    scientificNote: '¡El ejercicio mental y la curiosidad esculpen nuevas arborizaciones neuronales!',
  },
  tobacco_smoke: {
    subType: 'tobacco_smoke',
    category: 'hazard',
    label: 'Humo de Tabaco (Monóxido y Nicotina)',
    brainDelta: -14,
    vitalityDelta: -1,
    speedMultiplier: 0.52,
    effectDuration: 3.8,
    inertiaDrag: 0.75,
    scientificNote: '¡Cuidado! El humo reduce el oxígeno sanguíneo cerebral y provoca vasoconstricción, ralentizando tus reflejos.',
  },
  junk_food: {
    subType: 'junk_food',
    category: 'hazard',
    label: 'Ultraprocesado y Exceso de Azúcar',
    brainDelta: -12,
    vitalityDelta: -1,
    speedMultiplier: 0.62,
    effectDuration: 3.2,
    inertiaDrag: 0.65,
    scientificNote: 'El exceso de azúcares refinados y grasas trans inflama el hipocampo y produce fatiga mental.',
  },
  alcohol_toxin: {
    subType: 'alcohol_toxin',
    category: 'hazard',
    label: 'Alcohol (Neurotoxina Depresora)',
    brainDelta: -18,
    vitalityDelta: -1,
    speedMultiplier: 0.48,
    effectDuration: 4.2,
    inertiaDrag: 0.32,
    scientificNote: '¡Alerta! El alcohol altera el cerebelo y la corteza prefrontal, degradando el equilibrio y la memoria.',
  },
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    slug: 'el-parque',
    name: 'Nivel 1: El Parque de las Dendritas',
    subtitle: 'Aire libre, hidratación y esquiva del humo pasivo',
    environmentTheme: 'park',
    initialBrainPower: 20,
    targetBrainPower: 100,
    playerSpawn: { x: 0, z: 18 },
    portalPosition: { x: 0, z: -20 },
    skyColor: 0x182b3a,
    fogColor: 0x182b3a,
    groundColor: 0x243b2b,
    pathColor: 0x8c7355,
    cajalIntroQuote:
      '«Todo ser humano, si se lo propone, puede ser escultor de su propio cerebro.» Recoge agua, frutas y nueces por el sendero del parque mientras esquivas las nubes de humo de tabaco.',
    cajalVictoryTitle: 'Diálogo de Cajal — Nivel 1 Completado (El Parque)',
    cajalVictoryDialogue:
      '«¡Magnífico trabajo, joven explorador! Observa por mi microscopio cómo tus neuronas piramidales han extendido nuevas ramas, igual que los árboles de este parque cuando reciben agua limpia y sol. Al alejarte del humo del tabaco, permitiste que la sangre llevara oxígeno puro a cada rincón de tu corteza cerebral. Recuerda siempre: respirar aire limpio y mover el cuerpo al aire libre es el primer abono para que el jardín de tu mente florezca con vigor.»',
    neuroscienceFact:
      'El ejercicio físico al aire libre libera BDNF (Factor Neurotrófico Derivado del Cerebro), una proteína que estimula el nacimiento de nuevas conexiones sinápticas.',
  },
  {
    id: 2,
    slug: 'el-colegio',
    name: 'Nivel 2: El Patio del Colegio',
    subtitle: 'Energía para aprender frente a los ultraprocesados',
    environmentTheme: 'school',
    initialBrainPower: 15,
    targetBrainPower: 100,
    playerSpawn: { x: 0, z: 18 },
    portalPosition: { x: 0, z: -20 },
    skyColor: 0x1f2438,
    fogColor: 0x1f2438,
    groundColor: 0x2c3340,
    pathColor: 0x9c8260,
    cajalIntroQuote:
      '«Las neuronas son células delicadas que se comunican mediante besos protoplasmáticos llamados sinapsis.» En el recreo, elige fruta, frutos secos y lectura; evita la bollería industrial y el humo en las esquinas.',
    cajalVictoryTitle: 'Diálogo de Cajal — Nivel 2 Completado (El Colegio)',
    cajalVictoryDialogue:
      '«¡Asombroso! Has logrado que tu Red Neuronal alcance el 100% de su potencial en pleno patio escolar. Muchos creen que un exceso de azúcar o comida basura da energía rápida, pero en realidad provoca una tormenta inflamatoria que adormece la atención y la memoria en el hipocampo. Al nutrirte con fruta, agua y curiosidad científica, tus sinapsis transmiten impulsos eléctricos con la precisión de un telégrafo de oro. ¡Tu memoria está lista para cualquier desafío!»',
    neuroscienceFact:
      'El hipocampo, centro clave del aprendizaje escolar, depende de glucosa estable y ácidos grasos Omega-3 para consolidar la memoria a largo plazo.',
  },
  {
    id: 3,
    slug: 'la-fiesta',
    name: 'Nivel 3: La Fiesta de la Sinapsis',
    subtitle: 'Decisiones conscientes ante la presión social, el alcohol y el tabaco',
    environmentTheme: 'party',
    initialBrainPower: 10,
    targetBrainPower: 100,
    playerSpawn: { x: 0, z: 18 },
    portalPosition: { x: 0, z: -20 },
    skyColor: 0x161224,
    fogColor: 0x161224,
    groundColor: 0x231d33,
    pathColor: 0x7c6552,
    cajalIntroQuote:
      '«La voluntad firme es el timón de la inteligencia.» En esta fiesta nocturna abundan las neurotoxinas del alcohol y el tabaco que entorpecen el cerebelo. Mantén tu mente lúcida hasta el portal sináptico.',
    cajalVictoryTitle: 'Diálogo de Cajal — Nivel 3 Completado (La Fiesta)',
    cajalVictoryDialogue:
      '«¡Victoria magistral, arquitecto de tu propio destino! En medio del ruido y las tentaciones de la fiesta, demostraste la mayor virtud del cerebro humano: el control de la corteza prefrontal. El alcohol y el tabaco son neurotoxinas que apagan la comunicación entre las neuronas, nublan el juicio y dañan el cerebelo, haciéndote perder el rumbo. Al mantenerte firme e hidratado, tu Red Neuronal brilla hoy con millones de sinapsis luminosas. ¡Eres un auténtico maestro de la neurociencia de la vida!»',
    neuroscienceFact:
      'Durante la infancia y adolescencia, la corteza prefrontal y el sistema de recompensa están en plena mielinización: evitar el alcohol y el tabaco protege tu potencial cognitivo futuro.',
  },
];

export function createInitialPlayerState(level: LevelConfig): PlayerPhysicsState {
  return {
    x: level.playerSpawn.x,
    z: level.playerSpawn.z,
    vx: 0,
    vz: 0,
    facingAngle: Math.PI, // Facing -Z toward the open path and portal
    brainPower: level.initialBrainPower,
    vitality: 3,
    maxVitality: 3,
    baseSpeed: 10.5,
    speedModifier: 1.0,
    inertiaFactor: 1.0,
    effectTimer: 0,
    activeEffectName: null,
    dashCooldown: 0,
    dashActiveTimer: 0,
    invulnerableTimer: 0,
    synapsesCollected: 0,
    hazardsHit: 0,
    score: 0,
  };
}

/**
 * Pure function that applies an item collision (healthy pickup or hazard) to the player state.
 * Clamps BrainPower between 0 and 100, adjusts movement speed modifiers, and updates score.
 */
export function applyItemCollision(
  state: PlayerPhysicsState,
  spec: Omit<CollectibleSpec, 'id'>
): { nextState: PlayerPhysicsState; applied: boolean } {
  if (spec.category === 'hazard' && state.invulnerableTimer > 0) {
    return { nextState: state, applied: false };
  }

  const nextBrainPower = Math.max(0, Math.min(100, state.brainPower + spec.brainDelta));
  const nextVitality = Math.max(
    0,
    Math.min(state.maxVitality, state.vitality + spec.vitalityDelta)
  );

  const isHealthy = spec.category === 'healthy';
  const scoreDelta = isHealthy ? spec.brainDelta * 12 : Math.max(-50, spec.brainDelta * 5);

  const nextState: PlayerPhysicsState = {
    ...state,
    brainPower: nextBrainPower,
    vitality: nextVitality,
    speedModifier: spec.speedMultiplier,
    inertiaFactor: spec.inertiaDrag,
    effectTimer: spec.effectDuration,
    activeEffectName: spec.label,
    invulnerableTimer: isHealthy ? state.invulnerableTimer : 1.1,
    synapsesCollected: isHealthy ? state.synapsesCollected + 1 : state.synapsesCollected,
    hazardsHit: isHealthy ? state.hazardsHit : state.hazardsHit + 1,
    score: Math.max(0, state.score + scoreDelta),
  };

  return { nextState, applied: true };
}

/**
 * Pure kinematic step advancing player timers, speed modifiers, and clamped arena position.
 */
export function stepPlayerKinematics(
  state: PlayerPhysicsState,
  input: { moveX: number; moveZ: number; dashJustPressed: boolean },
  dt: number,
  arenaBounds = { minX: -22, maxX: 22, minZ: -24, maxZ: 22 }
): PlayerPhysicsState {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  let effectTimer = Math.max(0, state.effectTimer - clampedDt);
  let speedModifier = effectTimer > 0 ? state.speedModifier : 1.0;
  let inertiaFactor = effectTimer > 0 ? state.inertiaFactor : 1.0;
  let activeEffectName = effectTimer > 0 ? state.activeEffectName : null;

  let dashCooldown = Math.max(0, state.dashCooldown - clampedDt);
  let dashActiveTimer = Math.max(0, state.dashActiveTimer - clampedDt);
  let invulnerableTimer = Math.max(0, state.invulnerableTimer - clampedDt);

  if (input.dashJustPressed && dashCooldown <= 0) {
    dashActiveTimer = 0.24;
    dashCooldown = 1.4;
  }

  // Normalize input vector
  const len = Math.hypot(input.moveX, input.moveZ);
  const nx = len > 0.001 ? input.moveX / len : 0;
  const nz = len > 0.001 ? input.moveZ / len : 0;

  const dashMultiplier = dashActiveTimer > 0 ? 2.15 : 1.0;
  const effectiveSpeed = state.baseSpeed * speedModifier * dashMultiplier;

  const targetVx = nx * effectiveSpeed;
  const targetVz = nz * effectiveSpeed;

  // Exponential damping weighted by inertiaFactor (alcohol lowers inertiaFactor -> sluggish drift)
  const responseLambda = 14.0 * inertiaFactor;
  const blend = 1 - Math.exp(-responseLambda * clampedDt);

  const vx = state.vx + (targetVx - state.vx) * blend;
  const vz = state.vz + (targetVz - state.vz) * blend;

  const x = Math.max(arenaBounds.minX, Math.min(arenaBounds.maxX, state.x + vx * clampedDt));
  const z = Math.max(arenaBounds.minZ, Math.min(arenaBounds.maxZ, state.z + vz * clampedDt));

  let facingAngle = state.facingAngle;
  if (len > 0.05) {
    facingAngle = Math.atan2(nx, nz);
  }

  return {
    ...state,
    x,
    z,
    vx,
    vz,
    facingAngle,
    speedModifier,
    inertiaFactor,
    effectTimer,
    activeEffectName,
    dashCooldown,
    dashActiveTimer,
    invulnerableTimer,
  };
}

/**
 * Checks 2D XZ circle collision between two entities.
 */
export function isCircleCollision(
  ax: number,
  az: number,
  aRadius: number,
  bx: number,
  bz: number,
  bRadius: number
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const rSum = aRadius + bRadius;
  return dx * dx + dz * dz <= rSum * rSum;
}

/**
 * Evaluates win/loss outcome for the current frame.
 */
export function evaluateStageOutcome(
  state: PlayerPhysicsState,
  level: LevelConfig
): 'playing' | 'victory' | 'defeat' {
  if (state.vitality <= 0 || state.brainPower <= 0) {
    return 'defeat';
  }
  if (state.brainPower >= level.targetBrainPower) {
    // Player wins when BrainPower reaches 100% and they reach the Cajal Portal (or automatically if within portal range)
    const distToPortal = Math.hypot(
      state.x - level.portalPosition.x,
      state.z - level.portalPosition.z
    );
    if (distToPortal <= 4.2) {
      return 'victory';
    }
  }
  return 'playing';
}

/**
 * Calculates post-processing shader uniforms (grayscale desaturation, vignette & synaptic bloom)
 * proportional to BrainPower:
 * - 100% BrainPower -> 0% desaturation, maximum synaptic bloom (0.85)
 * - 0% BrainPower   -> 100% grayscale desaturation, minimal bloom (0.05)
 */
export function calculateCognitiveFatigue(brainPower: number): {
  desaturation: number;
  vignette: number;
  bloomStrength: number;
  fatiguePercent: number;
} {
  const clampedBp = Math.max(0, Math.min(100, brainPower));
  const desaturation = Number(((100 - clampedBp) / 100).toFixed(4));
  const vignette = Number((desaturation * 0.65).toFixed(4));
  const bloomStrength = Number((0.1 + (clampedBp / 100) * 0.75).toFixed(4));
  const fatiguePercent = Math.round(desaturation * 100);
  return { desaturation, vignette, bloomStrength, fatiguePercent };
}

export interface AnimationBlendWeights {
  idle: number;
  run: number;
  hit: number;
  victory: number;
  dominantState: 'Idle' | 'Run' | 'Hit' | 'Victory';
}

/**
 * Computes normalized skeletal AnimationMixer Blend Tree weights (Idle, Run, Hit, Victory)
 * from player movement speed, hazard impact state, and stage outcome.
 */
export function computeAnimationBlendWeights(
  speed: number,
  baseSpeed: number,
  isHit: boolean,
  isVictory: boolean
): AnimationBlendWeights {
  if (isVictory) {
    return { idle: 0, run: 0, hit: 0, victory: 1, dominantState: 'Victory' };
  }
  if (isHit) {
    return { idle: 0.15, run: 0, hit: 0.85, victory: 0, dominantState: 'Hit' };
  }
  const normalizedSpeed = Math.max(0, Math.min(1, speed / Math.max(1, baseSpeed * 0.85)));
  const runWeight = Number(normalizedSpeed.toFixed(3));
  const idleWeight = Number((1 - runWeight).toFixed(3));
  return {
    idle: idleWeight,
    run: runWeight,
    hit: 0,
    victory: 0,
    dominantState: runWeight >= 0.35 ? 'Run' : 'Idle',
  };
}


