/**
 * PostFX.tsx — Pipeline de post-procesamiento con @react-three/postprocessing
 *
 * Configuración HDR Bloom (threshold 1.0), Aberración cromática por impacto,
 * Desaturación de fatiga cognitiva, Viñeteado microscópico y ToneMapping AgX.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  ToneMapping,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { HalfFloatType, Vector2 } from 'three';
import { feel } from '../../engine/feel';
import { world } from '../../engine/world';
import { Fatigue, FatigueEffect } from '../../shaders/FatigueEffect';

const caOffset = new Vector2(0.0006, 0.0003);

export function PostFX({ tier }: { tier: 'low' | 'mid' | 'high' }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ca = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bloom = useRef<any>(null);
  const fatigue = useRef<FatigueEffect>(null);

  useFrame(() => {
    const a = 0.0006 + feel.aberration * 0.006; // Pico reactivo al recibir daño
    if (ca.current?.offset) {
      ca.current.offset.set(a, a * 0.5);
    }

    if (bloom.current) {
      bloom.current.intensity =
        0.9 + (world.player.brainPower / 100) * 0.6 + Math.max(0, feel.zoom) * 0.8;
    }

    if (fatigue.current) {
      fatigue.current.fatigue = Math.max(0, Math.min(1, 1 - world.player.brainPower / 100));
    }
  });

  return (
    <EffectComposer
      multisampling={0}
      frameBufferType={HalfFloatType}
      resolutionScale={tier === 'low' ? 0.5 : 1}
    >
      <Bloom
        ref={bloom}
        mipmapBlur
        luminanceThreshold={1.0}
        luminanceSmoothing={0.15}
        radius={0.7}
        levels={tier === 'high' ? 8 : 5}
      />
      {tier !== 'low' && (
        <ChromaticAberration
          ref={ca}
          offset={caOffset}
          radialModulation
          modulationOffset={0.3}
        />
      )}
      <Fatigue ref={fatigue} />
      <Vignette offset={0.25} darkness={0.8} />
      {tier === 'high' && (
        <Noise premultiply opacity={0.5} blendFunction={BlendFunction.SOFT_LIGHT} />
      )}
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
