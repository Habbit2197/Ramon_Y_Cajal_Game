/**
 * Scene.tsx — Escena R3F del Agile Shooter Cajal
 *
 * Arquitectura:
 * - Renderizado condicional: (Player, ProjectileSystem, EnemySystem) solo se activan si gameState === 'playing'.
 * - En 'menu', renderiza únicamente el entorno de fondo (Arena, Luces, Sombras) visible detrás de la UI.
 * - Sin dependencias externas de red (sin Environment HDR) para evitar pantallazos negros.
 */

import React from 'react';
import { Physics } from '@react-three/rapier';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Player } from './Player';
import { ProjectileSystem } from './ProjectileSystem';
import { EnemySystem } from './EnemySystem';
import { useGameStore } from '../../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../../shaders/FatigueShader';

export const R3F_SCENE_SOURCE = 'Agile Shooter: Physics<Player+Projectiles+Enemies> / no gravity';

// ─── Arena (suelo hexagonal y límites de la red) ─────────────────────────────

const Arena: React.FC = () => (
  <>
    {/* Suelo principal */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[32, 24]} />
      <meshStandardMaterial
        color="#080d19"
        roughness={0.75}
        metalness={0.25}
        emissive="#00142e"
        emissiveIntensity={0.5}
      />
    </mesh>

    {/* Grid decorativo sináptico */}
    <gridHelper args={[32, 24, '#2563eb', '#0d2346']} position={[0, 0.01, 0]} />

    {/* Bordes del arena luminiscentes */}
    {[-16, 16].map((x) => (
      <mesh key={`wall-x-${x}`} position={[x, 0.5, 0]}>
        <boxGeometry args={[0.2, 1, 24]} />
        <meshStandardMaterial color="#1e40af" emissive="#00ffff" emissiveIntensity={0.8} />
      </mesh>
    ))}
    {[-12, 12].map((z) => (
      <mesh key={`wall-z-${z}`} position={[0, 0.5, z]}>
        <boxGeometry args={[32, 1, 0.2]} />
        <meshStandardMaterial color="#1e40af" emissive="#00ffff" emissiveIntensity={0.8} />
      </mesh>
    ))}
  </>
);

// ─── Luces de la escena (100% locales sin descargas remotas) ─────────────────

const Lights: React.FC = () => (
  <>
    <ambientLight intensity={0.5} color="#1e293b" />
    <directionalLight
      castShadow
      position={[6, 14, 8]}
      intensity={1.4}
      color="#ffffff"
      shadow-mapSize={[1024, 1024]}
    />
    {/* Luces de acento de colores */}
    <pointLight position={[-12, 4, -8]} color="#00ffff" intensity={2.5} distance={20} />
    <pointLight position={[12, 4, 8]}   color="#f59e0b" intensity={2.5} distance={20} />
  </>
);

// ─── Escena completa ──────────────────────────────────────────────────────────

export const Scene: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const brainPower = useGameStore((s) => s.brainPower);
  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  return (
    <group name="R3FSceneRoot" userData={{ uDesaturation, shader: FATIGUE_FRAGMENT_SHADER }}>
      <Lights />

      {/* 
        REQUISITO FASE 3: El motor de físicas y las entidades interactivas 
        (Player, Projectiles, Enemies) SOLO se montan si gameState === 'playing'.
      */}
      {gameState === 'playing' && (
        <Physics gravity={[0, 0, 0]}>
          <Player position={[0, 0.5, 0]} />
          <ProjectileSystem />
          <EnemySystem />
        </Physics>
      )}

      {/* Arena estática y entorno de fondo: siempre visible, incluso en 'menu' */}
      <Arena />

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={22}
        blur={2}
        far={3}
      />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        minDistance={8}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.5}
        enablePan={false}
      />
    </group>
  );
};

export default Scene;
