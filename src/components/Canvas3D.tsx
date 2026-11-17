import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  CollectibleSpec,
  HazardPolicy,
  ITEM_CATALOG,
  ItemSubType,
  LEVELS,
  LevelConfig,
  PlayerPhysicsState,
  applyItemCollision,
  calculateCognitiveFatigue,
  createInitialPlayerState,
  evaluateStageOutcome,
  isCircleCollision,
  stepPlayerKinematics,
} from '../game/rules';
import { CognitiveFatigueShader } from '../game/shaders/cognitiveFatigueShader';
import { soundEngine } from '../game/sound';

export type GameAppState = 'title' | 'playing' | 'paused' | 'gameover';

export interface HudSnapshot {
  brainPower: number;
  cognitiveFatiguePct: number;
  vitality: number;
  maxVitality: number;
  speedModifier: number;
  activeEffectName: string | null;
  effectTimer: number;
  synapsesCollected: number;
  hazardsHit: number;
  score: number;
  portalUnlocked: boolean;
  cajalBannerText: string;
  cajalBannerType: 'intro' | 'healthy' | 'hazard' | 'portal';
  elapsedTime: number;
  dashReady: boolean;
}

interface Canvas3DProps {
  appState: GameAppState;
  levelIndex: number;
  resetSignal: number;
  virtualInputRef: React.MutableRefObject<{ moveX: number; moveZ: number; dashPressed: boolean }>;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onStageEnd: (outcome: 'victory' | 'defeat', finalSnapshot: HudSnapshot) => void;
}

interface ActivePickup {
  id: string;
  spec: CollectibleSpec;
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  bobOffset: number;
  respawnTimer: number;
  active: boolean;
}

interface ActiveHazard {
  id: string;
  spec: CollectibleSpec;
  policy: HazardPolicy;
  group: THREE.Group;
  telegraphRing: THREE.Mesh;
  telegraphMat: THREE.MeshBasicMaterial;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  orbitAngle: number;
  windupTimer: number;
  attackActiveTimer: number;
  cooldownTimer: number;
}

interface ParticlePool {
  mesh: THREE.InstancedMesh;
  positions: Float32Array;
  velocities: Float32Array;
  GoldColors: Float32Array;
  lives: Float32Array;
  maxLives: Float32Array;
  scales: Float32Array;
  cursor: number;
  count: number;
}

// Module-scope reusable scratch objects (Zero-GC in animation loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

function createProceduralPathTexture(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7d6952';
  ctx.fillRect(0, 0, 256, 256);

  // Draw histological-inspired organic stone tiles & axons
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 64) {
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      ctx.fillStyle = (x + y) % 64 === 0 ? '#8a755c' : '#725f49';
      ctx.strokeStyle = '#524332';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect((x + offset) % 256, y + 2, 60, 28, 5);
      ctx.fill();
      ctx.stroke();
    }
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(3, 14);
  colorMap.anisotropy = maxAnisotropy;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    const shade = 100 + ((i * 37) % 55);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.fillRect((i * 53) % 256, (i * 97) % 256, 4, 4);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 14);
  bumpMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap };
}

function createContactShadowMesh(radius = 0.85): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x05070a,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  return mesh;
}

/**
 * Builds the 10-part composite 3D boy protagonist with a dynamic Neural Halo
 * that grows dendrites as BrainPower approaches 100%.
 */
function buildPlayerBoyMesh(): {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  neuralHalo: THREE.Group;
  haloMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(0.95));

  const sneakerMat = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.78,
    metalness: 0.1,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x1d3557,
    roughness: 0.72,
    metalness: 0.08,
  });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a9d8f,
    roughness: 0.48,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf4a261,
    roughness: 0.62,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x2b1d12,
    roughness: 0.85,
    metalness: 0.05,
  });
  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0xe9c46a,
    roughness: 0.35,
    metalness: 0.45,
  });

  // 1 & 2: Left & Right Legs + Sneakers
  const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.7, 12);
  const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.36);

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.38, 0);
  leftLeg.castShadow = true;
  const leftShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  leftShoe.position.set(0, -0.3, 0.05);
  leftLeg.add(leftShoe);
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.38, 0);
  rightLeg.castShadow = true;
  const rightShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  rightShoe.position.set(0, -0.3, 0.05);
  rightLeg.add(rightShoe);
  root.add(rightLeg);

  // 3: Torso Jacket
  const torsoGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.82, 16);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;
  root.add(torso);

  // 4: Explorer Backpack + Metallic Buckle
  const packGeo = new THREE.BoxGeometry(0.48, 0.54, 0.26);
  const backpack = new THREE.Mesh(packGeo, backpackMat);
  backpack.position.set(0, 1.12, -0.34);
  backpack.castShadow = true;
  root.add(backpack);

  // 5 & 6: Left & Right Arms
  const armGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.62, 10);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.46, 1.1, 0);
  leftArm.castShadow = true;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.46, 1.1, 0);
  rightArm.castShadow = true;
  root.add(rightArm);

  // 7 & 8: Head + Sculpted Hair Cap
  const headGeo = new THREE.SphereGeometry(0.34, 18, 16);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.78, 0);
  head.castShadow = true;
  root.add(head);

  const hairGeo = new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 1.82, -0.02);
  hair.rotation.x = -0.18;
  root.add(hair);

  // 9 & 10: Dynamic Synaptic Neural Crown (grows with BrainPower)
  const neuralHalo = new THREE.Group();
  neuralHalo.position.set(0, 2.32, 0);
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xf4a261,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.8,
  });
  const ringGeo = new THREE.TorusGeometry(0.48, 0.035, 10, 28);
  ringGeo.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, haloMat);
  neuralHalo.add(ringMesh);

  const nodeGeo = new THREE.OctahedronGeometry(0.08, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const node = new THREE.Mesh(nodeGeo, haloMat);
    node.position.set(Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.48);
    neuralHalo.add(node);
  }
  root.add(neuralHalo);

  return { root, leftLeg, rightLeg, leftArm, rightArm, neuralHalo, haloMat, bodyMat };
}

