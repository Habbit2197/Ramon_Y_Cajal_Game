/**
 * ProjectileSystem.tsx — Sistema de Disparo Ágil y Proyectiles Sinápticos
 *
 * - Sincronizado con Zustand (projectiles, addProjectile, removeProjectile, removeEnemy, increasePower).
 * - Detecta pulsación de la barra espaciadora o botón táctil para añadir proyectiles al store global.
 * - Renderiza los proyectiles como pequeñas esferas brillantes (emissive naranja/amarillo).
 * - RigidBody type="kinematicPositionBased" sensor con onIntersectionEnter.
 * - En useFrame, mueve cada proyectil hacia adelante en su dirección.
 * - Al colisionar con un enemigo, lo destruye, lo elimina del store y suma BrainPower al jugador.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, IntersectionEnterPayload } from '@react-three/rapier';
import * as THREE from 'three';
import { useLegacyGameStore as useGameStore, type Projectile } from './legacyGameStore';

const PROJECTILE_SPEED = 24.0;
const MAX_LIFETIME = 2.5;
const OUT_OF_BOUNDS = 22;

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
  const removeEnemy = useGameStore((s) => s.removeEnemy);
  const increasePower = useGameStore((s) => s.increasePower);
  const addScore = useGameStore((s) => s.addScore);
  const incrementCombo = useGameStore((s) => s.incrementCombo);

  const handleIntersect = useCallback(
    (payload: IntersectionEnterPayload) => {
      if (hitRef.current) return;
      const otherName = payload.other.rigidBodyObject?.name ?? '';

      // Detección de impacto con toxina/enemigo
      if (otherName.startsWith('enemy-')) {
        const enemyId = otherName.replace('enemy-', '');
        hitRef.current = true;

        // Destruir al enemigo, eliminarlo del store y sumar BrainPower al jugador
        removeEnemy(enemyId);
        increasePower(10);
        addScore(50);
        incrementCombo();
        removeProjectile(projectile.id);
      }
    },
    [removeEnemy, increasePower, addScore, incrementCombo, removeProjectile, projectile.id]
  );

  useFrame((_state, delta) => {
    const rb = rbRef.current;
    if (!rb || hitRef.current) return;

    const dt = Math.min(delta, 0.05);
    lifetimeRef.current += dt;

    // Despawn por tiempo o límites del mapa
    if (
      lifetimeRef.current > MAX_LIFETIME ||
      Math.abs(posRef.current.x) > OUT_OF_BOUNDS ||
      Math.abs(posRef.current.z) > OUT_OF_BOUNDS
    ) {
      removeProjectile(projectile.id);
      return;
    }

    // Mover hacia adelante en su dirección
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
      {/* Pequeña esfera brillante (emissive naranja/amarillo) */}
      <mesh name="SynapticBolt">
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color="#ffaa00"
          emissive="#ff6600"
          emissiveIntensity={4}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      <pointLight color="#ff9900" intensity={4} distance={4} decay={2} />
    </RigidBody>
  );
};

export const ProjectileSystem: React.FC = () => {
  const projectiles = useGameStore((s) => s.projectiles);
  const addProjectile = useGameStore((s) => s.addProjectile);

  // Función para disparar sincronizada con el estado de Zustand
  const shoot = useCallback(() => {
    const state = useGameStore.getState();
    const pos = state.playerPosition;
    const jv = state.joystickVector;

    let dx = jv.x;
    let dz = jv.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
      dz = -1; // Dirección frontal por defecto
    } else {
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
    }

    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    addProjectile({
      id,
      position: [pos[0], pos[1], pos[2]],
      direction: [dx, 0, dz],
    });
  }, [addProjectile]);

  // Sincronización con barra espaciadora y evento de botón táctil
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        shoot();
      }
    };

    const onTouchShoot = () => {
      shoot();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('trigger-touch-shoot', onTouchShoot);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('trigger-touch-shoot', onTouchShoot);
    };
  }, [shoot]);

  return (
    <>
      {projectiles.map((p) => (
        <ProjectileEntity key={p.id} projectile={p} />
      ))}
    </>
  );
};

export default ProjectileSystem;
