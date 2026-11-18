/**
 * ProjectileRenderer.tsx — Renderizado de proyectiles con 1 único Draw Call
 *
 * Utiliza InstancedMesh con matrices interpoladas (world.alpha) y geometría
 * orientada en estela. Emite radiance HDR [4, 2.2, 0.6] para alimentar el bloom
 * selectivo sin coste de pointLights ni recompilación de shaders.
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';
import { STEP } from '../../engine/clock';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(0.14, 0.14, 0.55);
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const CAPSULE_GEO = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
CAPSULE_GEO.rotateX(Math.PI / 2);

export function ProjectileRenderer() {
  const mesh = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    if (!mesh.current) return;
    const p = world.projectiles;
    const a = world.alpha;

    for (let i = 0; i < p.count; i++) {
      _v.set(p.x[i] + p.vx[i] * STEP * a, 0.5, p.z[i] + p.vz[i] * STEP * a);
      _q.setFromAxisAngle(UP, Math.atan2(p.vx[i], p.vz[i]));
      mesh.current.setMatrixAt(i, _m.compose(_v, _q, _s));
    }

    mesh.current.count = p.count;
    mesh.current.instanceMatrix.clearUpdateRanges();
    mesh.current.instanceMatrix.addUpdateRange(0, p.count * 16);
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[CAPSULE_GEO, undefined, 512]}
      frustumCulled={false}
    >
      {/* Radiance HDR para Bloom sin luces dinámicas */}
      <meshBasicMaterial color={[4, 2.2, 0.6]} toneMapped={false} />
    </instancedMesh>
  );
}