/**
 * Builds the Synaptic Portal + Don Santiago Ramón y Cajal mentor figure at the end of the level.
 */
function buildCajalPortalGroup(position: { x: number; z: number }): {
  group: THREE.Group;
  vortexRing: THREE.Mesh;
  vortexMat: THREE.MeshStandardMaterial;
  cajalFigure: THREE.Group;
} {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a359,
    roughness: 0.25,
    metalness: 0.85,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x3d405b,
    roughness: 0.8,
    metalness: 0.15,
  });
  const vortexMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.5,
  });

  // Base pedestal platform
  const baseGeo = new THREE.CylinderGeometry(3.4, 3.8, 0.32, 24);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.position.y = 0.16;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Left & Right Brass Microscope Columns
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.35, 4.2, 16);
  const leftPillar = new THREE.Mesh(pillarGeo, brassMat);
  leftPillar.position.set(-2.3, 2.1, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, brassMat);
  rightPillar.position.set(2.3, 2.1, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  // Synaptic Arch Torus
  const archGeo = new THREE.TorusGeometry(2.3, 0.22, 14, 32, Math.PI);
  const archMesh = new THREE.Mesh(archGeo, brassMat);
  archMesh.position.set(0, 2.1, 0);
  group.add(archMesh);

  // Rotating Inner Synaptic Vortex Ring
  const vortexGeo = new THREE.TorusGeometry(1.75, 0.12, 12, 32);
  const vortexRing = new THREE.Mesh(vortexGeo, vortexMat);
  vortexRing.position.set(0, 2.2, 0);
  group.add(vortexRing);

  // Don Santiago Ramón y Cajal Mentor Figure standing beside the portal
  const cajalFigure = new THREE.Group();
  cajalFigure.position.set(3.2, 0.16, 1.1);
  cajalFigure.rotation.y = -0.45;
  cajalFigure.add(createContactShadowMesh(0.8));

  const coatMat = new THREE.MeshStandardMaterial({
    color: 0x1e222d,
    roughness: 0.75,
    metalness: 0.1,
  });
  const beardMat = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    roughness: 0.85,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf1c27d,
    roughness: 0.6,
    metalness: 0.05,
  });

  const cajalCoat = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.45, 14), coatMat);
  cajalCoat.position.y = 0.72;
  cajalCoat.castShadow = true;
  cajalFigure.add(cajalCoat);

  const cajalHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), skinMat);
  cajalHead.position.y = 1.68;
  cajalFigure.add(cajalHead);

  const cajalBeard = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 12), beardMat);
  cajalBeard.position.set(0, 1.48, 0.16);
  cajalBeard.rotation.x = Math.PI;
  cajalFigure.add(cajalBeard);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 16), coatMat);
  hatBrim.position.y = 1.94;
  cajalFigure.add(hatBrim);

  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.38, 16), coatMat);
  hatTop.position.y = 2.14;
  cajalFigure.add(hatTop);

  // Brass Microscope on stand next to Cajal
  const standMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.0, 12), stoneMat);
  standMesh.position.set(-0.75, 0.5, 0.35);
  cajalFigure.add(standMesh);

  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.48, 12), brassMat);
  scopeTube.position.set(-0.75, 1.18, 0.35);
  scopeTube.rotation.z = 0.35;
  cajalFigure.add(scopeTube);

  group.add(cajalFigure);

  return { group, vortexRing, vortexMat, cajalFigure };
}

/**
 * Builds composite 3D pickup models for healthy items.
 */
function buildHealthyPickupGroup(subType: ItemSubType): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadowMesh(0.65));

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x059669,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.6,
  });
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 24), ringMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.08;
  group.add(baseRing);

  if (subType === 'water') {
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.25,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.72, 14), bottleMat);
    body.position.y = 0.65;
    group.add(body);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 0.22, 12), bottleMat);
    neck.position.y = 1.1;
    group.add(neck);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12), capMat);
    cap.position.y = 1.25;
    group.add(cap);
  } else if (subType === 'apple') {
    const appleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.25,
      roughness: 0.28,
      metalness: 0.1,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.5,
      metalness: 0.1,
    });
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), appleMat);
    apple.scale.set(1.05, 0.92, 1.05);
    apple.position.y = 0.7;
    group.add(apple);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 })
    );
    stem.position.y = 1.08;
    group.add(stem);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.12), leafMat);
    leaf.position.set(0.12, 1.1, 0);
    leaf.rotation.z = 0.35;
    group.add(leaf);
  } else if (subType === 'walnut') {
    const nutMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.3,
      roughness: 0.65,
      metalness: 0.15,
    });
    const leftLobe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), nutMat);
    leftLobe.scale.set(0.85, 1.05, 1.2);
    leftLobe.position.set(-0.14, 0.72, 0);
    group.add(leftLobe);

    const rightLobe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), nutMat);
    rightLobe.scale.set(0.85, 1.05, 1.2);
    rightLobe.position.set(0.14, 0.72, 0);
    group.add(rightLobe);
  } else {
    // science_book
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.5,
    });
    const pagesMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.8,
    });
    const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.78), coverMat);
    bookCover.position.y = 0.75;
    bookCover.rotation.x = 0.45;
    bookCover.rotation.y = 0.3;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.72), pagesMat);
    pages.position.x = 0.03;
    bookCover.add(pages);
    group.add(bookCover);
  }

  return group;
}

