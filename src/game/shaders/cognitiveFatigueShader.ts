/**
 * Custom GLSL Post-Processing Shader for Cognitive Fatigue (Desaturation & Tunnel Vignette).
 * Driven proportionally by the reduction in BrainPower:
 * - BrainPower = 100% -> uDesaturation = 0.0 (100% vibrant color)
 * - BrainPower = 0%   -> uDesaturation = 1.0 (100% grayscale + peripheral fatigue vignette)
 */

export const CognitiveFatigueShader = {
  name: 'CognitiveFatigueShader',
  uniforms: {
    tDiffuse: { value: null },
    uDesaturation: { value: 0.0 },
    uVignette: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uDesaturation;
    uniform float uVignette;
    varying vec2 vUv;

    // ACES Filmic Tone Mapping + Linear-to-sRGB in a single pass
    vec3 acesFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);

      // Apply exposure + ACES tone mapping + sRGB gamma correction
      vec3 mapped = acesFilm(texel.rgb * 1.12);
      vec3 srgb = pow(mapped, vec3(1.0 / 2.2));

      // Rec. 709 perceptual luminance coefficients
      float luma = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 grayscale = vec3(luma * 0.96, luma * 0.98, luma * 1.02);

      float desatFactor = clamp(uDesaturation, 0.0, 1.0);
      vec3 color = mix(srgb, grayscale, desatFactor);

      // Subtle peripheral cognitive fatigue vignette proportional to BrainPower reduction
      vec2 centeredUv = vUv - vec2(0.5);
      float dist = length(centeredUv);
      float vig = smoothstep(0.35, 0.82, dist) * clamp(uVignette, 0.0, 1.0);
      color *= (1.0 - vig * 0.55);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};
