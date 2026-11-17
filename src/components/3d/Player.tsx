import React from 'react';
import { useGameStore } from '../../store/useGameStore';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: Record<string, unknown>;
      mesh: Record<string, unknown>;
      capsuleGeometry: Record<string, unknown>;
      planeGeometry: Record<string, unknown>;
      meshPhysicalMaterial: Record<string, unknown>;
      ambientLight: Record<string, unknown>;
      directionalLight: Record<string, unknown>;
      primitive: Record<string, unknown>;
    }
  }
}

/**
 * Componente funcional R3F que representa al niño protagonista mediante una cápsula PBR
 * (`meshPhysicalMaterial`) cuya emisión sináptica responde al estado `brainPower`.
 *
 * Nota: En el pipeline R3F se monta dentro de `<Canvas><Scene /></Canvas>`.
 */
export interface PlayerProps {
  position?: [number, number, number];
}

export const Player: React.FC<PlayerProps> = ({ position = [0, 1.1, 0] }) => {
  const brainPower = useGameStore((state) => state.brainPower);
  const normalizedPower = brainPower / 100;

  return (
    <group position={position} name="PlayerStudentCapsule">
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.45, 1.1, 16, 32]} />
        <meshPhysicalMaterial
          color="#2563eb"
          roughness={0.28}
          metalness={0.08}
          clearcoat={0.75}
          clearcoatRoughness={0.18}
          reflectivity={0.9}
          emissive="#ffd166"
          emissiveIntensity={0.12 + normalizedPower * 0.45}
        />
      </mesh>
    </group>
  );
};

export default Player;
