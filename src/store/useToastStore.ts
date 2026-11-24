/**
 * useToastStore.ts — Cola de avisos (medallas desbloqueadas, estrellas…).
 */
import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'trophy' | 'info' | 'discovery';
  title: string;
  body: string;
}

interface ToastState {
  queue: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  shift: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  push: (t) => set((s) => ({ queue: [...s.queue, { ...t, id: nextId++ }] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
