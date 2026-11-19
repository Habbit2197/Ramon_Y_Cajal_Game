/**
 * upgrades.ts — Mazo de mejoras con rigor neurocientífico y lógica de progresión pura
 *
 * Cada carta lleva un nombre neurocientífico real y una explicación concisa.
 * Funciones puras y deterministas para testeo unitario exhaustivo.
 */

import type { World } from '../engine/world';

export type Rarity = 'common' | 'rare' | 'legendary' | 'evolution';

export type UpgradeId =
  | 'mielinizacion'
  | 'acetilcolina'
  | 'atencionSostenida'
  | 'potenciacionLargoPlazo'
  | 'arborizacion'
  | 'microglia'
  | 'sinapsisMultiple'
  | 'escudoGlial'
  | 'neurogenesis'
  | 'suenoReparador'
  | 'nodosRanvier'
  | 'redSinaptica'
  | 'impulsoSaltatorio';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  rarity: Rarity;
  max: number;
  tags: string[];
  scientificIdea: string;
  description: string;
  requires?: Partial<Record<UpgradeId, number>>;
  apply: (m: Modifiers, stacks: number) => void;
}

export interface Modifiers {
  speedMult: number;
  dashCdMult: number;
  fireRateMult: number;
  damageMult: number;
  bounces: number;
  pierce: number;
  extraProjectiles: number;
  magnetMult: number;
  shieldCharges: number;
  shieldRecharge: number;
  maxVitality: number;
  xpMult: number;
  healOnLevel: boolean;
  ranvierShots: number;
  noBounceFalloff: boolean;
  infiniteDashOnUlt: boolean;
}

export function baseModifiers(): Modifiers {
  return {
    speedMult: 1,
    dashCdMult: 1,
    fireRateMult: 1,
    damageMult: 1,
    bounces: 0,
    pierce: 0,
    extraProjectiles: 0,
    magnetMult: 1,
    shieldCharges: 0,
    shieldRecharge: 12,
    maxVitality: 3,
    xpMult: 1,
    healOnLevel: false,
    ranvierShots: 0,
    noBounceFalloff: false,
    infiniteDashOnUlt: false,
  };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  mielinizacion: {
    id: 'mielinizacion',
    name: 'Mielinización',
    rarity: 'common',
    max: 3,
    tags: ['move'],
    scientificIdea: 'La mielina recubre los axones y acelera la conducción del impulso eléctrico.',
    description: 'Te mueves un 12 % más rápido y el impulso se recarga un 10 % antes.',
    apply: (m, n) => {
      m.speedMult *= 1.12 ** n;
      m.dashCdMult *= 0.9 ** n;
    },
  },
  acetilcolina: {
    id: 'acetilcolina',
    name: 'Acetilcolina',
    rarity: 'common',
    max: 3,
    tags: ['shot'],
    scientificIdea: 'Neurotransmisor clave en la contracción muscular y la atención sostenida.',
    description: 'Disparas un 20 % más rápido.',
    apply: (m, n) => {
      m.fireRateMult *= 1.2 ** n;
    },
  },
  atencionSostenida: {
    id: 'atencionSostenida',
    name: 'Atención sostenida',
    rarity: 'common',
    max: 2,
    tags: ['util'],
    scientificIdea: 'Enfocar es seleccionar activamente qué estímulos alcanzan la consciencia.',
    description: 'Atraes las neurotrofinas desde un 50 % más lejos.',
    apply: (m, n) => {
      m.magnetMult *= 1.5 ** n;
    },
  },
  potenciacionLargoPlazo: {
    id: 'potenciacionLargoPlazo',
    name: 'Potenciación a largo plazo',
    rarity: 'common',
    max: 5,
    tags: ['shot'],
    scientificIdea: 'Las sinapsis usadas repetidamente aumentan su fuerza de transmisión de forma duradera.',
    description: 'Tus impulsos hacen un 18 % más de daño.',
    apply: (m, n) => {
      m.damageMult *= 1.18 ** n;
    },
  },
  arborizacion: {
    id: 'arborizacion',
    name: 'Arborización dendrítica',
    rarity: 'rare',
    max: 3,
    tags: ['shot'],
    scientificIdea: 'Las dendritas se ramifican densamente con el aprendizaje para recibir más conexiones.',
    description: 'Cada impulso rebota hacia 1 toxina cercana más.',
    apply: (m, n) => {
      m.bounces += n;
    },
  },
  microglia: {
    id: 'microglia',
    name: 'Microglía activa',
    rarity: 'rare',
    max: 2,
    tags: ['shot'],
    scientificIdea: 'Células inmunes residentes que patrullan y limpian residuos metabólicos del parénquima.',
    description: 'Tus impulsos atraviesan 1 toxina antes de pararse.',
    apply: (m, n) => {
      m.pierce += n;
    },
  },
  sinapsisMultiple: {
    id: 'sinapsisMultiple',
    name: 'Sinapsis múltiple',
    rarity: 'rare',
    max: 2,
    tags: ['shot'],
    scientificIdea: 'Un único soma axonal conecta con miles de terminales postsinápticos simultáneos.',
    description: 'Disparas 1 impulso más en abanico (cada uno hace un 12 % menos de daño).',
    apply: (m, n) => {
      m.extraProjectiles += n;
      m.damageMult *= 0.88 ** n;
    },
  },
  escudoGlial: {
    id: 'escudoGlial',
    name: 'Escudo glial',
    rarity: 'rare',
    max: 2,
    tags: ['def'],
    scientificIdea: 'Los astrocitos forman una barrera protectora física y metabólica sobre las neuronas.',
    description: 'Un escudo para 1 golpe. Se recarga en 12 s (8 s al nivel 2).',
    apply: (m, n) => {
      m.shieldCharges = 1;
      m.shieldRecharge = n === 1 ? 12 : 8;
    },
  },
  neurogenesis: {
    id: 'neurogenesis',
    name: 'Neurogénesis',
    rarity: 'rare',
    max: 2,
    tags: ['hp'],
    scientificIdea: 'El giro dentado del hipocampo genera neuronas adultas funcionales toda la vida.',
    description: '+1 corazón máximo y recuperas 1 ahora.',
    apply: (m, n) => {
      m.maxVitality += n;
    },
  },
  suenoReparador: {
    id: 'suenoReparador',
    name: 'Sueño reparador (REM / NREM)',
    rarity: 'legendary',
    max: 1,
    tags: ['hp'],
    scientificIdea: 'Durante el sueño profundo, el sistema glinfático drena toxinas y consolida memorias.',
    description: 'Cada vez que subes de nivel recuperas todos los corazones.',
    apply: (m) => {
      m.healOnLevel = true;
    },
  },
  nodosRanvier: {
    id: 'nodosRanvier',
    name: 'Nodos de Ranvier',
    rarity: 'legendary',
    max: 1,
    tags: ['move'],
    scientificIdea: 'Interrupciones periódicas en la vaina de mielina donde se regenera el potencial de acción.',
    description: 'Al esquivar dejas nodos que estallan y disparan 4 impulsos.',
    apply: (m) => {
      m.ranvierShots = 4;
    },
  },
  redSinaptica: {
    id: 'redSinaptica',
    name: 'Evolución: Red Sináptica Completa',
    rarity: 'evolution',
    max: 1,
    tags: ['shot', 'evolution'],
    requires: { arborizacion: 3, microglia: 2 },
    scientificIdea: 'Un circuito neuronal robusto y distribuido que transmite sin atenuación de señal.',
    description: 'Los rebotes ya no pierden daño en cada salto.',
    apply: (m) => {
      m.noBounceFalloff = true;
    },
  },
  impulsoSaltatorio: {
    id: 'impulsoSaltatorio',
    name: 'Evolución: Impulso Saltatorio Puro',
    rarity: 'evolution',
    max: 1,
    tags: ['move', 'evolution'],
    requires: { mielinizacion: 3, nodosRanvier: 1 },
    scientificIdea: 'Velocidad de conducción extrema en axones de gran calibre altamente mielinizados.',
    description: 'Al lanzar la Ola, durante 4 s el impulso no necesita recargarse.',
    apply: (m) => {
      m.infiniteDashOnUlt = true;
    },
  },
};

