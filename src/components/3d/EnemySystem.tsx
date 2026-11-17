/**
 * EnemySystem.tsx
 * Enemigos (Toxinas) como RigidBody dynamic de Rapier.
 * 
 * - Lee enemies[] del store Zustand
 * - Cada enemigo es un RigidBody type="dynamic"
 * - Aspecto: esfera de humo (gris translúcido) o dodecaedro rojo (alcohol) o cubo (junk)
 * - onIntersectionEnter con proyectiles → el sistema de proyectiles maneja la lógica
 * - Se eliminan del store cuando hp <= 0
 * - Spawn inicial de 5 enemigos si enemies está vacío
 */

import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
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
    { id: 'e1', position: [ 4, 0.5,  3], type: 'smoke',   hp: 2 },
    { id: 'e2', position: [-5, 0.5,  2], type: 'alcohol', hp: 3 },
    { id: 'e3', position: [ 6, 0.5, -4], type: 'junk',    hp: 2 },
    { id: 'e4', position: [-3, 0.5, -5], type: 'smoke',   hp: 2 },
    { id: 'e5', position: [ 0, 0.5,  7], type: 'alcohol', hp: 3 },
  ];
}

interface EnemyEntityProps {
  enemy: Enemy;
}

const EnemyEntity: React.FC<EnemyEntityProps> = ({ enemy }) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const playerPos = useGameStore((s) => s.playerPosition);
  
  const color   = ENEMY_COLORS[enemy.type];
  const emissive = ENEMY_EMISSIVE[enemy.type];

  // Movimiento: los enemigos siguen al jugador lentamente
  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const myPos = rb.translation();
    const dx = playerPos[0] - myPos.x;
    const dz = playerPos[2] - myPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.5) return; // demasiado cerca: parar

    const speed = enemy.type === 'smoke' ? 1.8 : enemy.type === 'alcohol' ? 2.5 : 1.5;
    const factor = (speed * dt) / dist;
    rb.setLinvel({ x: dx * factor / dt, y: 0, z: dz * factor / dt }, true);
  });

  const GeometryByType = () => {
    switch (enemy.type) {
      case 'smoke':   return <sphereGeometry args={[0.6, 10, 10]} />;
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
        {/* Anillo de telegrafía */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
          <ringGeometry args={[0.8, 0.95, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </RigidBody>
  );
};

export const EnemySystem: React.FC = () => {
  const enemies    = useGameStore((s) => s.enemies);
  const spawnEnemies = useGameStore((s) => s.spawnEnemies);

  // Spawn inicial
  useEffect(() => {
    if (enemies.length === 0) {
      spawnEnemies(getInitialEnemies());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {enemies.map((e) => (
        <EnemyEntity key={e.id} enemy={e} />
      ))}
    </>
  );
};

export default EnemySystem;
