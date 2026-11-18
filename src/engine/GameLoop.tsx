/**
 * GameLoop.tsx — Único componente con useFrame de simulación y sincronización con Rapier
 *
 * Implementa el bucle de simulación con paso fijo (1/60s) desacoplado del framerate.
 * Soporta hit-stop real (congela simulación y Rapier sin congelar cámara ni VFX)
 * y cámara lenta cinemática (slowmo).
 */

import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { STEP, clock } from './clock';
import { feel } from './feel';
import { world } from './world';
import { simulate } from './simulate';

export function GameLoop() {
  const { step } = useRapier(); // Rapier en modo pausado para avance manual estricto

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    feel.update(dt); // Cámara, flashes y VFX siempre se actualizan en tiempo real

    // Hit-stop congela la simulación para otorgar peso visceral al impacto
    if (clock.hitstop > 0) {
      clock.hitstop -= dt;
      return;
    }

    if (clock.slowmo > 0 && (clock.slowmo -= dt) <= 0) {
      clock.timeScale = 1;
    }

    clock.acc += dt * clock.timeScale;
    let steps = 0;

    // Límite de 5 sub-pasos para prevenir espiral de muerte por acumulación
    while (clock.acc >= STEP && steps++ < 5) {
      simulate(world, STEP);
      step(STEP);
      clock.acc -= STEP;
    }

    world.alpha = clock.acc / STEP; // Factor de interpolación para el renderizado
  }, -1); // Prioridad negativa para ejecutarse antes de cualquier renderizado

  return null;
}
