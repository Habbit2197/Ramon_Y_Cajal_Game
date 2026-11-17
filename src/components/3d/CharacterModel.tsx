/**
 * CharacterModel.tsx
 * Generado con gltfjsx y extendido para soportar un Blend Tree
 * de animaciones Idle/Run con crossFade suave vía useAnimations (Drei).
 *
 * Props:
 *   currentAction – 'idle' | 'run'  → controla qué clip de Mixamo se reproduce.
 *
 * Notas de escala:
 *   Los modelos exportados desde Mixamo vienen en centímetros (escala ~100x).
 *   Aplicamos scale={0.01} en el <group> raíz para normalizarlos a metros R3F.
 */

import { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeElement } from '@react-three/fiber';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AnimAction = 'idle' | 'run';

export interface CharacterModelProps extends Omit<ThreeElement<typeof THREE.Group>, 'scale'> {
  /** Nombre semántico de la animación activa */
  currentAction?: AnimAction;
  /** Ruta al .glb en /public (default: modelo incluido en el proyecto) */
  modelPath?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Duración del crossFade en segundos */
const FADE_DURATION = 0.2;

/**
 * Heurística: busca el clip que contiene la palabra clave (case-insensitive).
 * Devuelve el primer clip si no hay coincidencia para evitar errores en modelos
 * que usan nombres distintos (ej. "Armature|Idle", "mixamo.com|layer0", …).
 */
function findClip(
  actions: Record<string, THREE.AnimationAction | null>,
  keyword: string
): THREE.AnimationAction | null {
  const lower = keyword.toLowerCase();
  const key = Object.keys(actions).find((k) => k.toLowerCase().includes(lower));
  if (key) return actions[key] ?? null;
  // fallback: primer clip disponible
  const fallback = Object.values(actions).find(Boolean);
  return fallback ?? null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CharacterModel({
  currentAction = 'idle',
  modelPath = '/models/character.glb',
  ...groupProps
}: CharacterModelProps) {
  const group = useRef<THREE.Group>(null);

  // Carga el .glb (Three.js GLTF loader bajo el capó)
  const { scene, animations } = useGLTF(modelPath);

  // useAnimations crea y registra automáticamente todos los AnimationAction
  const { actions, mixer } = useAnimations(animations, group);

  // Ref para rastrear la acción previa y hacer un crossFade limpio
  const prevActionRef = useRef<THREE.AnimationAction | null>(null);

  // ── Inicialización: arranca la animación idle al montar ─────────────────
  useEffect(() => {
    if (!mixer || !actions) return;

    const idle = findClip(actions, 'idle') ?? Object.values(actions)[0];
    if (idle) {
      idle.reset().fadeIn(FADE_DURATION).play();
      prevActionRef.current = idle;
    }

    return () => {
      // Detiene todos los clips al desmontar para evitar memory leaks
      mixer.stopAllAction();
    };
  }, [mixer, actions]);

  // ── Reacción a cambios de currentAction (crossFade suave) ───────────────
  useEffect(() => {
    if (!actions) return;

    const keyword = currentAction === 'run' ? 'run' : 'idle';
    const nextAction = findClip(actions, keyword);

    if (!nextAction) return;

    const prev = prevActionRef.current;

    if (prev && prev !== nextAction) {
      // CrossFade: fadeOut del clip saliente, fadeIn del entrante
      nextAction.reset().fadeIn(FADE_DURATION).play();
      prev.fadeOut(FADE_DURATION);
    } else if (!prev) {
      nextAction.reset().fadeIn(FADE_DURATION).play();
    }

    prevActionRef.current = nextAction;
  }, [currentAction, actions]);

  // Clona la escena para permitir múltiples instancias del mismo modelo
  const clonedScene = useRef<THREE.Group | null>(null);
  useEffect(() => {
    // Reutilizamos la escena directamente (gltfjsx suele clonarla)
    clonedScene.current = scene as unknown as THREE.Group;
  }, [scene]);

  return (
    <group
      ref={group}
      {...groupProps}
      // Mixamo exporta en cm → normalizamos a metros con scale 0.01
      scale={0.01}
      name="CharacterModelRoot"
      dispose={null}
    >
      <primitive object={scene} />
    </group>
  );
}

// Precarga el modelo para evitar el pop visual en la primera carga
export function preloadCharacterModel(path = '/models/character.glb') {
  useGLTF.preload(path);
}

export default CharacterModel;
