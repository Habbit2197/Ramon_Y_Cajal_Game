import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../../shaders/FatigueShader';
import { Player } from './Player';

/**
 * Especificación declarativa de la escena R3F (`<Scene />`):
 * - Iluminación base (`ambientLight` + `directionalLight` con sombras)
 * - `<Environment preset="sunset" />` de `@react-three/drei` para reflejos PBR
 * - Suelo con `<ContactShadows />` suaves bajo el jugador
 * - `<Player />` con `meshPhysicalMaterial`
 * - `<EffectComposer>` aplicando `FATIGUE_FRAGMENT_SHADER` con `uDesaturation = 1 - brainPower / 100`
 */
export const R3F_SCENE_SOURCE = `import React, { useMemo } from 'react';
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { useGameStore } from '../../store/useGameStore';
import { FATIGUE_FRAGMENT_SHADER } from '../../shaders/FatigueShader';
import { Player } from './Player';

class CognitiveFatigueEffectImpl extends Effect {
  constructor(desaturation = 0.5) {
    super('CognitiveFatigueEffect', FATIGUE_FRAGMENT_SHADER, {
      uniforms: new Map([['uDesaturation', new Uniform(desaturation)]]),
    });
  }
}

export const Scene: React.FC = () => {
  const brainPower = useGameStore((state) => state.brainPower);
  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  const fatigueEffect = useMemo(() => new CognitiveFatigueEffectImpl(uDesaturation), []);
  fatigueEffect.uniforms.get('uDesaturation')!.value = uDesaturation;

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        position={[8, 15, 10]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
      />

      {/* Iluminación HDRI Basada en Imágenes para reflejos PBR */}
      <Environment preset="sunset" background={false} />

      {/* Personaje Principal con MeshPhysicalMaterial */}
      <Player position={[0, 1.1, 0]} />

      {/* Suelo PBR y Sombras de Contacto suaves */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshPhysicalMaterial color="#1e293b" roughness={0.65} metalness={0.1} clearcoat={0.2} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.65} scale={14} blur={2.2} far={4.5} />

      <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2 - 0.05} />

      {/* Post-procesado GLSL vinculado a brainPower en Zustand */}
      <EffectComposer>
        <primitive object={fatigueEffect} />
      </EffectComposer>
    </>
  );
};`;

export const Scene: React.FC = () => {
  const brainPower = useGameStore((state) => state.brainPower);
  const uDesaturation = Math.max(0, Math.min(1, 1 - brainPower / 100));

  return (
    <group name="R3FSceneRoot" userData={{ uDesaturation, shader: FATIGUE_FRAGMENT_SHADER }}>
      <ambientLight intensity={0.45} />
      <directionalLight castShadow position={[8, 15, 10]} intensity={1.6} />
      <Player position={[0, 1.1, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshPhysicalMaterial color="#1e293b" roughness={0.65} metalness={0.1} clearcoat={0.2} />
      </mesh>
    </group>
  );
};

export default Scene;
