/**
 * clock.ts — Bucle de simulación de paso fijo y control de hit-stop / slow-motion
 */

export const STEP = 1 / 60;

export interface EngineClock {
  acc: number;
  timeScale: number;
  hitstop: number;
  slowmo: number;
}

export const clock: EngineClock = {
  acc: 0,
  timeScale: 1,
  hitstop: 0,
  slowmo: 0,
};

export const hitStop = (ms: number) => {
  clock.hitstop = Math.max(clock.hitstop, ms / 1000);
};

export const slowMo = (scale: number, secs: number) => {
  clock.timeScale = scale;
  clock.slowmo = secs;
};

export const resetClock = () => {
  clock.acc = 0;
  clock.timeScale = 1;
  clock.hitstop = 0;
  clock.slowmo = 0;
};
