/**
 * NeuralNetwork.tsx — Red neuronal periférica con potenciales de acción en GPU
 *
 * Renderiza 140 neuronas en anillo alrededor de la arena conectadas por k=3 aristas.
 * Los potenciales de acción viajan a lo largo de los axones completamente en el
 * vertex/fragment shader, con 1 solo draw call y cero coste en CPU.
 * La actividad de la red escala dinámicamente con el BrainPower del jugador.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { world } from '../../engine/world';
import { mulberry32 } from '../../engine/rng';

const vertShader = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vSeed;

  void main() {
    vT = aT;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragShader = /* glsl */ `
  uniform float uTime;
  uniform float uActivity;
  uniform vec3 uBase;
  uniform vec3 uSpike;
  varying float vT;
  varying float vSeed;

  void main() {
    float head  = fract(uTime * (0.25 + vSeed * 0.3) + vSeed * 7.0);
    float on    = step(fract(vSeed * 13.7), uActivity); // Porcentaje de sinapsis activas
    float spike = exp(-pow((vT - head) * 16.0, 2.0)) * on;
    gl_FragColor = vec4(uBase * 0.35 + uSpike * spike, 0.35 + spike);
  }
`;

function buildNetwork(n = 140, k = 3, seed = 7): THREE.BufferGeometry {
  const rnd = mulberry32(seed); // Determinista para consistencia visual
  const nodes = Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2;
    const r = 16 + rnd() * 18; // Anillo fuera de los muros de la arena
    return new THREE.Vector3(Math.cos(a) * r, -2 - rnd() * 6, Math.sin(a) * r);
  });

  const pos: number[] = [];
  const t: number[] = [];
  const s: number[] = [];

  nodes.forEach((p, i) => {
    nodes
      .map((q, j) => [j, p.distanceToSquared(q)] as const)
      .filter(([j]) => j > i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, k)
      .forEach(([j]) => {
        const q = nodes[j];
        const seedE = rnd();
        pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        t.push(0, 1);
        s.push(seedE, seedE);
      });
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 1));
  return g;
}

export function NeuralNetwork() {
  const geo = useMemo(() => buildNetwork(), []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActivity: { value: 0.2 },
          uBase: { value: new THREE.Color('#1d3b66') },
          uSpike: { value: new THREE.Color(0.4, 2.6, 3.2) }, // HDR radiance para bloom
        },
        vertexShader: vertShader,
        fragmentShader: fragShader,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  useFrame((st) => {
    mat.uniforms.uTime.value = st.clock.elapsedTime;
    mat.uniforms.uActivity.value = THREE.MathUtils.lerp(
      0.08,
      0.85,
      world.player.brainPower / 100
    );
  });

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <primitive object={mat} attach="material" />
    </lineSegments>
  );
}
