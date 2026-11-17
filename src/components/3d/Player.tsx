/**
 * Player.tsx
 * Componente R3F del jugador.
 *
 * Responsabilidades:
 *  1. Leer input del joystick táctil (Zustand) y teclado (WASD / flechas).
 *  2. Mover el group del personaje en el plano XZ con velocidad configurable.
 *  3. Rotar suavemente el modelo hacia la dirección del movimiento (Quaternion.slerp).
 *  4. Añadir inclinación (tilt) en el eje X/Z basada en la velocidad lateral/frontal.
 *  5. Cambiar el estado de animación (idle/run) según la magnitud del vector de movimiento.
 *  6. Renderizar <CharacterModel> con el currentAction apropiado.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CharacterModel, AnimAction } from './CharacterModel';
import { useGameStore } from '../../store/useGameStore';

// ─── Constantes de movimiento ─────────────────────────────────────────────────

const MOVE_SPEED = 5.0;          // m/s
const ROTATION_SLERP = 0.12;     // Factor de interpolación de rotación por frame
const TILT_MAX = 0.18;           // Radianes máximos de inclinación
const TILT_LERP = 0.08;          // Suavidad de la inclinación
const ACTION_THRESHOLD = 0.1;    // Magnitud mínima para activar 'run'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PlayerProps {
  position?: [number, number, number];
}

// ─── Objetos reutilizables (zero GC en el loop de animación) ─────────────────

const _moveVec = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();

// ─── Componente ───────────────────────────────────────────────────────────────

export const Player: React.FC<PlayerProps> = ({ position = [0, 0, 0] }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Estado de animación (causa re-render solo cuando cambia entre idle/run)
  const [action, setAction] = useState<AnimAction>('idle');

  // Acceso al store de Zustand (joystick vector táctil)
  const joystickVector = useGameStore((state) => state.joystickVector);

  // ── Teclado: ref en lugar de state para evitar re-renders por frame ──────
  const keysRef = useRef({
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key as keyof typeof keysRef.current;
      if (k in keysRef.current) keysRef.current[k] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key as keyof typeof keysRef.current;
      if (k in keysRef.current) keysRef.current[k] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Loop de física / movimiento ──────────────────────────────────────────
  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Clamp delta para evitar saltos con tab-switching
    const dt = Math.min(delta, 0.05);
    const keys = keysRef.current;

    // ── 1. Construir vector de movimiento normalizado ────────────────────

    let vx = 0;
    let vz = 0;

    // Teclado
    if (keys.w || keys.ArrowUp)    vz -= 1;
    if (keys.s || keys.ArrowDown)  vz += 1;
    if (keys.a || keys.ArrowLeft)  vx -= 1;
    if (keys.d || keys.ArrowRight) vx += 1;

    // Joystick táctil (Zustand) — combina con teclado
    if (joystickVector) {
      vx += joystickVector.x;
      vz += joystickVector.z;
    }

    // Normalizar para evitar velocidad diagonal mayor
    _moveVec.set(vx, 0, vz);
    const magnitude = _moveVec.length();
    if (magnitude > 1) _moveVec.divideScalar(magnitude);

    // ── 2. Mover la posición ─────────────────────────────────────────────
    group.position.x += _moveVec.x * MOVE_SPEED * dt;
    group.position.z += _moveVec.z * MOVE_SPEED * dt;

    // ── 3. Rotación: Quaternion.slerp hacia la dirección del movimiento ──
    if (magnitude > ACTION_THRESHOLD) {
      _euler.set(0, Math.atan2(_moveVec.x, _moveVec.z), 0);
      _targetQuat.setFromEuler(_euler);
      group.quaternion.slerp(_targetQuat, ROTATION_SLERP);
    }

    // ── 4. Tilt (inclinación) basado en la velocidad lateral y frontal ───
    const targetTiltX = -_moveVec.z * TILT_MAX;   // inclinación frontal/trasera
    const targetTiltZ = -_moveVec.x * TILT_MAX;   // inclinación lateral

    // Lerp suave aplicado sobre la rotación local del group
    group.rotation.x += (targetTiltX - group.rotation.x) * TILT_LERP;
    group.rotation.z += (targetTiltZ - group.rotation.z) * TILT_LERP;

    // ── 5. Cambio de estado de animación ─────────────────────────────────
    const isMoving = magnitude > ACTION_THRESHOLD;
    setAction((prev) => {
      const next: AnimAction = isMoving ? 'run' : 'idle';
      return prev !== next ? next : prev;
    });
  });

  return (
    <group ref={groupRef} position={position} name="PlayerGroup">
      <CharacterModel currentAction={action} />
    </group>
  );
};

export default Player;
