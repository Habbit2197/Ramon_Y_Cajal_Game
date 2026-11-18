/**
 * BurstRenderer.tsx — Montura React Three Fiber para el BurstSystem en GPU
 */

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BurstSystem } from '../../vfx/BurstSystem';
import { world } from '../../engine/world';

export function BurstRenderer() {
  const burstSystem = useMemo(() => new BurstSystem(), []);

  useEffect(() => {
    world.burstEmitter = (x, y, z, color, count, speed) => {
      burstSystem.emit(x, y, z, color, count, speed, performance.now() * 0.001);
    };
    return () => {
      world.burstEmitter = undefined;
    };
  }, [burstSystem]);

  useFrame((st) => {
    burstSystem.material.uniforms.uTime.value = st.clock.elapsedTime;
  });

  return <primitive object={burstSystem.mesh} />;
}
