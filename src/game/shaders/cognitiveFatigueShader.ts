/**
 * Custom GLSL Post-Processing Shader for Next-Gen Web Visuals:
 * 1. Selective Synaptic Bloom (uBloomStrength): Extracts high-luminance highlights from the
 *    Neural Crown and Synaptic Portal and bathes the character in warm golden synaptic light.
 * 2. Cognitive Fatigue Grayscale Desaturation (uDesaturation): Proportional to BrainPower deficit.
 * 3. Depth-of-Field / Modal Focus Blur (uModalBlur): Softly blurs the 3D scene when Cajal
 *    dialogue modals appear, avoiding CSS backdrop-filter overhead on WebGL.
 */

export const CognitiveFatigueShader = {
  name: 'CognitiveFatigueShader',
  uniforms: {
    tDiffuse: { value: null },
    uDesaturation: { value: 0.0 },
    uVignette: { value: 0.0 },
    uBloomStrength: { value: 0.45 },
    uModalBlur: { value: 0.0 },
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
    uniform float uBloomStrength;
    uniform float uModalBlur;
    varying vec2 vUv;

    vec3 acesFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 extractBright(vec3 c) {
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float knee = smoothstep(0.62, 1.15, lum);
      return c * knee;
    }

    void main() {
      vec4 baseTexel = texture2D(tDiffuse, vUv);

      // Single-pass 5-tap neighborhood sample for Selective Synaptic Bloom & Modal DOF Blur
      float spread = 0.0032 + uModalBlur * 0.0045;
      vec3 s1 = texture2D(tDiffuse, vUv + vec2(spread, spread)).rgb;
      vec3 s2 = texture2D(tDiffuse, vUv + vec2(-spread, spread)).rgb;
      vec3 s3 = texture2D(tDiffuse, vUv + vec2(spread, -spread)).rgb;
      vec3 s4 = texture2D(tDiffuse, vUv + vec2(-spread, -spread)).rgb;
      vec3 avgNeighbors = 0.25 * (s1 + s2 + s3 + s4);

      // Blend base scene with neighborhood when Cajal modal DOF is active
      vec3 sceneLinear = mix(baseTexel.rgb, avgNeighbors, clamp(uModalBlur, 0.0, 0.85));

      // Extract bright emissive highlights (Neural Crown, Portal, Golden Sparkles)
      vec3 bloomHighlight = 0.2 * (
        extractBright(baseTexel.rgb) +
        extractBright(s1) +
        extractBright(s2) +
        extractBright(s3) +
        extractBright(s4)
      );

      // Combine scene with selective synaptic bloom before ACES tone mapping
      vec3 combinedLinear = sceneLinear + bloomHighlight * uBloomStrength * vec3(1.08, 0.96, 0.72);
      vec3 mapped = acesFilm(combinedLinear * 1.12);
      vec3 srgb = pow(mapped, vec3(1.0 / 2.2));

      // Rec. 709 perceptual luminance coefficients for Cognitive Fatigue Desaturation
      float luma = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 grayscale = vec3(luma * 0.96, luma * 0.98, luma * 1.02);

      float desatFactor = clamp(uDesaturation, 0.0, 1.0);
      vec3 color = mix(srgb, grayscale, desatFactor);

      // Peripheral cognitive fatigue vignette
      vec2 centeredUv = vUv - vec2(0.5);
      float dist = length(centeredUv);
      float vig = smoothstep(0.35, 0.82, dist) * clamp(uVignette, 0.0, 1.0);
      color *= (1.0 - vig * 0.55);

      gl_FragColor = vec4(color, baseTexel.a);
    }
  `,
};
