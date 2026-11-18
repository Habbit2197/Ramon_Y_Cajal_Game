/**
 * TissueFloor.tsx — Suelo de tejido neuronal dinámico (Voronoi + Ondas de propagación)
 *
 * Células que respiran orgánicamente según la salud cerebral y se deforman mediante
 * ondas radiales (uRipples) emitidas con cada baja o salto de mielina.
 * Emite brillo HDR en las membranas celulares activo para activar el bloom del microscopio.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';

const vertShader = /* glsl */ `
  varying vec2 vWorld;

  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragShader = /* glsl */ `
  uniform float uTime;
  uniform float uFatigue;
  uniform vec4 uRipples[8]; // xy = origen, z = tiempo inicio, w = intensidad
  varying vec2 vWorld;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float cells(vec2 p, out float edge) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        o = 0.5 + 0.4 * sin(uTime * 0.4 + 6.2831 * o); // Ritmo de respiración celular
        float d = length(g + o - f);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    edge = d2 - d1;
    return d1;
  }

  void main() {
    float rip = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (age < 0.0 || age > 1.2) continue;
      float dist = length(vWorld - r.xy);
      rip += r.w * exp(-pow((dist - age * 14.0) * 1.6, 2.0)) * (1.0 - age / 1.2);
    }

    vec2 p = vWorld * 0.35 + normalize(vWorld + 1e-3) * rip * 0.05;
    float e;
    float c = cells(p, e);
    float membrane = 1.0 - smoothstep(0.02, 0.08, e);

    vec3 col = mix(vec3(0.02, 0.03, 0.07), vec3(0.05, 0.09, 0.18), c);
    col += membrane * vec3(0.15, 0.55, 0.9) * (0.35 + rip * 3.0); // HDR > 1.0 en ondas -> Bloom

    // Desaturación por fatiga cognitiva
    col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uFatigue * 0.7);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function TissueFloor({ tier = 'high' }: { tier?: 'low' | 'mid' | 'high' }) {
  // Preasignar array de vectores uniform para evitar GC
  const rippleUniforms = useMemo(
    () => Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0)),
    []
  );

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uFatigue: { value: 0 },
          uRipples: { value: rippleUniforms },
        },
        vertexShader: vertShader,
        fragmentShader: fragShader,
        toneMapped: false,
      }),
    [rippleUniforms]
  );

  useFrame((st) => {
    const elapsed = st.clock.elapsedTime;
    mat.uniforms.uTime.value = elapsed;
    mat.uniforms.uFatigue.value = Math.max(0, 1 - world.player.brainPower / 100);

    for (let i = 0; i < 8; i++) {
      const rip = world.ripples[i];
      rippleUniforms[i].set(rip.x, rip.y, rip.time, rip.strength);
    }
  });

  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={tier === 'high'}>
      <planeGeometry args={[44, 34]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
