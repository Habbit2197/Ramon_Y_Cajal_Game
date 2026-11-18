/**
 * OrbRenderer.tsx — Renderizado de neurotrofinas (BDNF / BrainPower) en 1 Draw Call
 *
 * Esferas brillantes doradas en HDR con oscilación suave y tamaño optimizado.
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';
import { STEP } from '../../engine/clock';

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3(0.22, 0.22, 0.22);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

const ORB_GEO = new THREE.IcosahedronGeometry(0.2, 1);

export function OrbRenderer() {
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useFrame((st) => {
    if (!mesh.current) return;
    const o = world.orbs;
    const a = world.alpha;
    const pulse = 1.0 + 0.15 * Math.sin(st.clock.elapsedTime * 6);
    _s.set(0.2 * pulse, 0.2 * pulse, 0.2 * pulse);

    for (let i = 0; i < o.count; i++) {
      _v.set(
        o.x[i] + o.vx[i] * STEP * a,
        0.35 + 0.08 * Math.sin(st.clock.elapsedTime * 5 + i),
        o.z[i] + o.vz[i] * STEP * a
      );
      mesh.current.setMatrixAt(i, _m.compose(_v, _q, _s));
    }

    mesh.current.count = o.count;
    mesh.current.instanceMatrix.clearUpdateRanges();
    mesh.current.instanceMatrix.addUpdateRange(0, o.count * 16);
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[ORB_GEO, undefined, 384]}
      frustumCulled={false}
    >
      <meshBasicMaterial color={[3.6, 2.8, 0.5]} toneMapped={false} />
    </instancedMesh>
  );
}
