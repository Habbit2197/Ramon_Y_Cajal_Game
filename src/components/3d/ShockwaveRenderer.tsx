/**
 * ShockwaveRenderer.tsx — Anillos de choque instanciados en 1 Draw Call
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

const RING_GEO = new THREE.RingGeometry(0.8, 1.0, 32);

export function ShockwaveRenderer() {
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    if (!mesh.current) return;
    const s = world.shockwaves;

    for (let i = 0; i < s.count; i++) {
      _v.set(s.x[i], 0.05, s.z[i]);
      const rad = s.radius[i];
      _s.set(rad, rad, 1);
      mesh.current.setMatrixAt(i, _m.compose(_v, _q, _s));
    }

    mesh.current.count = s.count;
    mesh.current.instanceMatrix.clearUpdateRanges();
    mesh.current.instanceMatrix.addUpdateRange(0, s.count * 16);
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[RING_GEO, undefined, 32]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color={[2.2, 2.5, 3.8]}
        transparent
        opacity={0.6}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
