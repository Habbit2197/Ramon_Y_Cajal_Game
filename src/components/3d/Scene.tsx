/**
 * Scene.tsx
 * Escena R3F principal del juego Cajal.
 *
 * Pipeline declarativo:
 *  - Iluminación PBR (ambient + directional con sombras)
 *  - <Player> con CharacterModel animado
 *  - Suelo PBR procedural
 *  - ContactShadows suaves
 *  - OrbitControls (dev) + seguimiento de cámara
 */

import React, { useMemo } from 'react';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { useGameStore } from '../../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../../shaders/FatigueShader';
import { Player } from './Player';

// ─── Spec exportada (referencia arquitectural para el GDD) ────────────────────

export const R3F_SCENE_SOURCE = `
Scene → <ambientLight> + <directionalLight castShadow>
      → <Environment preset="sunset" />
      → <Player position={[0,0,0]} />  (CharacterModel + Blend Tree idle/run)
      → <mesh> suelo PBR 50x50
      → <ContactShadows>
      → <OrbitControls>
      → EffectComposer → CognitiveFatigueEffect (uDesaturation ∝ 1 - brainPower/100)
`;

// ─── Componente ───────────────────────────────────────────────────────────────

export const Scene: React.FC = () => {
  const brainPower = useGameStore((state) => state.brainPower);
  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  return (
    <group name="R3FSceneRoot" userData={{ uDesaturation, shader: FATIGUE_FRAGMENT_SHADER }}>
      {/* Iluminación base */}
      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        position={[8, 15, 10]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048] as [number, number]}
      />

      {/* Iluminación HDRI para reflejos PBR */}
      <Environment preset="sunset" background={false} />

      {/* Personaje Principal con animaciones Idle/Run */}
      <Player position={[0, 0, 0]} />

      {/* Suelo PBR */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshPhysicalMaterial
          color="#1e293b"
          roughness={0.65}
          metalness={0.1}
          clearcoat={0.2}
        />
      </mesh>

      {/* Sombras de contacto suaves */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.65}
        scale={14}
        blur={2.2}
        far={4.5}
      />

      {/* Controles de cámara (desactivar en producción si se usa cámara de seguimiento) */}
      <OrbitControls
        makeDefault
        enablePan={false}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </group>
  );
};

export default Scene;
