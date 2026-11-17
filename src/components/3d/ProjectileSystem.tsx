/**
 * ProjectileSystem.tsx
 * Sistema de proyectiles sinápticos.
 *
 * - Lee projectiles[] del store Zustand
 * - Renderiza cada uno como RigidBody sensor (kinematic)
 * - En useFrame los mueve en su direction a PROJECTILE_SPEED m/s
 * - onIntersectionEnter → llama damageEnemy si el otro body es un enemy
 * - Elimina proyectiles fuera de bounds o que hayan colisionado
 *
 * Efecto visual: esfera pequeña con bloom emisivo amarillo-naranja +
 * una pointLight local para iluminar el entorno al pasar.
 */

import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, IntersectionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, Projectile } from '../../store/useGameStore';

const PROJECTILE_SPEED = 22.0;   // m/s
const MAX_LIFETIME = 3.0;        // segundos antes de auto-eliminar
const OUT_OF_BOUNDS = 20;        // distancia máxima del origen

// ─── Un proyectil individual ──────────────────────────────────────────────────

interface ProjectileProps {
  projectile: Projectile;
}

const ProjectileEntity: React.FC<ProjectileProps> = ({ projectile }) => {
  const rbRef = useRef<RapierRigidBody>(null);
  const posRef = useRef(new THREE.Vector3(...projectile.position));
  const dirRef = useRef(new THREE.Vector3(...projectile.direction).normalize());
  const lifetimeRef = useRef(0);
  const hitRef = useRef(false);

  const removeProjectile = useGameStore((s) => s.removeProjectile);
  const damageEnemy = useGameStore((s) => s.damageEnemy);
  const incrementCombo = useGameStore((s) => s.incrementCombo);
  const addScore = useGameStore((s) => s.addScore);

  const handleIntersect = useCallback(
    (payload: IntersectionEnterPayload) => {
      if (hitRef.current) return;
      const otherName = payload.other.rigidBodyObject?.name ?? '';
      if (otherName.startsWith('enemy-')) {
        const enemyId = otherName.replace('enemy-', '');
        hitRef.current = true;
        damageEnemy(enemyId, 1);
        incrementCombo();
        addScore(50);
        removeProjectile(projectile.id);
      }
    },
    [damageEnemy, incrementCombo, addScore, removeProjectile, projectile.id]
  );

  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb || hitRef.current) return;

    const dt = Math.min(delta, 0.05);
    lifetimeRef.current += dt;

    // Auto-destruir por lifetime o bounds
    if (
      lifetimeRef.current > MAX_LIFETIME ||
      Math.abs(posRef.current.x) > OUT_OF_BOUNDS ||
      Math.abs(posRef.current.z) > OUT_OF_BOUNDS
    ) {
      removeProjectile(projectile.id);
      return;
    }

    // Mover en la dirección del proyectil
    posRef.current.x += dirRef.current.x * PROJECTILE_SPEED * dt;
    posRef.current.z += dirRef.current.z * PROJECTILE_SPEED * dt;

    rb.setNextKinematicTranslation({
      x: posRef.current.x,
      y: posRef.current.y,
      z: posRef.current.z,
    });
  });

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      sensor
      name={`projectile-${projectile.id}`}
      position={projectile.position}
      onIntersectionEnter={handleIntersect}
    >
      {/* Colisionador pequeño */}
      <group name="SynapticBolt">
        {/* Núcleo del proyectil */}
        <mesh>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial
            color="#ffaa00"
            emissive="#ff6600"
            emissiveIntensity={6}
          />
        </mesh>
        {/* Halo externo */}
        <mesh>
          <sphereGeometry args={[0.22, 6, 6]} />
          <meshStandardMaterial
            color="#ffdd00"
            emissive="#ffaa00"
            emissiveIntensity={3}
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
        {/* Luz puntual local */}
        <pointLight color="#ff9900" intensity={5} distance={3} decay={2} />
      </group>
    </RigidBody>
  );
};

// ─── Sistema completo ─────────────────────────────────────────────────────────

export const ProjectileSystem: React.FC = () => {
  const projectiles = useGameStore((s) => s.projectiles);

  return (
    <>
      {projectiles.map((p) => (
        <ProjectileEntity key={p.id} projectile={p} />
      ))}
    </>
  );
};

export default ProjectileSystem;