export const STARTER_CARDS: UpgradeId[] = [
  'mielinizacion',
  'acetilcolina',
  'atencionSostenida',
  'potenciacionLargoPlazo',
  'arborizacion',
  'microglia',
  'sinapsisMultiple',
  'escudoGlial',
  'neurogenesis',
  'suenoReparador',
  'nodosRanvier',
];

export function computeModifiers(owned: Partial<Record<UpgradeId, number>>): Modifiers {
  const m = baseModifiers();
  for (const [id, count] of Object.entries(owned)) {
    if (count && count > 0 && UPGRADES[id as UpgradeId]) {
      UPGRADES[id as UpgradeId].apply(m, count);
    }
  }
  return m;
}

export function isEvolutionReady(id: UpgradeId, owned: Partial<Record<UpgradeId, number>>): boolean {
  const def = UPGRADES[id];
  if (def.rarity !== 'evolution' || !def.requires) return false;
  if ((owned[id] ?? 0) >= def.max) return false;

  for (const [reqId, reqCount] of Object.entries(def.requires)) {
    if ((owned[reqId as UpgradeId] ?? 0) < (reqCount ?? 1)) {
      return false;
    }
  }
  return true;
}

const WEIGHT = {
  level: { common: 70, rare: 27, legendary: 3, evolution: 0 },
  region: { common: 0, rare: 65, legendary: 35, evolution: 0 },
};

export function drawOffer(
  owned: Partial<Record<UpgradeId, number>>,
  unlocked: UpgradeId[],
  kind: 'level' | 'region',
  rng: () => number
): UpgradeId[] {
  const evolutions =
    kind === 'region'
      ? (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => isEvolutionReady(id, owned))
      : [];

  const pool = unlocked.filter(
    (id) => (owned[id] ?? 0) < UPGRADES[id].max && UPGRADES[id].rarity !== 'evolution'
  );

  const out: UpgradeId[] = evolutions.slice(0, 1); // Una evolución lista siempre aparece

  const weights = WEIGHT[kind];
  while (out.length < 3 && pool.length > 0) {
    const total = pool.reduce((acc, id) => acc + (weights[UPGRADES[id].rarity] ?? 10), 0);
    if (total <= 0) break;

    let r = rng() * total;
    let pickedIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[UPGRADES[pool[i]].rarity] ?? 10;
      if (r <= 0) {
        pickedIdx = i;
        break;
      }
    }
    if (pickedIdx < 0) pickedIdx = 0;
    out.push(pool.splice(pickedIdx, 1)[0]);
  }

  return out;
}

export function applyInstantEffects(id: UpgradeId, w?: World) {
  if (!w) return;
  if (id === 'escudoGlial') {
    // el escudo aparece al momento la primera vez
    w.player.shieldActive = true;
    w.player.shieldTimer = 0;
  }
  if (id === 'neurogenesis') {
    w.player.vitality = Math.min(w.player.vitality + 1, w.player.mods.maxVitality);
  }
}
