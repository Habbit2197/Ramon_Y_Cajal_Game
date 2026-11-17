/**
 * Player.tsx — Núcleo Neuronal con RigidBody Rapier
 * 
 * Visual: Icosaedro wireframe cian + esfera interior emisiva
 * Físicas: RigidBody kinematicPositionBased (Rapier)
 * Input: WASD + joystickVector (Zustand) + Espacio para dash
 * Trail: <Trail> de @react-three/drei cuando se mueve rápido
 */

import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/useGameStore';

// Constantes
const MOVE_SPEED = 6.0;
const DASH_SPEED = 18.0;
const DASH_DURATION = 0.18;    // segundos que dura el dash
const DASH_COOLDOWN = 2.0;     // segundos de cooldown
const BOUNDS = { x: 12, z: 10 }; // límites del arena
const ACTION_THRESHOLD = 0.05;

// Reutilizables zero-GC
const _moveVec = new THREE.Vector3();

export interface PlayerProps {
  position?: [number, number, number];
}

export const Player: React.FC<PlayerProps> = ({ position = [0, 0.5, 0] }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const meshGroupRef = useRef<THREE.Group>(null);
  
  // Estado interno (refs para evitar re-renders en el game loop)
  const posRef = useRef(new THREE.Vector3(...position));
  const dashTimerRef = useRef(0);        // tiempo restante del dash activo
  const dashCooldownRef = useRef(0);     // cooldown restante
  const dashDirRef = useRef(new THREE.Vector3());
  const facingRef = useRef(new THREE.Vector3(0, 0, -1));
  
  // Zustand
  const joystickVector = useGameStore((s) => s.joystickVector);
  const setPlayerPosition = useGameStore((s) => s.setPlayerPosition);
  const addProjectile = useGameStore((s) => s.addProjectile);
  const inFlowState = useGameStore((s) => s.inFlowState);

  // Teclado (ref para evitar re-renders)
  const keysRef = useRef<Record<string, boolean>>({
    w: false, a: false, s: false, d: false,
    ' ': false,  // disparo/dash
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  });
  
  // Ref para detectar flanco de subida de SPACE (shoot on press, not hold)
  const spacePrevRef = useRef(false);

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
    const rb = rigidBodyRef.current;
    const meshGroup = meshGroupRef.current;
    if (!rb) return;

    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;

    // ── 1. Vector de movimiento ─────────────────────────────────────────
    let vx = 0, vz = 0;
    if (keys['w'] || keys['ArrowUp'])    vz -= 1;
    if (keys['s'] || keys['ArrowDown'])  vz += 1;
    if (keys['a'] || keys['ArrowLeft'])  vx -= 1;
    if (keys['d'] || keys['ArrowRight']) vx += 1;
    vx += joystickVector.x;
    vz += joystickVector.z;

    _moveVec.set(vx, 0, vz);
    const mag = _moveVec.length();
    if (mag > 1) _moveVec.divideScalar(mag);
    
    // Guardar la última dirección de cara
    if (mag > ACTION_THRESHOLD) {
      facingRef.current.copy(_moveVec).normalize();
    }

    // ── 2. Dash ─────────────────────────────────────────────────────────
    dashCooldownRef.current = Math.max(0, dashCooldownRef.current - dt);
    dashTimerRef.current = Math.max(0, dashTimerRef.current - dt);

    const spaceNow = keys[' '];
    if (spaceNow && !spacePrevRef.current && dashCooldownRef.current <= 0) {
      // Iniciar dash en la dirección actual de movimiento (o facing)
      const dashDir = mag > ACTION_THRESHOLD ? _moveVec.clone() : facingRef.current.clone();
      dashDirRef.current.copy(dashDir.normalize());
      dashTimerRef.current = DASH_DURATION;
      dashCooldownRef.current = DASH_COOLDOWN;
    }
    spacePrevRef.current = spaceNow;

    // ── 3. Mover posición ───────────────────────────────────────────────
    const isDashing = dashTimerRef.current > 0;
    const speed = isDashing ? DASH_SPEED : MOVE_SPEED;
    const moveDir = isDashing ? dashDirRef.current : _moveVec;

    posRef.current.x = THREE.MathUtils.clamp(
      posRef.current.x + moveDir.x * speed * dt, -BOUNDS.x, BOUNDS.x
    );
    posRef.current.z = THREE.MathUtils.clamp(
      posRef.current.z + moveDir.z * speed * dt, -BOUNDS.z, BOUNDS.z
    );

    rb.setNextKinematicTranslation({
      x: posRef.current.x,
      y: posRef.current.y,
      z: posRef.current.z,
    });

    // Actualizar posición en el store (para que ProjectileSystem sepa dónde disparar)
    setPlayerPosition([posRef.current.x, posRef.current.y, posRef.current.z]);

    // ── 4. Rotación visual del mesh ──────────────────────────────────────
    if (meshGroup) {
      // Pulsar (escala) el icosaedro
      const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.06;
      meshGroup.scale.setScalar(pulse);
      
      // Inclinación dinámica al moverse
      meshGroup.rotation.x += (-_moveVec.z * 0.25 - meshGroup.rotation.x) * 0.1;
      meshGroup.rotation.z += (-_moveVec.x * 0.25 - meshGroup.rotation.z) * 0.1;
      
      // Spin lento constante (núcleo neuronal orbitando)
      meshGroup.rotation.y += dt * (isDashing ? 8 : 1.5);
    }
  });

  // Suppress unused warning — addProjectile is available for future use
  void addProjectile;

  // Color reactivo al flow state
  const coreColor = inFlowState ? '#ff00ff' : '#00ffff';
  const emissiveColor = inFlowState ? '#ff00ff' : '#00ffff';

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders="ball"
      position={position}
      name="player-body"
    >
      <Trail
        width={inFlowState ? 2.5 : 1.2}
        length={8}
        color={emissiveColor}
        attenuation={(t) => t * t}
        local={false}
      >
        <group ref={meshGroupRef} name="PlayerNucleus">
          {/* Capa exterior: icosaedro wireframe */}
          <mesh>
            <icosahedronGeometry args={[0.52, 2]} />
            <meshStandardMaterial
              color={coreColor}
              emissive={emissiveColor}
              emissiveIntensity={inFlowState ? 3 : 2}
              wireframe
              transparent
              opacity={0.85}
            />
          </mesh>

          {/* Núcleo interior: esfera sólida emisiva */}
          <mesh>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshPhysicalMaterial
              color="#ffffff"
              emissive={emissiveColor}
              emissiveIntensity={inFlowState ? 5 : 3}
              roughness={0}
              metalness={0.1}
              transmission={0.6}
              thickness={0.5}
            />
          </mesh>

          {/* Point light del núcleo para iluminar el entorno */}
          <pointLight
            color={emissiveColor}
            intensity={inFlowState ? 8 : 4}
            distance={5}
            decay={2}
          />
        </group>
      </Trail>
    </RigidBody>
  );
};

export default Player;
