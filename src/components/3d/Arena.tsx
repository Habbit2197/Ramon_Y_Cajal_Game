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

const X = ARENA_BOUNDS.x, Z = ARENA_BOUNDS.z, T = 0.16, FAR = 60;
/** [x, z, ancho, fondo] de las cuatro barras del borde */
const BORDER: [number, number, number, number][] = [
  [0, -Z, 2 * X + T, T], [0, Z, 2 * X + T, T], [-X, 0, T, 2 * Z + T], [X, 0, T, 2 * Z + T],
];
/** [x, z, ancho, fondo] de las cuatro zonas exteriores oscurecidas */
const OUTSIDE: [number, number, number, number][] = [
  [0, -Z - FAR / 2, 2 * (X + FAR), FAR], [0, Z + FAR / 2, 2 * (X + FAR), FAR],
  [-X - FAR / 2, 0, FAR, 2 * Z], [X + FAR / 2, 0, FAR, 2 * Z],
];

export function Arena() {
  return (
    <group name="Arena">
      {/* Muros con CuboidCollider estáticos de Rapier */}
      <CuboidCollider position={[-ARENA_BOUNDS.x - 0.5, 0.5, 0]} args={[0.5, 1.5, ARENA_BOUNDS.z + 1]} />
      <CuboidCollider position={[ARENA_BOUNDS.x + 0.5, 0.5, 0]} args={[0.5, 1.5, ARENA_BOUNDS.z + 1]} />
      <CuboidCollider position={[0, 0.5, -ARENA_BOUNDS.z - 0.5]} args={[ARENA_BOUNDS.x + 1, 1.5, 0.5]} />
      <CuboidCollider position={[0, 0.5, ARENA_BOUNDS.z + 0.5]} args={[ARENA_BOUNDS.x + 1, 1.5, 0.5]} />

      {/* Borde luminoso grueso: se ve bien también en móviles pequeños */}
      {BORDER.map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, 0.08, pz]}>
          <boxGeometry args={[sx, 0.1, sz]} />
          <meshBasicMaterial color={[0.35, 1.6, 2.4]} toneMapped={false} />
        </mesh>
      ))}
      {/* Fuera de la arena, el tejido se oscurece: el límite se lee de un vistazo */}
      {OUTSIDE.map(([px, pz, sx, sz], i) => (
        <mesh key={`o${i}`} position={[px, 0.06, pz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sx, sz]} />
          <meshBasicMaterial color="#01040a" transparent opacity={0.62} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
