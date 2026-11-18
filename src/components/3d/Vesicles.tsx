/**
 * Vesicles.tsx — Vesículas y neurotransmisores en suspensión microscópica
 *
 * Añade profundidad y parallax alrededor de la arena sin coste en CPU
 * mediante Points instanciados y oscilación sutil.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export function Vesicles({ count = 900 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null!);

  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 36;
      pos[i * 3 + 1] = Math.random() * 8 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, ph];
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((st) => {
    const t = st.clock.elapsedTime * 0.4;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      array[idx + 1] += Math.sin(t + phases[i]) * 0.003;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        color="#70a4cc"
        size={0.1}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}
