/**
 * BurstSystem.ts — Sistema de partículas 100% en GPU mediante Ring Buffer e InstancedMesh
 *
 * Emite hasta 2.048 partículas por estallido de toxina o neurotrofina.
 * Movimiento, arrastre exponencial, desvanecido y billboard se calculan en el
 * vertex shader en GPU; coste en CPU por frame: cero.
 */

import * as THREE from 'three';

const MAX = 2048;

const burstVertShader = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute float aBirth;
  attribute float aLife;

  uniform float uTime;
  varying vec3 vColor;
  varying float vT;
  varying vec2 vUv;

  void main() {
    float age = uTime - aBirth;
    float t = age / aLife;
    if (t < 0.0 || t > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Descartar fuera del frustum
      return;
    }

    // Movimiento balístico con arrastre viscoso exponencial
    vec3 p = aStart + aVel * (1.0 - exp(-3.0 * age)) / 3.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += position.xy * 0.24 * (1.0 - t) * (1.0 - t);

    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vT = t;
    vUv = uv;
  }
`;

const burstFragShader = /* glsl */ `
  varying vec3 vColor;
  varying float vT;
  varying vec2 vUv;

  void main() {
    float a = smoothstep(0.5, 0.0, length(vUv - 0.5));
    gl_FragColor = vec4(vColor * (1.0 - vT), a * (1.0 - vT));
  }
`;

export class BurstSystem {
  head = 0;
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  private a: {
    start: THREE.InstancedBufferAttribute;
    vel: THREE.InstancedBufferAttribute;
    color: THREE.InstancedBufferAttribute;
    birth: THREE.InstancedBufferAttribute;
    life: THREE.InstancedBufferAttribute;
  };

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mk = (n: number) =>
      new THREE.InstancedBufferAttribute(new Float32Array(MAX * n), n).setUsage(
        THREE.DynamicDrawUsage
      );

    this.a = {
      start: mk(3),
      vel: mk(3),
      color: mk(3),
      birth: mk(1),
      life: mk(1),
    };

    this.a.birth.array.fill(-1000.0); // Inactivas inicialmente

    geo.setAttribute('aStart', this.a.start);
    geo.setAttribute('aVel', this.a.vel);
    geo.setAttribute('aColor', this.a.color);
    geo.setAttribute('aBirth', this.a.birth);
    geo.setAttribute('aLife', this.a.life);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: burstVertShader,
      fragmentShader: burstFragShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    this.mesh.frustumCulled = false;
  }

  /**
   * Emite n partículas desde (x,y,z). Escribe solo el rango activo del buffer circular.
   */
  emit(
    x: number,
    y: number,
    z: number,
    color: [number, number, number],
    n: number,
    speed: number,
    now: number
  ) {
    const first = this.head;
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      const ang = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.6;
      const sp = speed * (0.4 + Math.random() * 0.6);

      this.a.start.setXYZ(i, x, y, z);
      this.a.vel.setXYZ(i, Math.cos(ang) * sp, up * sp, Math.sin(ang) * sp);
      // Radiance HDR para alimentar el bloom
      this.a.color.setXYZ(i, color[0] * 2.8, color[1] * 2.8, color[2] * 2.8);
      this.a.birth.setX(i, now);
      this.a.life.setX(i, 0.35 + Math.random() * 0.4);
    }

    for (const attr of Object.values(this.a)) {
      attr.clearUpdateRanges();
      if (first + n <= MAX) {
        attr.addUpdateRange(first * attr.itemSize, n * attr.itemSize);
      } else {
        attr.addUpdateRange(0, MAX * attr.itemSize);
      }
      attr.needsUpdate = true;
    }
  }
}