/**
 * Builds composite 3D models and ground telegraph rings for the 3 distinct hazard archetypes.
 */
function buildHazardGroup(subType: ItemSubType): {
  group: THREE.Group;
  telegraphRing: THREE.Mesh;
  telegraphMat: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  group.add(createContactShadowMesh(0.95));

  const telegraphGeo = new THREE.RingGeometry(0.85, 1.25, 28);
  telegraphGeo.rotateX(-Math.PI / 2);
  const telegraphMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(telegraphGeo, telegraphMat);
  telegraphRing.position.y = 0.03;
  group.add(telegraphRing);

  if (subType === 'tobacco_smoke') {
    // Cigarette body + glowing ember tip + 3 dark toxic smoke clouds
    const cigBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.85, 12),
      new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 })
    );
    cigBody.position.set(0, 0.55, 0);
    cigBody.rotation.z = 0.45;
    group.add(cigBody);

    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xff2200,
        emissiveIntensity: 1.4,
        roughness: 0.4,
      })
    );
    ember.position.set(-0.2, 0.92, 0);
    group.add(ember);

    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.9,
      metalness: 0.05,
    });
    const offsets = [
      [0, 1.15, 0, 0.42],
      [0.28, 1.32, 0.18, 0.34],
      [-0.25, 1.28, -0.2, 0.32],
    ];
    offsets.forEach(([ox, oy, oz, r]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), smokeMat);
      puff.position.set(ox, oy, oz);
      group.add(puff);
    });
  } else if (subType === 'junk_food') {
    // Sugary soda/junk hazard charger
    const canMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.25,
      metalness: 0.65,
    });
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.2,
      metalness: 0.9,
    });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 16), canMat);
    can.position.y = 0.65;
    group.add(can);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.08, 16), lidMat);
    lid.position.y = 1.15;
    group.add(lid);

    const sugarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.08, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 })
    );
    sugarRing.rotation.x = Math.PI / 2;
    sugarRing.position.y = 0.55;
    group.add(sugarRing);
  } else {
    // alcohol_toxin: Dark purple bottle + swirling neurotoxin rings
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x7e22ce,
      emissive: 0x581c87,
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.4,
    });
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 0.85, 16), bottleMat);
    flask.position.y = 0.58;
    group.add(flask);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.38, 12), bottleMat);
    neck.position.y = 1.15;
    group.add(neck);

    const toxinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.8,
      })
    );
    toxinRing.rotation.x = 1.2;
    toxinRing.position.y = 0.85;
    group.add(toxinRing);
  }

  return { group, telegraphRing, telegraphMat };
}

/**
 * Populates natural perimeter trees/props and level landmarks so the arena is grounded and rich.
 */
function buildLevelEnvironment(
  scene: THREE.Scene,
  level: LevelConfig,
  pathTextures: { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }
): THREE.Group {
  const envGroup = new THREE.Group();

  // Extended terrain ground (no indoor box walls)
  const groundGeo = new THREE.PlaneGeometry(180, 180);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: level.groundColor,
    roughness: 0.92,
    metalness: 0.04,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  envGroup.add(groundMesh);

  // Central Histological Cobblestone Avenue (offset by +0.02 Y to avoid Z-fighting)
  const roadGeo = new THREE.PlaneGeometry(11.5, 52);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: pathTextures.colorMap,
    bumpMap: pathTextures.bumpMap,
    bumpScale: 0.04,
    roughness: 0.82,
    metalness: 0.06,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0.02, -1);
  roadMesh.receiveShadow = true;
  envGroup.add(roadMesh);

  // Decorative Golden Axon Side Rails along the avenue
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xd4a359,
    roughness: 0.4,
    metalness: 0.65,
  });
  [-5.85, 5.85].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 52), railMat);
    rail.position.set(rx, 0.08, -1);
    rail.receiveShadow = true;
    envGroup.add(rail);
  });

  // Perimeter Dendritic Trees / Streetlamps / Columns (Composite 3-part trees)
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3525,
    roughness: 0.88,
    metalness: 0.05,
  });
  const canopyColor =
    level.environmentTheme === 'park'
      ? 0x2d6a4f
      : level.environmentTheme === 'school'
      ? 0xd97706
      : 0x4c1d95;
  const canopyMat = new THREE.MeshStandardMaterial({
    color: canopyColor,
    roughness: 0.65,
    metalness: 0.1,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const treeCoords: Array<[number, number, number]> = [
    [-11, -18, 1.15],
    [-13, -10, 0.95],
    [-10, -2, 1.08],
    [-14, 6, 1.2],
    [-11, 14, 1.0],
    [-15, 20, 1.1],
    [11, -18, 1.1],
    [13, -10, 1.0],
    [10, -2, 1.15],
    [14, 6, 0.95],
    [11, 14, 1.05],
    [15, 20, 1.2],
    [-19, -14, 1.3],
    [-20, 2, 1.25],
    [19, -14, 1.3],
    [20, 2, 1.25],
  ];

  treeCoords.forEach(([tx, tz, scale]) => {
    const tree = new THREE.Group();
    tree.position.set(tx, 0, tz);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 2.4, 10), trunkMat);
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    tree.add(trunk);

    const lowerCrown = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.6, 12), canopyMat);
    lowerCrown.position.y = 3.0;
    lowerCrown.castShadow = true;
    tree.add(lowerCrown);

    const upperCrown = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.1, 12), canopyMat);
    upperCrown.position.y = 4.3;
    upperCrown.castShadow = true;
    tree.add(upperCrown);

    // Synaptic firefly node on tree tip
    const tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lampGlowMat);
    tipLight.position.y = 5.4;
    tree.add(tipLight);

    envGroup.add(tree);
  });

  scene.add(envGroup);
  return envGroup;
}

