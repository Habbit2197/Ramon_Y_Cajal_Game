/**
 * Player.tsx — Núcleo Neuronal cinemático con física Rapier
 *
 * ARQUITECTURA TDD:
 * - Avatar: Núcleo Neuronal icosaédrico con radiance HDR cian [1, 4, 5] (Bloom selectivo sin pointLights).
 * - Físicas: RigidBody kinematicPosition con colliders="ball".
 * - Movimiento: Conducción saltatoria con dash, i-frames de mielina y deriva de alcohol.
 * - Sincronización: Escribe directamente en `world.player` (zero GC, ZERO llamadas a Zustand a 60 Hz).
 */

import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { world } from '../../engine/world';
import { tryDash } from '../../game/dash';

const BOUNDS = { x: 13.5, z: 9.5 };
const _raycaster = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _intersect = new THREE.Vector3();
const _mouse = new THREE.Vector2();

export interface PlayerProps {
  position?: [number, number, number];
}

export function PlayerBody({ position = [0, 0.5, 0] }: PlayerProps = {}) {
  const ref = useRef<RapierRigidBody>(null);
  const nucleusRef = useRef<THREE.Group>(null);
  const myelinSheathRef = useRef<THREE.Mesh>(null);
  const shieldMeshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        const threat = world.grid.anyThreatWithin(world.player.x, world.player.z, 3.5, () => true);
        tryDash(
          {
            x: world.player.x,
            z: world.player.z,
            dirX: world.player.dirX,
            dirZ: world.player.dirZ,
            baseSpeed: world.player.baseSpeed,
            dashCooldown: world.player.dashCooldown,
            dashActiveTimer: world.player.dashActiveTimer,
            invulnerableTimer: world.player.invulnerableTimer,
            mods: world.player.mods,
          },
          threat,
          world.ranvierNodes
        );
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      _mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      _mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      _raycaster.setFromCamera(_mouse, camera);
      if (_raycaster.ray.intersectPlane(_plane, _intersect)) {
        const dx = _intersect.x - world.player.x;
        const dz = _intersect.z - world.player.z;
        const len = Math.hypot(dx, dz) || 1;
        world.player.aimX = dx / len;
        world.player.aimZ = dz / len;
      }
    };

    const handleTouchShoot = () => {
      // Disparo táctil gestionado en el bucle caliente de armas
    };

    const handleTouchDash = () => {
      const threat = world.grid.anyThreatWithin(world.player.x, world.player.z, 3.5, () => true);
      tryDash(
        {
          x: world.player.x,
          z: world.player.z,
          dirX: world.player.dirX,
          dirZ: world.player.dirZ,
          baseSpeed: world.player.baseSpeed,
          dashCooldown: world.player.dashCooldown,
          dashActiveTimer: world.player.dashActiveTimer,
          invulnerableTimer: world.player.invulnerableTimer,
          mods: world.player.mods,
        },
        threat,
        world.ranvierNodes
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('trigger-touch-shoot', handleTouchShoot);
    window.addEventListener('trigger-touch-dash', handleTouchDash);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('trigger-touch-shoot', handleTouchShoot);
      window.removeEventListener('trigger-touch-dash', handleTouchDash);
    };
  }, [camera]);

  useFrame((st, dt) => {
    if (!ref.current) return;
    const p = world.player;
    const k = keys.current;

    // 1. Lectura del input de dirección
    let inX = 0;
    let inZ = 0;
    if (k['KeyW'] || k['ArrowUp']) inZ -= 1;
    if (k['KeyS'] || k['ArrowDown']) inZ += 1;
    if (k['KeyA'] || k['ArrowLeft']) inX -= 1;
    if (k['KeyD'] || k['ArrowRight']) inX += 1;

    const len = Math.hypot(inX, inZ);
    if (len > 0) {
      p.dirX = inX / len;
      p.dirZ = inZ / len;
    }

    // 2. Velocidad con modificadores, dash y debuffs educativos
    let currentSpeed = p.baseSpeed * p.mods.speedMult;
    if (p.dashActiveTimer > 0) {
      currentSpeed *= 3.2; // Multiplicador de dash
    }
    if (p.smokeSlowTimer > 0) {
      currentSpeed *= 0.65; // Debuff de humo/tabaco
    }

    const targetVx = len > 0 ? p.dirX * currentSpeed : 0;
    const targetVz = len > 0 ? p.dirZ * currentSpeed : 0;

    // Inercia (deriva por alcohol): el cerebelo pierde control de frenado inmediato
    const lerpRate = p.inertiaDrag > 0 ? 3.0 : 18.0;
    p.vx = THREE.MathUtils.damp(p.vx, targetVx, lerpRate, dt);
    p.vz = THREE.MathUtils.damp(p.vz, targetVz, lerpRate, dt);

    // 3. Integración de posición y límites de la arena
    p.x = THREE.MathUtils.clamp(p.x + p.vx * dt, -BOUNDS.x, BOUNDS.x);
    p.z = THREE.MathUtils.clamp(p.z + p.vz * dt, -BOUNDS.z, BOUNDS.z);

    ref.current.setNextKinematicTranslation({ x: p.x, y: 0.5, z: p.z });

    // 4. Timers de dash, invulnerabilidad e inercia
    if (p.dashActiveTimer > 0) p.dashActiveTimer = Math.max(0, p.dashActiveTimer - dt);
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dt);
    if (p.inertiaDrag > 0) p.inertiaDrag = Math.max(0, p.inertiaDrag - dt);
    if (p.smokeSlowTimer > 0) p.smokeSlowTimer = Math.max(0, p.smokeSlowTimer - dt);

    // 5. Animación del núcleo neuronal
    if (nucleusRef.current) {
      const pulse = 1.0 + Math.sin(st.clock.elapsedTime * 4.0) * 0.06;
      nucleusRef.current.scale.set(pulse, pulse, pulse);
      nucleusRef.current.rotation.y += dt * 1.8;
      nucleusRef.current.rotation.x = -p.vz * 0.05;
      nucleusRef.current.rotation.z = -p.vx * 0.05;
    }

    // 6. Visualización de la vaina de mielina (i-frames de dash)
    if (myelinSheathRef.current) {
      myelinSheathRef.current.visible = p.invulnerableTimer > 0;
      if (myelinSheathRef.current.visible) {
        myelinSheathRef.current.rotation.y += dt * 3.5;
      }
    }

    // 7. Escudo glial
    if (shieldMeshRef.current) {
      shieldMeshRef.current.visible = p.shieldActive;
    }
  });

  return (
    <RigidBody
      ref={ref}
      type="kinematicPosition"
      colliders="ball"
      position={[0, 0.5, 0]}
      name="player-body"
      enabledTranslations={[true, false, true]}
      lockRotations
    >
      <group ref={nucleusRef} name="PlayerNucleus">
        {/* Núcleo Neuronal en Icosaedro HDR wireframe (Bloom selectivo) */}
        <mesh>
          <icosahedronGeometry args={[0.5, 2]} />
          <meshBasicMaterial
            color={[0.8, 3.2, 4.5]}
            wireframe
            toneMapped={false}
          />
        </mesh>

        {/* Centro del soma neuronal */}
        <mesh scale={0.4}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={[1.2, 4.0, 5.0]}
            toneMapped={false}
          />
        </mesh>

        {/* Vaina de Mielina: halo protector blanco durante invulnerabilidad */}
        <mesh ref={myelinSheathRef} scale={1.35} visible={false}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={[4.0, 4.0, 5.0]}
            transparent
            opacity={0.4}
            wireframe
            toneMapped={false}
          />
        </mesh>

        {/* Escudo Glial astrocítico */}
        <mesh ref={shieldMeshRef} scale={1.6} visible={false}>
          <ringGeometry args={[0.5, 0.6, 24]} />
          <meshBasicMaterial
            color={[0.5, 3.5, 1.2]}
            transparent
            opacity={0.65}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}

export { PlayerBody as Player };
export default PlayerBody;
