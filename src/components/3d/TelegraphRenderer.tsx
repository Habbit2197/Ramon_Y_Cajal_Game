/**
 * TelegraphRenderer.tsx — Círculos de pre-aviso de spawn en el suelo (0.8 s)
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const TELEGRAPH_GEO = new THREE.RingGeometry(0.75, 0.9, 24);

export function TelegraphRenderer() {
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    if (!mesh.current) return;
    const t = world.telegraphs;

    for (let i = 0; i < t.count; i++) {
      _v.set(t.x[i], 0.04, t.z[i]);
      // Pulso de advertencia que se contrae conforme se acerca el momento del spawn
      const progress = 1 - t.timer[i] / (t.duration[i] || 0.8);
      const scale = 0.6 + progress * 0.4;
      _s.set(scale, scale, 1);
      mesh.current.setMatrixAt(i, _m.compose(_v, _q, _s));
    }

    mesh.current.count = t.count;
    mesh.current.instanceMatrix.clearUpdateRanges();
    mesh.current.instanceMatrix.addUpdateRange(0, t.count * 16);
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[TELEGRAPH_GEO, undefined, 32]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color={[3.5, 0.4, 0.4]}
        transparent
        opacity={0.7}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