function createParticlePool(scene: THREE.Scene): ParticlePool {
  const count = 90;
  const geo = new THREE.OctahedronGeometry(0.12, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const GoldColors = new Float32Array(count * 3);
  const lives = new Float32Array(count);
  const maxLives = new Float32Array(count);
  const scales = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    lives[i] = 0;
    maxLives[i] = 1;
    _mat4.makeScale(0, 0, 0);
    mesh.setMatrixAt(i, _mat4);
    mesh.setColorAt(i, _color.setHex(0xffd166));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  return {
    mesh,
    positions,
    velocities,
    GoldColors,
    lives,
    maxLives,
    scales,
    cursor: 0,
    count,
  };
}

function spawnParticleBurst(
  pool: ParticlePool,
  x: number,
  y: number,
  z: number,
  hexColor: number,
  burstCount = 14
): void {
  _color.setHex(hexColor);
  for (let i = 0; i < burstCount; i++) {
    const idx = pool.cursor;
    pool.cursor = (pool.cursor + 1) % pool.count;

    const i3 = idx * 3;
    pool.positions[i3] = x;
    pool.positions[i3 + 1] = y;
    pool.positions[i3 + 2] = z;

    const angle = (i / burstCount) * Math.PI * 2 + (idx % 3) * 0.2;
    const speed = 2.2 + (idx % 5) * 0.65;
    pool.velocities[i3] = Math.cos(angle) * speed;
    pool.velocities[i3 + 1] = 2.5 + (idx % 4) * 0.8;
    pool.velocities[i3 + 2] = Math.sin(angle) * speed;

    pool.lives[idx] = 0.55;
    pool.maxLives[idx] = 0.55;
    pool.scales[idx] = 1.0 + (idx % 3) * 0.3;

    pool.mesh.setColorAt(idx, _color);
  }
  if (pool.mesh.instanceColor) {
    pool.mesh.instanceColor.needsUpdate = true;
  }
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  appState,
  levelIndex,
  resetSignal,
  virtualInputRef,
  onHudUpdate,
  onStageEnd,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store mutable React props/callbacks in refs so the WebGL canvas is mounted ONCE
  const appStateRef = useRef<GameAppState>(appState);
  const levelIndexRef = useRef<number>(levelIndex);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onStageEndRef = useRef(onStageEnd);
  const rebuildStageRef = useRef<((lvlIdx: number) => void) | null>(null);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
    onStageEndRef.current = onStageEnd;
  }, [onHudUpdate, onStageEnd]);

  useEffect(() => {
    levelIndexRef.current = levelIndex;
    rebuildStageRef.current?.(levelIndex);
  }, [levelIndex, resetSignal]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      160
    );

    // Post-Processing Pipeline: RenderPass -> CognitiveFatigueShader (Single-Pass ToneMap + Grayscale Desaturation)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const fatiguePass = new ShaderPass(CognitiveFatigueShader);
    composer.addPass(fatiguePass);

    // 2. Studio Environment Reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Balanced Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x9ec5fe, 0x243b2b, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffeed6, 2.2);
    keyLight.position.set(16, 28, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    const d = 26;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-14, 12, -22);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const pathTextures = createProceduralPathTexture(maxAnisotropy);
    const particlePool = createParticlePool(scene);

    // Build Protagonist Boy
    const playerRig = buildPlayerBoyMesh();
    scene.add(playerRig.root);

    // Stage dynamic references
    let currentEnvGroup: THREE.Group | null = null;
    let currentPortalRig: ReturnType<typeof buildCajalPortalGroup> | null = null;
    let pickups: ActivePickup[] = [];
    let hazards: ActiveHazard[] = [];
    let currentLevel: LevelConfig = LEVELS[levelIndexRef.current] || LEVELS[0];
    let playerState: PlayerPhysicsState = createInitialPlayerState(currentLevel);

    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let stageElapsedTime = 0;
    let portalWasUnlocked = false;
    let cajalBannerText = currentLevel.cajalIntroQuote;
    let cajalBannerType: HudSnapshot['cajalBannerType'] = 'intro';
    let lastHudEmitTime = 0;
    let outcomeTriggered = false;
    const initialFatigue = calculateCognitiveFatigue(playerState.brainPower);
    let currentDesaturation = initialFatigue.desaturation;
    let currentVignette = initialFatigue.vignette;

    const emitHud = (force = false, nowSec = 0) => {
      if (!force && nowSec - lastHudEmitTime < 0.1) return;
      lastHudEmitTime = nowSec;
      const { fatiguePercent } = calculateCognitiveFatigue(playerState.brainPower);
      onHudUpdateRef.current({
        brainPower: Math.round(playerState.brainPower),
        cognitiveFatiguePct: fatiguePercent,
        vitality: playerState.vitality,
        maxVitality: playerState.maxVitality,
        speedModifier: playerState.speedModifier,
        activeEffectName: playerState.activeEffectName,
        effectTimer: playerState.effectTimer,
        synapsesCollected: playerState.synapsesCollected,
        hazardsHit: playerState.hazardsHit,
        score: Math.round(playerState.score),
        portalUnlocked: playerState.brainPower >= currentLevel.targetBrainPower,
        cajalBannerText,
        cajalBannerType,
        elapsedTime: stageElapsedTime,
        dashReady: playerState.dashCooldown <= 0,
      });
    };

    const buildStageEntities = (lvlIdx: number) => {
      currentLevel = LEVELS[lvlIdx] || LEVELS[0];
      playerState = createInitialPlayerState(currentLevel);
      const startFatigue = calculateCognitiveFatigue(playerState.brainPower);
      currentDesaturation = startFatigue.desaturation;
      currentVignette = startFatigue.vignette;
      fatiguePass.uniforms.uDesaturation.value = currentDesaturation;
      fatiguePass.uniforms.uVignette.value = currentVignette;
      container.dataset.desaturation = String(startFatigue.fatiguePercent);
      hitstopTimer = 0;
      cameraTrauma = 0;
      stageElapsedTime = 0;
      portalWasUnlocked = false;
      outcomeTriggered = false;
      cajalBannerText = currentLevel.cajalIntroQuote;
      cajalBannerType = 'intro';

      scene.background = new THREE.Color(currentLevel.skyColor);
      scene.fog = new THREE.FogExp2(currentLevel.fogColor, 0.015);

      if (currentEnvGroup) {
        scene.remove(currentEnvGroup);
      }
      if (currentPortalRig) {
        scene.remove(currentPortalRig.group);
      }
      pickups.forEach((p) => scene.remove(p.group));
      hazards.forEach((h) => scene.remove(h.group));
      pickups = [];
      hazards = [];

      currentEnvGroup = buildLevelEnvironment(scene, currentLevel, pathTextures);
      currentPortalRig = buildCajalPortalGroup(currentLevel.portalPosition);
      scene.add(currentPortalRig.group);

      playerRig.root.position.set(playerState.x, 0, playerState.z);
      playerRig.root.rotation.y = playerState.facingAngle;

      // Initialize camera framing immediately behind the player so frame 0 is well-composed
      camera.position.set(playerState.x * 0.55, 7.6, playerState.z + 10.2);
      camera.lookAt(playerState.x * 0.35, 1.4, playerState.z - 4.5);

      // Spawn Healthy Pickups along the avenue and side alcoves (open path guaranteed)
      const pickupLayout: Array<{ subType: ItemSubType; x: number; z: number }> = [
        { subType: 'water', x: 0, z: 16.2 },
        { subType: 'apple', x: -2.6, z: 9.5 },
        { subType: 'walnut', x: 2.6, z: 4.5 },
        { subType: 'water', x: 0, z: 0 },
        { subType: 'science_book', x: 0, z: -5.5 },
        { subType: 'apple', x: 2.8, z: -10.5 },
        { subType: 'walnut', x: -2.6, z: -14.5 },
        { subType: 'water', x: 2.4, z: 12.2 },
      ];

      pickupLayout.forEach((item, idx) => {
        const spec: CollectibleSpec = {
          id: `pickup-${idx}`,
          ...ITEM_CATALOG[item.subType],
        };
        const group = buildHealthyPickupGroup(item.subType);
        group.position.set(item.x, 0, item.z);
        scene.add(group);
        pickups.push({
          id: spec.id,
          spec,
          group,
          baseX: item.x,
          baseZ: item.z,
          bobOffset: idx * 0.9,
          respawnTimer: 0,
          active: true,
        });
      });

      // Spawn Hazards with 3 distinct movement policies and scaled difficulty per level
      const hazardConfigs: Array<{
        subType: ItemSubType;
        policy: HazardPolicy;
        x: number;
        z: number;
      }> = [
        { subType: 'tobacco_smoke', policy: 'chaser_smoke', x: -4.2, z: 9.5 },
        { subType: 'junk_food', policy: 'charger_junk', x: 4.5, z: 1.5 },
        { subType: 'alcohol_toxin', policy: 'orbiter_alcohol', x: 0, z: -9.5 },
      ];

      if (lvlIdx >= 1) {
        hazardConfigs.push({
          subType: 'junk_food',
          policy: 'charger_junk',
          x: -4.5,
          z: -4.5,
        });
      }
      if (lvlIdx >= 2) {
        hazardConfigs.push({
          subType: 'tobacco_smoke',
          policy: 'chaser_smoke',
          x: 4.2,
          z: -13.5,
        });
      }

      hazardConfigs.forEach((hCfg, idx) => {
        const spec: CollectibleSpec = {
          id: `hazard-${idx}`,
          ...ITEM_CATALOG[hCfg.subType],
        };
        const { group, telegraphRing, telegraphMat } = buildHazardGroup(hCfg.subType);
        group.position.set(hCfg.x, 0, hCfg.z);
        scene.add(group);

        hazards.push({
          id: spec.id,
          spec,
          policy: hCfg.policy,
          group,
          telegraphRing,
          telegraphMat,
          homeX: hCfg.x,
          homeZ: hCfg.z,
          x: hCfg.x,
          z: hCfg.z,
          vx: 0,
          vz: 0,
          orbitAngle: idx * 1.7,
          windupTimer: 0,
          attackActiveTimer: 0,
          cooldownTimer: 0.5,
        });
      });

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      emitHud(true, 0);
    };

    rebuildStageRef.current = buildStageEntities;
    buildStageEntities(levelIndexRef.current);

    // Unified Keyboard Input Hub (held vs edge-triggered justPressed)
    const keysHeld = new Set<string>();
    let dashJustPressed = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (appStateRef.current === 'playing') {
          e.preventDefault();
        }
      }
      if (!keysHeld.has(e.code)) {
        if (e.code === 'Space' && appStateRef.current === 'playing') {
          dashJustPressed = true;
        }
      }
      keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const clearInputs = () => {
      keysHeld.clear();
      dashJustPressed = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Software WebGL frame pacing helper per Three.js skill
    let frameId = 0;
    let unmounted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const clock = new THREE.Clock();
    const camTargetPos = new THREE.Vector3(0, 9.5, 28);
    const camLookTarget = new THREE.Vector3(0, 1.4, 12);

    function tick() {
      if (unmounted) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      const mode = appStateRef.current;

      // Update Neural Halo visual scale & brightness from BrainPower
      const bpRatio = playerState.brainPower / 100;
      const haloScale = 0.65 + bpRatio * 0.75;
      playerRig.neuralHalo.scale.setScalar(haloScale);
      playerRig.neuralHalo.rotation.y += dt * (1.2 + bpRatio * 2.5);
      playerRig.haloMat.emissiveIntensity = 0.4 + bpRatio * 1.4;

      // Animate Cajal Portal Vortex
      if (currentPortalRig) {
        const unlocked = playerState.brainPower >= currentLevel.targetBrainPower;
        currentPortalRig.vortexRing.rotation.z += dt * (unlocked ? 2.8 : 0.9);
        currentPortalRig.vortexMat.color.setHex(unlocked ? 0xffd166 : 0x38bdf8);
        currentPortalRig.vortexMat.emissive.setHex(unlocked ? 0xf59e0b : 0x0284c7);
        currentPortalRig.vortexMat.emissiveIntensity = unlocked ? 1.5 : 0.55;
      }

      if (mode === 'title') {
        // Live 3D World Camera Tour on Title Screen
        const tourAngle = elapsed * 0.22;
        camTargetPos.set(Math.sin(tourAngle) * 14, 8.5, 10 + Math.cos(tourAngle) * 12);
        camLookTarget.set(0, 1.8, -6);
        camera.position.lerp(camTargetPos, 1 - Math.exp(-3.5 * dt));
        camera.lookAt(camLookTarget);
      } else if (mode === 'playing') {
        stageElapsedTime += dt;

        // Tick hitstop freeze timer
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        } else {
          // Read keyboard + virtual touch controls
          const kRight = keysHeld.has('KeyD') || keysHeld.has('ArrowRight') ? 1 : 0;
          const kLeft = keysHeld.has('KeyA') || keysHeld.has('ArrowLeft') ? 1 : 0;
          const kDown = keysHeld.has('KeyS') || keysHeld.has('ArrowDown') ? 1 : 0;
          const kUp = keysHeld.has('KeyW') || keysHeld.has('ArrowUp') ? 1 : 0;

          const moveX = kRight - kLeft || virtualInputRef.current.moveX;
          const moveZ = kDown - kUp || virtualInputRef.current.moveZ;
          const useDash = dashJustPressed || virtualInputRef.current.dashPressed;
          dashJustPressed = false;
          virtualInputRef.current.dashPressed = false;

          if (useDash && playerState.dashCooldown <= 0) {
            soundEngine.playDash();
            spawnParticleBurst(
              particlePool,
              playerState.x,
              1.0,
              playerState.z,
              0x38bdf8,
              10
            );
          }

          playerState = stepPlayerKinematics(
            playerState,
            { moveX, moveZ, dashJustPressed: useDash },
            dt,
            { minX: -7.5, maxX: 7.5, minZ: -21.5, maxZ: 20.5 }
          );

          // Sync boy mesh position, rotation, and gait-synced limb swing
          playerRig.root.position.set(playerState.x, 0, playerState.z);
          playerRig.root.rotation.y = THREE.MathUtils.damp(
            playerRig.root.rotation.y,
            playerState.facingAngle,
            12,
            dt
          );

          const speedMag = Math.hypot(playerState.vx, playerState.vz);
          const gaitPhase = elapsed * 10;
          const swingAmp = Math.min(0.65, speedMag * 0.065);
          playerRig.leftLeg.rotation.x = Math.sin(gaitPhase) * swingAmp;
          playerRig.rightLeg.rotation.x = -Math.sin(gaitPhase) * swingAmp;
          playerRig.leftArm.rotation.x = -Math.sin(gaitPhase) * swingAmp;
          playerRig.rightArm.rotation.x = Math.sin(gaitPhase) * swingAmp;

          // Flash player jacket during post-hit invulnerability
          playerRig.bodyMat.emissive.setHex(
            playerState.invulnerableTimer > 0 && Math.floor(elapsed * 16) % 2 === 0
              ? 0xef4444
              : 0x000000
          );

          // Update Healthy Pickups & Check Collisions
          for (const item of pickups) {
            if (!item.active) {
              item.respawnTimer -= dt;
              if (item.respawnTimer <= 0) {
                item.active = true;
                item.group.visible = true;
              }
              continue;
            }
            item.group.rotation.y += dt * 1.6;
            item.group.position.y = Math.sin(elapsed * 3.0 + item.bobOffset) * 0.12;

            if (isCircleCollision(playerState.x, playerState.z, 0.85, item.baseX, item.baseZ, 0.75)) {
              const { nextState, applied } = applyItemCollision(playerState, item.spec);
              if (applied) {
                playerState = nextState;
                item.active = false;
                item.group.visible = false;
                item.respawnTimer = 6.5; // Respawns so player can always reach 100%

                cajalBannerText = item.spec.scientificNote;
                cajalBannerType = 'healthy';
                soundEngine.playHealthyPickup(playerState.brainPower);
                spawnParticleBurst(
                  particlePool,
                  item.baseX,
                  1.1,
                  item.baseZ,
                  0xffd166,
                  16
                );

                if (
                  !portalWasUnlocked &&
                  playerState.brainPower >= currentLevel.targetBrainPower
                ) {
                  portalWasUnlocked = true;
                  cajalBannerText =
                    '¡Red Neuronal al 100%! El Portal Sináptico de Cajal está activo al final del paseo.';
                  cajalBannerType = 'portal';
                  soundEngine.playPortalReady();
                }
                emitHud(true, elapsed);
              }
            }
          }

          // Update 3 Distinct Hazard Archetypes + Windup Telegraphs
          const difficultyMult = 1 + levelIndexRef.current * 0.16;
          for (const haz of hazards) {
            const distToPlayer = Math.hypot(playerState.x - haz.x, playerState.z - haz.z);

            if (haz.policy === 'chaser_smoke') {
              // Policy 1: Tobacco Smoke Chaser with windup lunging telegraph
              if (haz.windupTimer > 0) {
                haz.windupTimer -= dt;
                haz.telegraphMat.opacity = 0.75;
                haz.telegraphRing.scale.setScalar(1.25 + Math.sin(elapsed * 25) * 0.15);
                if (haz.windupTimer <= 0) {
                  haz.attackActiveTimer = 0.45;
                  const ang = Math.atan2(playerState.x - haz.x, playerState.z - haz.z);
                  haz.vx = Math.sin(ang) * 7.2 * difficultyMult;
                  haz.vz = Math.cos(ang) * 7.2 * difficultyMult;
                }
              } else if (haz.attackActiveTimer > 0) {
                haz.attackActiveTimer -= dt;
                haz.x += haz.vx * dt;
                haz.z += haz.vz * dt;
                if (haz.attackActiveTimer <= 0) {
                  haz.cooldownTimer = 1.2;
                }
              } else {
                haz.cooldownTimer = Math.max(0, haz.cooldownTimer - dt);
                haz.telegraphMat.opacity = 0.22;
                haz.telegraphRing.scale.setScalar(1.0);
                if (distToPlayer < 8.5 && haz.cooldownTimer <= 0) {
                  haz.windupTimer = 0.48; // Visible telegraph before lunging
                } else {
                  // Gentle patrol drift around home
                  const targetX = haz.homeX + Math.sin(elapsed * 1.3) * 2.2;
                  const targetZ = haz.homeZ + Math.cos(elapsed * 1.1) * 1.8;
                  haz.x = THREE.MathUtils.damp(haz.x, targetX, 3.0, dt);
                  haz.z = THREE.MathUtils.damp(haz.z, targetZ, 3.0, dt);
                }
              }
            } else if (haz.policy === 'charger_junk') {
              // Policy 2: Line-of-Sight Horizontal Lane Charger
              const zDiff = Math.abs(playerState.z - haz.z);
              if (haz.windupTimer > 0) {
                haz.windupTimer -= dt;
                haz.telegraphMat.opacity = 0.8;
                haz.telegraphRing.scale.setScalar(1.3);
                if (haz.windupTimer <= 0) {
                  haz.attackActiveTimer = 0.9;
                  const dirX = playerState.x >= haz.x ? 1 : -1;
                  haz.vx = dirX * 9.5 * difficultyMult;
                }
              } else if (haz.attackActiveTimer > 0) {
                haz.attackActiveTimer -= dt;
                haz.x = Math.max(-5.2, Math.min(5.2, haz.x + haz.vx * dt));
                if (haz.attackActiveTimer <= 0) {
                  haz.cooldownTimer = 1.1;
                }
              } else {
                haz.cooldownTimer = Math.max(0, haz.cooldownTimer - dt);
                haz.telegraphMat.opacity = 0.22;
                haz.telegraphRing.scale.setScalar(1.0);
                if (zDiff < 2.8 && haz.cooldownTimer <= 0) {
                  haz.windupTimer = 0.55; // Telegraph before lane charge
                } else {
                  haz.x = haz.homeX + Math.sin(elapsed * 1.5) * 3.2;
                }
              }
            } else {
              // Policy 3: Alcohol Toxin Figure-8 Orbiter with periodic pulse telegraph
              haz.orbitAngle += dt * 1.35 * difficultyMult;
              haz.x = haz.homeX + Math.sin(haz.orbitAngle) * 3.8;
              haz.z = haz.homeZ + Math.sin(haz.orbitAngle * 2) * 2.2;
              const pulse = 1.0 + Math.max(0, Math.sin(elapsed * 4.0)) * 0.35;
              haz.telegraphRing.scale.setScalar(pulse);
              haz.telegraphMat.opacity = 0.25 + (pulse - 1.0) * 0.9;
            }

            haz.x = Math.max(-5.4, Math.min(5.4, haz.x));
            haz.group.position.set(haz.x, 0, haz.z);
            haz.group.rotation.y += dt * 2.0;

            // Check collision with player
            if (isCircleCollision(playerState.x, playerState.z, 0.78, haz.x, haz.z, 0.75)) {
              const { nextState, applied } = applyItemCollision(playerState, haz.spec);
              if (applied) {
                playerState = nextState;
                hitstopTimer = 0.055; // 55ms simulation hitstop on heavy hazard impact
                cameraTrauma = 0.55;
                cajalBannerText = haz.spec.scientificNote;
                cajalBannerType = 'hazard';
                soundEngine.playHazardHit();
                spawnParticleBurst(particlePool, haz.x, 1.0, haz.z, 0xef4444, 20);
                emitHud(true, elapsed);
              }
            }
          }

          // Check Stage Victory / Defeat Outcome
          const outcome = evaluateStageOutcome(playerState, currentLevel);
          if (outcome !== 'playing' && !outcomeTriggered) {
            outcomeTriggered = true;
            if (outcome === 'victory') {
              soundEngine.playVictoryFanfare();
            } else {
              soundEngine.playDefeatSting();
            }
            emitHud(true, elapsed);
            const endFatigue = calculateCognitiveFatigue(playerState.brainPower);
            onStageEndRef.current(outcome, {
              brainPower: Math.round(playerState.brainPower),
              cognitiveFatiguePct: endFatigue.fatiguePercent,
              vitality: playerState.vitality,
              maxVitality: playerState.maxVitality,
              speedModifier: playerState.speedModifier,
              activeEffectName: playerState.activeEffectName,
              effectTimer: playerState.effectTimer,
              synapsesCollected: playerState.synapsesCollected,
              hazardsHit: playerState.hazardsHit,
              score: Math.round(playerState.score),
              portalUnlocked: playerState.brainPower >= currentLevel.targetBrainPower,
              cajalBannerText,
              cajalBannerType,
              elapsedTime: stageElapsedTime,
              dashReady: playerState.dashCooldown <= 0,
            });
          }
        }

        // Exponentially damped follow camera with decaying trauma shake
        cameraTrauma = Math.max(0, cameraTrauma - dt * 1.8);
        const shakeOffset = cameraTrauma * cameraTrauma * 0.45;
        const shakeX = Math.sin(elapsed * 48) * shakeOffset;
        const shakeY = Math.cos(elapsed * 54) * shakeOffset;

        camTargetPos.set(playerState.x * 0.55 + shakeX, 7.6 + shakeY, playerState.z + 10.2);
        camLookTarget.set(playerState.x * 0.35, 1.4, playerState.z - 4.5);

        const camBlend = 1 - Math.exp(-7.5 * dt);
        camera.position.lerp(camTargetPos, camBlend);
        camera.lookAt(camLookTarget);

        emitHud(false, elapsed);
      }

      // Update pooled InstancedMesh particles in-place (Zero GC)
      let anyParticleAlive = false;
      for (let i = 0; i < particlePool.count; i++) {
        if (particlePool.lives[i] > 0) {
          anyParticleAlive = true;
          particlePool.lives[i] = Math.max(0, particlePool.lives[i] - dt);
          const i3 = i * 3;
          particlePool.positions[i3] += particlePool.velocities[i3] * dt;
          particlePool.positions[i3 + 1] += particlePool.velocities[i3 + 1] * dt;
          particlePool.positions[i3 + 2] += particlePool.velocities[i3 + 2] * dt;
          particlePool.velocities[i3 + 1] -= 6.5 * dt; // Gravity

          const lifeRatio = particlePool.lives[i] / particlePool.maxLives[i];
          const s = particlePool.scales[i] * lifeRatio;
          _vec3A.set(
            particlePool.positions[i3],
            particlePool.positions[i3 + 1],
            particlePool.positions[i3 + 2]
          );
          _quat.identity();
          _scaleVec.setScalar(s);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          particlePool.mesh.setMatrixAt(i, _mat4);
        }
      }
      if (anyParticleAlive) {
        particlePool.mesh.instanceMatrix.needsUpdate = true;
      }

      // Update Post-Processing Cognitive Fatigue Desaturation Shader Uniforms
      const targetFatigue = calculateCognitiveFatigue(playerState.brainPower);
      currentDesaturation = THREE.MathUtils.damp(
        currentDesaturation,
        targetFatigue.desaturation,
        6.5,
        dt
      );
      currentVignette = THREE.MathUtils.damp(
        currentVignette,
        targetFatigue.vignette,
        6.5,
        dt
      );
      fatiguePass.uniforms.uDesaturation.value = currentDesaturation;
      fatiguePass.uniforms.uVignette.value = currentVignette;
      if (container) {
        container.dataset.desaturation = String(Math.round(currentDesaturation * 100));
      }

      composer.render();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('resize', onResize);
      composer.dispose();
      renderer.dispose();
    };
  }, [virtualInputRef]);

  return (
    <div
      ref={mountRef}
      data-testid="webgl-canvas-container"
      data-desaturation="80"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0d1117]"
    />
  );
};
