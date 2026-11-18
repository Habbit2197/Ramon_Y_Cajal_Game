/**
 * Arena.tsx — Muros perimétricos con colliders fijos de Rapier y borde luminiscente
 *
 * Mantiene a los enemigos dinámicos y al jugador dentro del espacio jugable
 * sin fugas físicas fuera del frustum.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { CuboidCollider } from '@react-three/rapier';

export const ARENA_BOUNDS = { x: 14.0, z: 10.0 };

export function Arena() {
  const borderGeo = useMemo(() => {
    const x = ARENA_BOUNDS.x;
    const z = ARENA_BOUNDS.z;
    const pts = [
      new THREE.Vector3(-x, 0.1, -z),
      new THREE.Vector3(x, 0.1, -z),
      new THREE.Vector3(x, 0.1, z),
      new THREE.Vector3(-x, 0.1, z),
      new THREE.Vector3(-x, 0.1, -z),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  return (
    <group name="Arena">
      {/* Muros con CuboidCollider estáticos de Rapier */}
      <CuboidCollider position={[-ARENA_BOUNDS.x - 0.5, 0.5, 0]} args={[0.5, 1.5, ARENA_BOUNDS.z + 1]} />
      <CuboidCollider position={[ARENA_BOUNDS.x + 0.5, 0.5, 0]} args={[0.5, 1.5, ARENA_BOUNDS.z + 1]} />
      <CuboidCollider position={[0, 0.5, -ARENA_BOUNDS.z - 0.5]} args={[ARENA_BOUNDS.x + 1, 1.5, 0.5]} />
      <CuboidCollider position={[0, 0.5, ARENA_BOUNDS.z + 0.5]} args={[ARENA_BOUNDS.x + 1, 1.5, 0.5]} />

      {/* Línea perimétrica sináptica */}
      <lineLoop geometry={borderGeo}>
        <lineBasicMaterial color={new THREE.Color(0.2, 0.8, 1.4)} toneMapped={false} transparent opacity={0.6} />
      </lineLoop>
    </group>
  );
}
