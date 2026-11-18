/**
 * FatigueEffect.tsx — Shader de fatiga cognitiva integrado con postprocessing
 *
 * Desatura la imagen de 0 a 85% conforme baja el BrainPower del jugador,
 * aplicando un tinte frío histológico («apagado») y un pulso leve de «respiración».
 */

import { Effect } from 'postprocessing';
import { Uniform } from 'three';
import { forwardRef, useMemo } from 'react';

const frag = /* glsl */ `
  uniform float uFatigue;
  uniform float uTime;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 grey = vec3(l) * vec3(0.92, 0.96, 1.06);             // gris frío, «apagado»
    vec3 c = mix(inputColor.rgb, grey, uFatigue * 0.85);
    c *= 1.0 + 0.025 * sin(uTime * 2.2) * (1.0 - uFatigue);  // la red «respira»
    outputColor = vec4(c, inputColor.a);
  }
`;

export class FatigueEffect extends Effect {
  constructor() {
    super('FatigueEffect', frag, {
      uniforms: new Map([
        ['uFatigue', new Uniform(0)],
        ['uTime', new Uniform(0)],
      ]),
    });
  }

  set fatigue(v: number) {
    const u = this.uniforms.get('uFatigue');
    if (u) u.value = v;
  }

  get fatigue(): number {
    return this.uniforms.get('uFatigue')?.value ?? 0;
  }

  update(_r: unknown, _i: unknown, dt: number) {
    const u = this.uniforms.get('uTime');
    if (u) u.value += dt;
  }
}

export const Fatigue = forwardRef<FatigueEffect>((_, ref) => {
  const effect = useMemo(() => new FatigueEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
Fatigue.displayName = 'Fatigue';
