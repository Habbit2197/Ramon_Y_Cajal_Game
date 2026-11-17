import { create } from 'zustand';

export interface GameStoreState {
  brainPower: number;
  increasePower: (amount: number) => void;
  decreasePower: (amount: number) => void;
  setBrainPower: (value: number) => void;
  resetPower: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
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
}));
