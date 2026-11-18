/**
 * Player.tsx — Núcleo Neuronal con RigidBody Rapier
 *
 * Aspecto visual: Núcleo Neuronal con icosahedronGeometry wireframe cian
 * Físicas: RigidBody kinematicPositionBased con colliders="ball"
 * Input: WASD + joystickVector (Zustand)
 * Movimiento: ref.current.setNextKinematicTranslation()
 */

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

// Constantes
const MOVE_SPEED = 6.0;
const BOUNDS = { x: 12, z: 10 };
const ACTION_THRESHOLD = 0.05;

// Scratch zero-GC
const _moveVec = new THREE.Vector3();

export interface PlayerProps {
  position?: [number, number, number];
}

export const Player: React.FC<PlayerProps> = ({ position = [0, 0.5, 0] }) => {
  const ref = useRef<RapierRigidBody>(null);
  const meshGroupRef = useRef<THREE.Group>(null);

  // Estado interno en refs para evitar re-renders innecesarios en el loop de 60fps
  const posRef = useRef(new THREE.Vector3(...position));
  const facingRef = useRef(new THREE.Vector3(0, 0, -1));

  // Zustand
  const joystickVector = useGameStore((s) => s.joystickVector);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);

  // Teclado
  const keysRef = useRef<Record<string, boolean>>({
    w: false, W: false, ArrowUp: false,
    s: false, S: false, ArrowDown: false,
    a: false, A: false, ArrowLeft: false,
    d: false, D: false, ArrowRight: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key in keysRef.current) {
        keysRef.current[e.key] = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key in keysRef.current) {
        keysRef.current[e.key] = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((_state, delta) => {
    if (!ref.current) return;

    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;

    // ── 1. Lectura del movimiento (WASD o joystickVector de Zustand) ─────
    let vx = 0;
    let vz = 0;
    if (keys['w'] || keys['W'] || keys['ArrowUp'])    vz -= 1;
    if (keys['s'] || keys['S'] || keys['ArrowDown'])  vz += 1;
    if (keys['a'] || keys['A'] || keys['ArrowLeft'])  vx -= 1;
    if (keys['d'] || keys['D'] || keys['ArrowRight']) vx += 1;

    // Sumar vector del joystick táctil de Zustand
    vx += joystickVector.x;
    vz += joystickVector.z;

    _moveVec.set(vx, 0, vz);
    const mag = _moveVec.length();
    if (mag > 1) {
      _moveVec.divideScalar(mag);
    }

    if (mag > ACTION_THRESHOLD) {
      facingRef.current.copy(_moveVec).normalize();
    }

    // ── 2. Calcular nueva posición delimitada en la arena ────────────────
    posRef.current.x = THREE.MathUtils.clamp(
      posRef.current.x + _moveVec.x * MOVE_SPEED * dt,
      -BOUNDS.x,
      BOUNDS.x
    );
    posRef.current.z = THREE.MathUtils.clamp(
      posRef.current.z + _moveVec.z * MOVE_SPEED * dt,
      -BOUNDS.z,
      BOUNDS.z
    );

    // ── 3. Actualizar la posición kinematic usando ref.current ──────────
    ref.current.setNextKinematicTranslation({
      x: posRef.current.x,
      y: posRef.current.y,
      z: posRef.current.z,
    });

    // Sincronizar posición con Zustand para el sistema de proyectiles y enemigos
    setPlayerPosition([posRef.current.x, posRef.current.y, posRef.current.z]);

    // ── 4. Rotación y pulsación sutil del Núcleo Neuronal ────────────────
    if (meshGroupRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.05;
      meshGroupRef.current.scale.setScalar(pulse);
      meshGroupRef.current.rotation.y += dt * 1.5;
      meshGroupRef.current.rotation.x += (-_moveVec.z * 0.2 - meshGroupRef.current.rotation.x) * 0.1;
      meshGroupRef.current.rotation.z += (-_moveVec.x * 0.2 - meshGroupRef.current.rotation.z) * 0.1;
    }
  });

  return (
    <RigidBody
      ref={ref}
      type="kinematicPositionBased"
      colliders="ball"
      position={position}
      name="player-body"
    >
      <group ref={meshGroupRef} name="PlayerNucleus">
        {/* Núcleo Neuronal */}
        <mesh>
          <icosahedronGeometry args={[0.5, 2]} />
          <meshStandardMaterial
            emissive="#00ffff"
            emissiveIntensity={2}
            color="#ffffff"
            wireframe
          />
        </mesh>

        {/* Punto de luz puntual emisivo para iluminar la escena */}
        <pointLight color="#00ffff" intensity={3} distance={6} decay={2} />
      </group>
    </RigidBody>
  );
};

export default Player;
