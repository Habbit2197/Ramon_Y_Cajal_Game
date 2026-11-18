/**
 * Scene.tsx — Escena R3F del Agile Shooter Cajal
 *
 * Arquitectura:
 *   <Canvas> (en Canvas3D o App)
 *     <Physics gravity={[0,0,0]}>   ← sin gravedad (top-down)
 *       <Player />
 *       <ProjectileSystem />
 *       <EnemySystem />
 *       <Arena />
 *     </Physics>
 *     <Lights />
 *     <Effects />
 */

import React from 'react';
import { Physics } from '@react-three/rapier';
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { Player } from './Player';
import { ProjectileSystem } from './ProjectileSystem';
import { EnemySystem } from './EnemySystem';
import { useGameStore } from '../../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../../shaders/FatigueShader';

export const R3F_SCENE_SOURCE = 'Agile Shooter: Physics<Player+Projectiles+Enemies> / no gravity';

// ─── Arena (suelo hexagonal estilizado) ──────────────────────────────────────

const Arena: React.FC = () => (
  <>
    {/* Suelo principal */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 22]} />
      <meshStandardMaterial
        color="#0a0f1a"
        roughness={0.8}
        metalness={0.3}
        emissive="#001133"
        emissiveIntensity={0.4}
      />
    </mesh>

    {/* Grid decorativo */}
    <gridHelper args={[30, 22, '#1e3a5f', '#0d2040']} position={[0, 0.01, 0]} />

    {/* Bordes del arena */}
    {[-15, 15].map((x) => (
      <mesh key={`wall-x-${x}`} position={[x, 0.5, 0]}>
        <boxGeometry args={[0.2, 1, 22]} />
        <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={1} />
      </mesh>
    ))}
    {[-11, 11].map((z) => (
      <mesh key={`wall-z-${z}`} position={[0, 0.5, z]}>
        <boxGeometry args={[30, 1, 0.2]} />
        <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={1} />
      </mesh>
    ))}
  </>
);

// ─── Luces de la escena ───────────────────────────────────────────────────────

const Lights: React.FC = () => (
  <>
    <ambientLight intensity={0.3} color="#1a2a4a" />
    <directionalLight
      castShadow
      position={[5, 12, 8]}
      intensity={1.2}
      color="#ffffff"
      shadow-mapSize={[1024, 1024]}
    />
    {/* Luces de acento de colores para el feel de sci-fi */}
    <pointLight position={[-10, 3, -8]} color="#0033ff" intensity={3} distance={15} />
    <pointLight position={[10, 3, 8]}  color="#00ffaa" intensity={3} distance={15} />
  </>
);

// ─── Escena completa ──────────────────────────────────────────────────────────

export const Scene: React.FC = () => {
  const brainPower = useGameStore((s) => s.brainPower);
  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  return (
    <group name="R3FSceneRoot" userData={{ uDesaturation, shader: FATIGUE_FRAGMENT_SHADER }}>
      <Lights />
      <Environment preset="night" background={false} />

      {/* Motor de físicas sin gravedad (top-down shooter) */}
      <Physics gravity={[0, 0, 0]}>
        <Player position={[0, 0.5, 0]} />
        <ProjectileSystem />
        <EnemySystem />
      </Physics>

      {/* Arena estática (no necesita físicas) */}
      <Arena />

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={20}
        blur={2}
        far={3}
      />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        minDistance={8}
        maxDistance={22}
        maxPolarAngle={Math.PI / 2.5}
        enablePan={false}
      />
    </group>
  );
};

export default Scene;
