/**
 * DendriteRenderer.tsx — Conexiones sinápticas brillantes de rebotes en GPU
 */

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';

const MAX_DENDRITES = 64;

export function DendriteRenderer() {
  const lineRef = useRef<THREE.LineSegments>(null!);
  const posArray = useMemo(() => new Float32Array(MAX_DENDRITES * 6), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    return g;
  }, [posArray]);

  useFrame(() => {
    const d = world.dendrites;
    const pos = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < d.count; i++) {
      const idx = i * 6;
      posArray[idx] = d.x1[i];
      posArray[idx + 1] = 0.45;
      posArray[idx + 2] = d.z1[i];

      posArray[idx + 3] = d.x2[i];
      posArray[idx + 4] = 0.45;
      posArray[idx + 5] = d.z2[i];
    }

    geo.setDrawRange(0, d.count * 2);
    pos.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial
        color={new THREE.Color(1.5, 3.5, 4.2)}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        transparent
        opacity={0.85}
      />
    </lineSegments>
  );
}
