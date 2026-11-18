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
import { world } from '../../engine/world';
import { type EnemyKind, PARK } from '../../game/enemies/pool';

export const G = {
  PLAYER: 0,
  ENEMY: 1,
  WALL: 2,
  SWARM: 3,
} as const;

const KIND_OFFSET: Record<string, number> = {
  swarmer: -200,
  tank0: -120,
  tank1: -80,
  tank2: -40,
  homing: 0,
};

export interface EnemyPoolProps {
  kind: EnemyKind;
  size: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export function EnemyPool({ kind, size, geometry, material }: EnemyPoolProps) {
  const bodies = useRef<RapierRigidBody[]>(null);

  const instances = useMemo<InstancedRigidBodyProps[]>(
    () =>
      Array.from({ length: size }, (_, i) => ({
        key: `${kind}-${i}`,
        position: [
          KIND_OFFSET[kind] + (i % 16) * 2.5,
          PARK.y,
          Math.floor(i / 16) * 2.5,
        ],
      })),
    [kind, size]
  );

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
        args={[geometry, material, size]}
        frustumCulled={false}
      />
    </InstancedRigidBodies>
  );
}
