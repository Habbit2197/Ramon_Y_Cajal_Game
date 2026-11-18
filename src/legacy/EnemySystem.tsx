/**
 * EnemySystem.tsx — Sistema de Enemigos/Toxinas con RigidBody Dynamic (Rapier)
 *
 * - Enemigos/Toxinas físicos dinámicos: RigidBody type="dynamic"
 * - Colisiones e impactos con proyectiles: destruye al enemigo, lo elimina del store y suma 'BrainPower' al jugador.
 * - Lógica de niveles: usa currentLevel de Zustand para multiplicar la cantidad de enemigos y reducir el tiempo de spawn.
 * - Seguimiento suave hacia la posición del jugador.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, IntersectionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { useLegacyGameStore as useGameStore, type Enemy } from './legacyGameStore';

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

/**
 * Genera oleada de toxinas escaladas por el nivel actual (currentLevel)
 */
function generateEnemiesForLevel(level: number): Enemy[] {
  const types: Array<Enemy['type']> = ['smoke', 'alcohol', 'junk'];
  // Cantidad base 4, escalada con currentLevel: 4 + (level - 1) * 2
  const count = Math.min(18, 4 + (level - 1) * 2);
  const list: Enemy[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = 6.5 + Math.random() * 4.5; // Distribuidas en el perímetro de la arena
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;
    const type = types[i % types.length];
    list.push({
      id: `e-lvl${level}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      position: [x, 0.5, z],
      type,
      hp: level >= 3 && type === 'alcohol' ? 2 : 1,
    });
  }

  return list;
}

interface EnemyEntityProps {
  enemy: Enemy;
}

const EnemyEntity: React.FC<EnemyEntityProps> = ({ enemy }) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const playerPos = useGameStore((s) => s.playerPosition);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const removeEnemy = useGameStore((s) => s.removeEnemy);
  const increasePower = useGameStore((s) => s.increasePower);
  const removeProjectile = useGameStore((s) => s.removeProjectile);

  const color = ENEMY_COLORS[enemy.type];
  const emissive = ENEMY_EMISSIVE[enemy.type];

  // Movimiento dinámico hacia la posición del jugador escalado por el nivel
  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);

    const myPos = rb.translation();
    const dx = playerPos[0] - myPos.x;
    const dz = playerPos[2] - myPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.6) return;

    // Velocidad base + bono de agresividad por nivel
    const baseSpeed = enemy.type === 'smoke' ? 1.8 : enemy.type === 'alcohol' ? 2.4 : 1.6;
    const speed = baseSpeed * (1 + (currentLevel - 1) * 0.12);

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
  const currentLevel = useGameStore((s) => s.currentLevel);
  const gameState = useGameStore((s) => s.gameState);
  const spawnEnemies = useGameStore((s) => s.spawnEnemies);

  const prevLevelRef = useRef(currentLevel);
  const spawnCooldownRef = useRef(0);

  // Intervalo de spawn reducido a medida que sube el nivel: max(1.2s, 4.0s - level * 0.5s)
  const spawnInterval = Math.max(1.2, 4.0 - currentLevel * 0.5);

  // Spawn inicial o regeneración al quedar vacía la oleada
  useEffect(() => {
    if (gameState === 'playing' && enemies.length === 0) {
      spawnEnemies(generateEnemiesForLevel(currentLevel));
    }
  }, [gameState, enemies.length, currentLevel, spawnEnemies]);

  // Si cambia el nivel, respawnear nueva oleada escalada
  useEffect(() => {
    if (prevLevelRef.current !== currentLevel) {
      prevLevelRef.current = currentLevel;
      if (gameState === 'playing') {
        spawnEnemies(generateEnemiesForLevel(currentLevel));
      }
    }
  }, [currentLevel, gameState, spawnEnemies]);

  // Spawn dinámico periódico durante la partida
  useFrame((_state, delta) => {
    if (gameState !== 'playing') return;

    spawnCooldownRef.current += delta;
    const maxEnemies = 4 + currentLevel * 2;

    if (spawnCooldownRef.current >= spawnInterval && enemies.length < maxEnemies) {
      spawnCooldownRef.current = 0;
      const types: Array<Enemy['type']> = ['smoke', 'alcohol', 'junk'];
      const angle = Math.random() * Math.PI * 2;
      const dist = 7 + Math.random() * 4;
      const newEnemy: Enemy = {
        id: `e-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        position: [Math.sin(angle) * dist, 0.5, Math.cos(angle) * dist],
        type: types[Math.floor(Math.random() * types.length)],
        hp: 1,
      };
      const current = useGameStore.getState().enemies;
      spawnEnemies([...current, newEnemy]);
    }
  });

  return (
    <>
      {enemies.map((e) => (
        <EnemyEntity key={e.id} enemy={e} />
      ))}
    </>
  );
};

export default EnemySystem;
