/**
 * legacyGameStore.ts — Estado de prototipo heredado para Scene, ProjectileSystem y EnemySystem
 */

import { create } from 'zustand';

export interface JoystickVector {
  x: number;
  z: number;
}

export interface Projectile {
  id: string;
  position: [number, number, number];
  direction: [number, number, number];
}

export interface Enemy {
  id: string;
  position: [number, number, number];
  type: 'smoke' | 'alcohol' | 'junk';
  hp: number;
}

export interface LegacyGameStoreState {
  playerName: string;
  currentLevel: number;
  gameState: 'menu' | 'playing' | 'gameover';
  setPlayerName: (name: string) => void;
  startGame: () => void;
  nextLevel: () => void;
  gameOver: () => void;

  brainPower: number;
  increasePower: (amount: number) => void;
  decreasePower: (amount: number) => void;
  setBrainPower: (value: number) => void;
  resetPower: () => void;

  joystickVector: JoystickVector;
  setJoystickVector: (v: JoystickVector) => void;
  resetJoystickVector: () => void;

  projectiles: Projectile[];
  addProjectile: (p: Projectile) => void;
  removeProjectile: (id: string) => void;
  clearProjectiles: () => void;
  shootProjectile: () => void;

  enemies: Enemy[];
  spawnEnemies: (enemies: Enemy[]) => void;
  damageEnemy: (id: string, dmg: number) => void;
  removeEnemy: (id: string) => void;

  playerPosition: [number, number, number];
  setPlayerPosition: (pos: [number, number, number]) => void;

  dashCooldown: number;
  dashActive: boolean;
  triggerDash: () => void;
  tickDash: (dt: number) => void;

  combo: number;
  inFlowState: boolean;
  incrementCombo: () => void;
  resetCombo: () => void;

  score: number;
  addScore: (points: number) => void;
}

export const useLegacyGameStore = create<LegacyGameStoreState>((set) => ({
  playerName: '',
  currentLevel: 1,
  gameState: 'menu',
  setPlayerName: (name: string) => set({ playerName: name }),
  startGame: () =>
    set({
      gameState: 'playing',
      brainPower: 100,
      score: 0,
      combo: 0,
      projectiles: [],
      dashCooldown: 0,
      dashActive: false,
    }),
  nextLevel: () =>
    set((state) => ({
      currentLevel: state.currentLevel + 1,
      brainPower: Math.min(100, state.brainPower + 20),
      projectiles: [],
    })),
  gameOver: () => set({ gameState: 'gameover' }),

  brainPower: 50,
  increasePower: (amount: number) =>
    set((state) => ({
      brainPower: Math.min(100, Math.max(0, state.brainPower + Math.abs(amount))),
    })),
  decreasePower: (amount: number) =>
    set((state) => ({
      brainPower: Math.min(100, Math.max(0, state.brainPower - Math.abs(amount))),
    })),
  setBrainPower: (value: number) =>
    set(() => ({
      brainPower: Math.min(100, Math.max(0, Math.round(value))),
    })),
  resetPower: () => set({ brainPower: 50 }),

  joystickVector: { x: 0, z: 0 },
  setJoystickVector: (v: JoystickVector) => set({ joystickVector: v }),
  resetJoystickVector: () => set({ joystickVector: { x: 0, z: 0 } }),

  projectiles: [],
  addProjectile: (p) => set((state) => ({ projectiles: [...state.projectiles, p] })),
  removeProjectile: (id) =>
    set((state) => ({ projectiles: state.projectiles.filter((p) => p.id !== id) })),
  clearProjectiles: () => set({ projectiles: [] }),
  shootProjectile: () =>
    set((state) => {
      const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const jv = state.joystickVector;
      let dx = jv.x;
      let dz = jv.z;
      if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
        dz = -1;
      } else {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;
      }
      return {
        projectiles: [
          ...state.projectiles,
          {
            id,
            position: [...state.playerPosition],
            direction: [dx, 0, dz],
          },
        ],
      };
    }),

  enemies: [],
  spawnEnemies: (enemies) => set({ enemies }),
  damageEnemy: (id, dmg) =>
    set((state) => {
      const updated = state.enemies.map((e) =>
        e.id === id ? { ...e, hp: e.hp - dmg } : e
      );
      const killed = updated.filter((e) => e.hp <= 0);
      const alive = updated.filter((e) => e.hp > 0);
      const bonusPower = killed.length * 10;
      return {
        enemies: alive,
        brainPower: Math.min(100, state.brainPower + bonusPower),
      };
    }),
  removeEnemy: (id) =>
    set((state) => ({
      enemies: state.enemies.filter((e) => e.id !== id),
      brainPower: Math.min(100, state.brainPower + 10),
    })),

  playerPosition: [0, 0.5, 0],
  setPlayerPosition: (pos) => set({ playerPosition: pos }),

  dashCooldown: 0,
  dashActive: false,
  triggerDash: () => set({ dashActive: true, dashCooldown: 2.0 }),
  tickDash: (dt) =>
    set((state) => ({
      dashCooldown: Math.max(0, state.dashCooldown - dt),
      dashActive: state.dashCooldown > 1.8 ? state.dashActive : false,
    })),

  combo: 0,
  inFlowState: false,
  incrementCombo: () =>
    set((state) => {
      const combo = state.combo + 1;
      return { combo, inFlowState: combo >= 5 };
    }),
  resetCombo: () => set({ combo: 0, inFlowState: false }),

  score: 0,
  addScore: (points) => set((state) => ({ score: state.score + points })),
}));
