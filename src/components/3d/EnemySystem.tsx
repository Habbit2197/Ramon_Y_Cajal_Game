/**
 * EnemySystem.tsx — Sistema de Enemigos/Toxinas con RigidBody Dynamic (Rapier)
 *
 * - Enemigos/Toxinas físicos dinámicos: RigidBody type="dynamic"
 * - Colisiones e impactos con proyectiles: destruye al enemigo, lo elimina del store y suma 'BrainPower' al jugador.
 * - Seguimiento suave hacia la posición del jugador.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, IntersectionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, Enemy } from '../../store/useGameStore';

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  smoke:   '#6b7280',
  alcohol: '#dc2626',
  junk:    '#d97706',
};

const ENEMY_EMISSIVE: Record<Enemy['type'], string> = {
  smoke:   '#374151',
  alcohol: '#7f1d1d',
  junk:    '#78350f',
};

function getInitialEnemies(): Enemy[] {
  return [
    { id: 'e1', position: [ 4, 0.5,  3], type: 'smoke',   hp: 1 },
    { id: 'e2', position: [-5, 0.5,  2], type: 'alcohol', hp: 1 },
    { id: 'e3', position: [ 6, 0.5, -4], type: 'junk',    hp: 1 },
    { id: 'e4', position: [-3, 0.5, -5], type: 'smoke',   hp: 1 },
    { id: 'e5', position: [ 0, 0.5,  7], type: 'alcohol', hp: 1 },
  ];
}

interface EnemyEntityProps {
  enemy: Enemy;
}

const EnemyEntity: React.FC<EnemyEntityProps> = ({ enemy }) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const playerPos = useGameStore((s) => s.playerPosition);
  const removeEnemy = useGameStore((s) => s.removeEnemy);
  const increasePower = useGameStore((s) => s.increasePower);
  const removeProjectile = useGameStore((s) => s.removeProjectile);

  const color = ENEMY_COLORS[enemy.type];
  const emissive = ENEMY_EMISSIVE[enemy.type];

  // Movimiento dinámico hacia la posición del jugador
  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const myPos = rb.translation();
    const dx = playerPos[0] - myPos.x;
    const dz = playerPos[2] - myPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.6) return;

    const speed = enemy.type === 'smoke' ? 1.8 : enemy.type === 'alcohol' ? 2.4 : 1.6;
    const factor = (speed * dt) / dist;
    rb.setLinvel({ x: (dx * factor) / dt, y: 0, z: (dz * factor) / dt }, true);
  });

  // Detección de impacto cuando el proyectil entra en la toxina
  const handleIntersection = useCallback(
    (payload: IntersectionEnterPayload) => {
      const otherName = payload.other.rigidBodyObject?.name ?? '';
      if (otherName.startsWith('projectile-')) {
        const projId = otherName.replace('projectile-', '');
        // Destruir al enemigo, eliminarlo del store y sumar BrainPower
        removeEnemy(enemy.id);
        increasePower(10);
        removeProjectile(projId);
      }
    },
    [enemy.id, removeEnemy, increasePower, removeProjectile]
  );

  const GeometryByType = () => {
    switch (enemy.type) {
      case 'smoke':   return <sphereGeometry args={[0.6, 12, 12]} />;
      case 'alcohol': return <dodecahedronGeometry args={[0.55, 0]} />;
      case 'junk':    return <boxGeometry args={[0.9, 0.9, 0.9]} />;
    }
  };

  return (
    <RigidBody
      ref={rbRef}
      type="dynamic"
      colliders="ball"
      position={enemy.position}
      name={`enemy-${enemy.id}`}
      linearDamping={3}
      angularDamping={2}
      onIntersectionEnter={handleIntersection}
    >
      <group>
        <mesh castShadow>
          <GeometryByType />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={1.5}
            transparent
            opacity={enemy.type === 'smoke' ? 0.75 : 0.9}
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>
        {/* Anillo telegrafiado en el suelo */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
          <ringGeometry args={[0.8, 0.95, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </RigidBody>
  );
};

export const EnemySystem: React.FC = () => {
  const enemies = useGameStore((s) => s.enemies);
  const spawnEnemies = useGameStore((s) => s.spawnEnemies);

  // Spawn inicial de toxinas
  useEffect(() => {
    if (enemies.length === 0) {
      spawnEnemies(getInitialEnemies());
    }
  }, [enemies.length, spawnEnemies]);

  return (
    <>
      {enemies.map((e) => (
        <EnemyEntity key={e.id} enemy={e} />
      ))}
    </>
  );
};

export default EnemySystem;
