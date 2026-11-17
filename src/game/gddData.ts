/**
 * Complete Game Design Document (GDD) & Technical Architecture specification
 * for "Cajal: El Jardín de las Neuronas (Sinapsis 3D)".
 */

export const INITIAL_TYPESCRIPT_SCRIPT = `// src/game/controllers/PlayerBrainController.ts
import * as THREE from 'three';

export type ItemEffectType = 'healthy' | 'hazard';

export interface BrainCollectible {
  id: string;
  mesh: THREE.Object3D;
  type: ItemEffectType;
  label: string;
  brainDelta: number;      // Ej: +15 (Fruta/Agua) o -15 (Tabaco/Alcohol)
  speedMultiplier: number; // Ej: 1.25 (Hidratación) o 0.52 (Humo de tabaco)
  effectDuration: number;  // Segundos que dura el estado físico alterado
  inertiaDrag: number;     // 1.0 = control preciso, 0.35 = mareo/inercia por alcohol
  radius: number;
  active: boolean;
}

export class PlayerBrainController {
  public mesh: THREE.Group;
  public velocity = new THREE.Vector3();
  
  // Variables de Estado Neuro-Físico
  public brainPower: number = 20; // Porcentaje inicial (0% - 100%)
  public readonly maxBrainPower: number = 100;
  public baseSpeed: number = 9.0;
  public currentSpeedModifier: number = 1.0;
  public inertiaFactor: number = 1.0;
  private effectTimer: number = 0;

  // Vectores pre-alocados para evitar Garbage Collection (Zero-GC en el game loop)
  private readonly _inputDir = new THREE.Vector3();
  private readonly _targetVel = new THREE.Vector3();

  constructor(playerGroup: THREE.Group, spawnPos = new THREE.Vector3(0, 0, 18)) {
    this.mesh = playerGroup;
    this.mesh.position.copy(spawnPos);
  }

  /**
   * 1. ACTUALIZACIÓN DE MOVIMIENTO Y FÍSICAS (60 FPS, Delta Clamped)
   */
  public update(
     rawDt: number,
    keys: Set<string>,
    collectibles: BrainCollectible[],
    onBrainPowerChange?: (brainPower: number, label: string) => void
  ): void {
    const dt = Math.min(rawDt, 0.05); // Evita tunneling en caídas de framerate

    // Actualizar temporizador de efectos fisiológicos (ralentización / impulso)
    if (this.effectTimer > 0) {
      this.effectTimer -= dt;
      if (this.effectTimer <= 0) {
        this.currentSpeedModifier = 1.0;
        this.inertiaFactor = 1.0;
      }
    }

    // Lectura de entrada (WASD / Flechas)
    const moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
                  (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const moveZ = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
                  (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);

    this._inputDir.set(moveX, 0, moveZ);
    if (this._inputDir.lengthSq() > 0) {
      this._inputDir.normalize();
      // Orientación suave del personaje hacia el vector de avance
      const targetAngle = Math.atan2(this._inputDir.x, this._inputDir.z);
      this.mesh.rotation.y = THREE.MathUtils.damp(
        this.mesh.rotation.y,
        targetAngle,
        12,
        dt
      );
    }

    // Velocidad efectiva modulada por hábitos (hidratación vs. hipoxia por tabaco/alcohol)
    const effectiveSpeed = this.baseSpeed * this.currentSpeedModifier;
    this._targetVel.copy(this._inputDir).multiplyScalar(effectiveSpeed);

    // Amortiguación exponencial (el alcohol reduce inertiaFactor -> patinaje/mareo)
    const responseLambda = 14.0 * this.inertiaFactor;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, this._targetVel.x, responseLambda, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, this._targetVel.z, responseLambda, dt);

    // Integración de posición
    this.mesh.position.addScaledVector(this.velocity, dt);

    // Evaluación de colisiones contra objetos buenos y nocivos
    this.checkCollisions(collectibles, onBrainPowerChange);
  }

  /**
   * 2. SISTEMA DE COLISIÓN Y MODIFICACIÓN DE "BRAINPOWER" (0% a 100%)
   */
  private checkCollisions(
    collectibles: BrainCollectible[],
    onBrainPowerChange?: (brainPower: number, label: string) => void
  ): void {
    const playerRadius = 0.85;

    for (const item of collectibles) {
      if (!item.active) continue;

      const dx = this.mesh.position.x - item.mesh.position.x;
      const dz = this.mesh.position.z - item.mesh.position.z;
      const rSum = playerRadius + item.radius;

      // Test de intersección circular en el plano XZ
      if (dx * dx + dz * dz <= rSum * rSum) {
        item.active = false;
        item.mesh.visible = false;

        // Sumar o restar porcentaje a BrainPower con clamp [0, 100]
        this.brainPower = THREE.MathUtils.clamp(
          this.brainPower + item.brainDelta,
          0,
          this.maxBrainPower
        );

        // Aplicar impacto fisiológico sobre las físicas de movimiento
        this.currentSpeedModifier = item.speedMultiplier;
        this.inertiaFactor = item.inertiaDrag;
        this.effectTimer = item.effectDuration;

        onBrainPowerChange?.(this.brainPower, item.label);
      }
    }
  }
}`;

