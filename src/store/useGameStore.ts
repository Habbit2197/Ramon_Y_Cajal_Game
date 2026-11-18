import { create } from 'zustand';

export interface JoystickVector {
  x: number;
  z: number;
}

export interface GameStoreState {
  // ── Brain power ───────────────────────────────────────────────────────────
  brainPower: number;
  increasePower: (amount: number) => void;
  decreasePower: (amount: number) => void;
  setBrainPower: (value: number) => void;
  resetPower: () => void;

  // ── Joystick táctil ───────────────────────────────────────────────────────
  /** Vector de dirección normalizado del joystick táctil (x, z en el plano XZ) */
  joystickVector: JoystickVector;
  setJoystickVector: (v: JoystickVector) => void;
  resetJoystickVector: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  // ── Brain power ───────────────────────────────────────────────────────────
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
    set({ brainPower: Math.min(100, Math.max(0, value)) }),
  resetPower: () => set({ brainPower: 50 }),

  // ── Joystick táctil ───────────────────────────────────────────────────────
  joystickVector: { x: 0, z: 0 },
  setJoystickVector: (v: JoystickVector) => set({ joystickVector: v }),
  resetJoystickVector: () => set({ joystickVector: { x: 0, z: 0 } }),
}));
