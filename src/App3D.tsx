/**
 * App3D.tsx — Raíz única del Canvas 3D en React Three Fiber y físicas Rapier
 *
 * Implementa el presupuesto gráfico adaptativo por Tier (low, mid, high),
 * monitoreo de performance en caliente con drei y pipeline HDR completo.
 */

import { useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';

import { STEP } from './engine/clock';
import { world } from './engine/world';
import { GameLoop } from './engine/GameLoop';
import { Arena } from './components/3d/Arena';
import { PlayerBody } from './components/3d/Player';
import { EnemyPool } from './components/3d/EnemyPool';
import { TissueFloor } from './components/3d/TissueFloor';
import { NeuralNetwork } from './components/3d/NeuralNetwork';
import { Vesicles } from './components/3d/Vesicles';
import { ProjectileRenderer } from './components/3d/ProjectileRenderer';
import { OrbRenderer } from './components/3d/OrbRenderer';
import { BurstRenderer } from './components/3d/BurstRenderer';
import { ShockwaveRenderer } from './components/3d/ShockwaveRenderer';
import { DendriteRenderer } from './components/3d/DendriteRenderer';
import { TelegraphRenderer } from './components/3d/TelegraphRenderer';
import { CameraRig } from './components/3d/CameraRig';
import { PostFX } from './components/3d/PostFX';
import { type EnemyKind } from './game/enemies/pool';

export type Tier = 'low' | 'mid' | 'high';

export const TIER_CONFIG = {
  low: { dpr: 1.0, maxEnemies: 40, vesicles: 400 },
  mid: { dpr: 1.5, maxEnemies: 90, vesicles: 900 },
  high: { dpr: 2.0, maxEnemies: 160, vesicles: 1500 },
};

function detectInitialTier(): Tier {
  if (typeof window === 'undefined') return 'mid';
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile || cores <= 4) return 'low';
  if (cores >= 8) return 'high';
  return 'mid';
}

function lowerTier(current: Tier): Tier {
  if (current === 'high') return 'mid';
  return 'low';
}

export function App3D() {
  const [tier, setTier] = useState<Tier>(detectInitialTier);

  useEffect(() => {
    world.tier = tier;
    world.maxEnemies = TIER_CONFIG[tier].maxEnemies;
  }, [tier]);

  const enemyPools = useMemo(
    () => [
      {
        kind: 'swarmer' as EnemyKind,
        geometry: new THREE.IcosahedronGeometry(0.28, 1),
        material: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 1.8), toneMapped: false }),
        size: { low: 48, mid: 96, high: 160 },
      },
      {
        kind: 'tank0' as EnemyKind,
        geometry: new THREE.DodecahedronGeometry(0.9, 0),
        material: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 1.8, 0.4), toneMapped: false }),
        size: { low: 4, mid: 8, high: 16 },
      },
      {
        kind: 'tank1' as EnemyKind,
        geometry: new THREE.DodecahedronGeometry(0.63, 0),
        material: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.6, 0.4), toneMapped: false }),
        size: { low: 8, mid: 16, high: 32 },
      },
      {
        kind: 'tank2' as EnemyKind,
        geometry: new THREE.DodecahedronGeometry(0.44, 0),
        material: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.4), toneMapped: false }),
        size: { low: 16, mid: 32, high: 64 },
      },
      {
        kind: 'homing' as EnemyKind,
        geometry: new THREE.BoxGeometry(0.55, 0.55, 0.55),
        material: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.3), toneMapped: false }),
        size: { low: 12, mid: 18, high: 24 },
      },
    ],
    []
  );

  return (
    <Canvas
      flat
      dpr={TIER_CONFIG[tier].dpr}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      camera={{ fov: 46, near: 0.5, far: 120 }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#03050c' }}
    >
      <PerformanceMonitor
        flipflops={1}
        onDecline={() => setTier((t) => lowerTier(t))}
      />

      {/* Físicas Rapier en pausa, avanzadas manualmente en GameLoop a paso fijo */}
      <Physics paused timeStep={STEP} numSolverIterations={2}>
        <GameLoop />
        <Arena />
        <PlayerBody />
        {enemyPools.map((p) => (
          <EnemyPool
            key={p.kind}
            kind={p.kind}
            geometry={p.geometry}
            material={p.material}
            size={p.size[tier]}
          />
        ))}
      </Physics>

      {/* Capas de entorno bio-luminiscente */}
      <TissueFloor tier={tier} />
      <NeuralNetwork />
      <Vesicles count={TIER_CONFIG[tier].vesicles} />

      {/* Renderizadores SoA e InstancedMesh (1 Draw Call cada uno) */}
      <ProjectileRenderer />
      <OrbRenderer />
      <BurstRenderer />
      <ShockwaveRenderer />
      <DendriteRenderer />
      <TelegraphRenderer />

      {/* Rig de Cámara y Post-Procesado HDR */}
      <CameraRig />
      <PostFX tier={tier} />
    </Canvas>
  );
}

export default App3D;
