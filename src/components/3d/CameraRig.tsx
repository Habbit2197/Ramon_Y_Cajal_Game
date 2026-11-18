/**
 * CameraRig.tsx — Cámara cinemática cenital con lookahead y sacudida trauma² (Simplex Noise)
 *
 * Sustituye completamente a OrbitControls para fijar la perspectiva del twin-stick roguelite.
 * Incluye lookahead dinámico hacia la dirección de movimiento y apuntado, y respeta
 * los ajustes de accesibilidad de sacudida (prefers-reduced-motion y shakeScale).
 */

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { world } from '../../engine/world';
import { feel } from '../../engine/feel';
import { useRunStore } from '../../store/useRunStore';

const noise = new SimplexNoise();
const base = new THREE.Vector3(0, 0, 0);
const look = new THREE.Vector3(0, 0, 0);
const HEIGHT = 18.5;
const BACK = 10.0;
const FOV = 46;

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const shakeScale = useRunStore((s) => s.settings.shakeScale);

  useFrame((state, dt) => {
    const p = world.player;
    // Lookahead suave proyectado en la dirección de apuntado y movimiento
    const ax = p.x + p.aimX * 2.2 + p.vx * 0.12;
    const az = p.z + p.aimZ * 2.2 + p.vz * 0.12;

    base.x = THREE.MathUtils.damp(base.x, ax, 6, dt);
    base.z = THREE.MathUtils.damp(base.z, az, 6, dt);

    const t = state.clock.elapsedTime * 22;
    const k = feel.trauma ** 2 * (shakeScale ?? 1.0);

    camera.position.set(
      base.x + noise.noise(t, 0) * 0.7 * k,
      HEIGHT + noise.noise(t, 9) * 0.3 * k,
      base.z + BACK + noise.noise(t, 17) * 0.7 * k
    );

    look.set(base.x, 0.5, base.z);
    camera.lookAt(look);

    // Roll angular leve durante impactos fuertes
    camera.rotateZ(noise.noise(t, 31) * 0.035 * k);
    camera.fov = FOV - feel.zoom * 5;
    camera.updateProjectionMatrix();
  });

  return null;
}