export const PROJECT_SCAFFOLDING = `cajal-sinapsis-3d/
├── public/
│   ├── manifest.json                 # Configuración PWA instalable (Móvil/Tablet/Desktop)
│   └── icons/                        # Iconografía adaptativa
├── src/
│   ├── main.tsx                      # Punto de entrada de la aplicación
│   ├── App.tsx                       # Máquina de estados principal (Title -> Playing -> Pause/Victory)
│   ├── game/
│   │   ├── rules.ts                  # Lógica pura desacoplada (BrainPower, físicas, niveles, diálogos)
│   │   ├── rules.test.ts             # Tests unitarios deterministas (node:test)
│   │   ├── sound.ts                  # Sintetizador procedural Web Audio API (sin dependencias MP3)
│   │   ├── gddData.ts                # Especificación técnica y narrativa del GDD
│   │   ├── controllers/
│   │   │   ├── PlayerBrainController.ts  # Controlador cinemático 3D y colisiones
│   │   │   └── HazardAIController.ts     # Políticas de IA (Chaser Humo, Charger Azúcar, Orbiter Alcohol)
│   │   └── factories/
│   │       ├── ActorFactory.ts       # Modelos 3D compuestos (Niño, Mentor Cajal, Portal Sináptico)
│   │       └── EnvironmentFactory.ts # Generación procedural de El Parque, El Colegio y La Fiesta
│   ├── components/
│   │   ├── Canvas3D.tsx              # Contenedor WebGL aislado (60 FPS loop + soporte SoftwareGL)
│   │   ├── GameHud.tsx               # HUD histológico (Barra Potencial Cerebral, Vitalidad, Cajal)
│   │   └── GddModal.tsx              # Visor interactivo del Documento de Diseño (GDD) y código
│   └── styles/
│       └── index.css                 # Tokens tipográficos (Fraunces, Plus Jakarta Sans, JetBrains Mono)
├── package.json
├── tsconfig.json
└── vite.config.ts`;

export interface EngineComparisonRow {
  criterion: string;
  threeReactStack: string;
  godot4Stack: string;
  verdict: string;
}

export const ENGINE_COMPARISON: EngineComparisonRow[] = [
  {
    criterion: 'Despliegue Web y Móvil Instantáneo',
    threeReactStack:
      'Carga inmediata en cualquier navegador (PC, Mac, iOS, Android) con bundle ligero (<200 KB gzip), sin descargas de binarios WASM pesados ni cabeceras SharedArrayBuffer restrictivas.',
    godot4Stack:
      'La exportación HTML5/WebGL en Godot 4 requiere un binario WebAssembly de ~25–40 MB y presenta limitaciones de compatibilidad en Safari iOS y navegadores escolares antiguos.',
    verdict: 'Ventaja decisiva para Three.js + React en entornos educativos y Web/Móvil.',
  },
  {
    criterion: 'Empaquetado Nativo (PC, Mac, iOS, Android)',
    threeReactStack:
      'Mediante Tauri v2 (PC/Mac con binarios de <10 MB) y Capacitor / PWA (iOS/Android) se mantiene una única base de código TypeScript.',
    godot4Stack:
      'Excelente exportación nativa a Windows y macOS, pero requiere plantillas de compilación separadas y gestión manual de certificados para Web/Móvil.',
    verdict: 'Empate técnico en escritorio; Three.js + Tauri/Capacitor unifica el pipeline.',
  },
  {
    criterion: 'UI Educativa, Accesibilidad y HUD',
    threeReactStack:
      'React + Tailwind CSS + SVG permite crear interfaces histológicas ricas, modales educativos de Ramón y Cajal, lectores de pantalla (WCAG AA) y gráficas sin esfuerzo.',
    godot4Stack:
      'El sistema de nodos Control de Godot es potente para juegos tradicionales, pero menos flexible para texto editorial responsivo, accesibilidad web y analíticas escolares.',
    verdict: 'Ventaja para Three.js + React por su ecosistema UI declarativo.',
  },
  {
    criterion: 'Flujo de Trabajo Ágil y Testing',
    threeReactStack:
      'Tipado estricto en TypeScript, tests unitarios instantáneos (node:test / Vitest) sobre la lógica de BrainPower y despliegue continuo (CI/CD) en segundos.',
    godot4Stack:
      'GDScript es rápido para prototipar escenas, pero carece del ecosistema de validación tipada y despliegue web instantáneo de TypeScript.',
    verdict: 'Recomendación final: Three.js + React + TypeScript.',
  },
];

export const NEXT_GEN_R3F_PIPELINE_SNIPPET = `// 1. Esqueleto y Blend Trees (Idle / Run / Hit / Victory) + Draco GLTF
import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows, Sparkles, Text3D } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { computeAnimationBlendWeights } from '../rules';

export function NextGenStudentCharacter({ speed, baseSpeed, isHit, isVictory, brainPower }) {
  const group = useRef(null);
  // Carga con compresión Draco (.glb exportado desde Mixamo)
  const { nodes, materials, animations } = useGLTF('/models/student-draco.glb', true);
  const { actions } = useAnimations(animations, group);

  useFrame((_, dt) => {
    // Blend Tree determinista compartido con nuestro motor Three.js
    const weights = computeAnimationBlendWeights(speed, baseSpeed, isHit, isVictory);
    actions.Idle?.setEffectiveWeight(weights.idle);
    actions.Run?.setEffectiveWeight(weights.run);
    actions.Hit?.setEffectiveWeight(weights.hit);
    actions.Victory?.setEffectiveWeight(weights.victory);
  });

  return (
    <group ref={group}>
      <primitive object={nodes.RootBone} />
      {/* 2. Sombras de Contacto suaves y económicas bajo el personaje */}
      <ContactShadows opacity={0.65} scale={4.5} blur={2.2} far={4} />
      {/* 3. Partículas Sinápticas Instanciadas alrededor de la Corona Neuronal */}
      <Sparkles count={48} scale={3.5} size={2.4} speed={0.6} color="#ffd166" />
    </group>
  );
}`;

