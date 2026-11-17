/**
 * GLSL Post-Processing Shader for Cognitive Fatigue (Desaturation proportional to BrainPower reduction).
 * Receives uniform `uDesaturation` in range [0.0, 1.0], where:
 *   uDesaturation = clamp(1.0 - (brainPower / 100.0), 0.0, 1.0)
 */

export const FATIGUE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FATIGUE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D inputBuffer;
  uniform float uDesaturation;
  varying vec2 vUv;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Coeficientes de luminancia perceptual Rec. 709
    vec3 lumaWeights = vec3(0.2126, 0.7152, 0.0722);
    float luminance = dot(inputColor.rgb, lumaWeights);

    // Tinte frío de fatiga sináptica mezclado con la escala de grises
    vec3 fatiguedGray = mix(vec3(luminance), vec3(luminance * 0.92, luminance * 0.95, luminance * 1.04), 0.25);

    // Interpolación proporcional a uDesaturation (0.0 = 100% BrainPower, 1.0 = 0% BrainPower)
    float desat = clamp(uDesaturation, 0.0, 1.0);
    vec3 finalRgb = mix(inputColor.rgb, fatiguedGray, desat);

    outputColor = vec4(finalRgb, inputColor.a);
  }
`;

export const FatigueShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDesaturation: { value: 0.5 },
  },
  vertexShader: FATIGUE_VERTEX_SHADER,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uDesaturation;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 lumaWeights = vec3(0.2126, 0.7152, 0.0722);
      float luminance = dot(texel.rgb, lumaWeights);
      vec3 fatiguedGray = mix(vec3(luminance), vec3(luminance * 0.92, luminance * 0.95, luminance * 1.04), 0.25);
      vec3 finalRgb = mix(texel.rgb, fatiguedGray, clamp(uDesaturation, 0.0, 1.0));
      gl_FragColor = vec4(finalRgb, texel.a);
    }
  `,
};

export default FATIGUE_FRAGMENT_SHADER;
