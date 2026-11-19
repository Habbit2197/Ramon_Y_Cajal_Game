/**
 * EnemyPool.tsx — Pools de cuerpos físicos instanciados para enemigos con Rapier
 *
 * Utiliza InstancedRigidBodies para renderizar y simular dinámicamente decenas
 * de enemigos en 1 solo draw call por tipo. Rotaciones bloqueadas, desplazamiento Y
 * bloqueado, aparcamiento fuera del campo cuando están inactivos.
 */

import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  InstancedRigidBodies,
  type RapierRigidBody,
  type InstancedRigidBodyProps,
  interactionGroups,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { world, HIT_FLASH } from '../../engine/world';
import { type EnemyKind, PARK } from '../../game/enemies/pool';

export const G = {
  PLAYER: 0,
  ENEMY: 1,
  WALL: 2,
  SWARM: 3,
} as const;

export interface EnemyPoolProps {
  kind: EnemyKind;
  size: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

const KIND_OFFSET: Record<string, number> = { swarmer: -200, tank0: -120, tank1: -80, tank2: -40, homing: 0 };

const WHITE = new THREE.Color(1, 1, 1);
const _flash = new THREE.Color();

export function EnemyPool({ kind, size, geometry, material }: EnemyPoolProps) {
  const bodies = useRef<RapierRigidBody[]>(null);

  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      Array.from({ length: size }, (_, i) => ({
        key: `${kind}-${i}`,
        // Cada cuerpo aparcado en su propia celda: centros idénticos = normal de contacto indefinida = pánico de Rapier
        position: [KIND_OFFSET[kind] + (i % 16) * 2.5, PARK.y, Math.floor(i / 16) * 2.5],
      })),
    [kind, size]
  );

  // Destello al impactar: el color de la instancia sube a HDR y vuelve en 0,12 s
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < size; i++) mesh.current.setColorAt(i, WHITE);
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [size]);
  useFrame((_, dt) => {
    const pool = world.pools[kind];
    if (!mesh.current || !pool.flash.length) return;
    let changed = false;
    for (let i = 0; i < pool.flash.length; i++) {
      const f = pool.flash[i];
      if (f <= -1) continue; // en reposo: no hay nada que actualizar
      const k = Math.max(0, f) / HIT_FLASH;
      _flash.setScalar(1 + k * 2.6);
      mesh.current.setColorAt(i, _flash);
      pool.flash[i] = f > 0 ? f - dt : -1; // al terminar, vuelve al color normal y queda en reposo
      changed = true;
    }
    if (changed && mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  useEffect(() => {
    if (!bodies.current) return;
    world.pools[kind].attach(bodies.current);
    bodies.current.forEach((b) => {
      b.setEnabled(false);
      b.setLinvel({ x: 0, y: 0, z: 0 }, false);
    });
  }, [kind]);

  const collisionGroup = useMemo(() => {
    const isSwarm = kind === 'swarmer';
    return interactionGroups(
      isSwarm ? G.SWARM : G.ENEMY,
      [G.ENEMY, G.SWARM, G.WALL, G.PLAYER]
    );
  }, [kind]);

  return (
    <InstancedRigidBodies
      ref={bodies}
      instances={instances}
      colliders="ball"
      enabledTranslations={[true, false, true]}
      lockRotations
      linearDamping={kind.startsWith('tank') ? 4 : 2}
      collisionGroups={collisionGroup}
    >
      <instancedMesh
        ref={mesh}
        args={[geometry, material, size]}
        frustumCulled={false}
      />
    </InstancedRigidBodies>
  );
}
