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
  computeAnimationBlendWeights,
  createInitialPlayerState,
  evaluateStageOutcome,
  isCircleCollision,
  stepPlayerKinematics,
} from '../game/rules';
import { CognitiveFatigueShader } from '../game/shaders/cognitiveFatigueShader';
import { soundEngine } from '../game/sound';
import { feelSettings } from '../engine/feel';

export type GameAppState = 'title' | 'playing' | 'paused' | 'gameover';

export interface HudSnapshot {
  brainPower: number;
  cognitiveFatiguePct: number;
  animState: 'Idle' | 'Run' | 'Hit' | 'Victory';
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
  lives: Float32Array;
  maxLives: Float32Array;
  scales: Float32Array;
  cursor: number;
  count: number;
}

interface AmbientSparkleField {
  mesh: THREE.InstancedMesh;
  basePositions: Float32Array;
  phases: Float32Array;
  count: number;
}

// Module-scope reusable scratch objects (Zero-GC in animation loop)
const _vec3A = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

let _sharedSoftShadowTex: THREE.CanvasTexture | null = null;
function getSoftContactShadowTexture(): THREE.CanvasTexture {
  if (_sharedSoftShadowTex) return _sharedSoftShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(5, 8, 14, 0.72)');
  grad.addColorStop(0.55, 'rgba(5, 8, 14, 0.28)');
  grad.addColorStop(1, 'rgba(5, 8, 14, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  _sharedSoftShadowTex = new THREE.CanvasTexture(canvas);
  return _sharedSoftShadowTex;
}

function createContactShadowMesh(radius = 0.95): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getSoftContactShadowTexture(),
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  return mesh;
}

function createProceduralPathTexture(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7d6952';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 64) {
      const offset = (y / 32) % 2 === 0 ? 0 : 32;
      ctx.fillStyle = (x + y) % 64 === 0 ? '#8c765c' : '#736049';
      ctx.strokeStyle = '#4c3e2e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect((x + offset) % 256, y + 2, 60, 28, 6);
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
  for (let i = 0; i < 450; i++) {
    const shade = 95 + ((i * 37) % 70);
    bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    bCtx.fillRect((i * 53) % 256, (i * 97) % 256, 4, 4);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 14);
  bumpMap.anisotropy = maxAnisotropy;

  return { colorMap, bumpMap, roughnessMap: bumpMap };
}

/**
 * Builds a Diegetic 3D Text Sign / Plaque directly in the 3D scene with an extruded brass frame.
 */
function buildDiegetic3DSign(
  initialText: string,
  subText: string,
  width = 4.6,
  height = 1.05
): {
  group: THREE.Group;
  updateSign: (mainText: string, secondaryText: string, accentHex: string) => void;
} {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const updateSign = (mainText: string, secondaryText: string, accentHex: string) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = '#0e131d';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(4, 4, 504, 120, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 34px "Fraunces", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(mainText, 256, 56);

    ctx.fillStyle = '#f4efe6';
    ctx.font = '600 22px "JetBrains Mono", monospace';
    ctx.fillText(secondaryText, 256, 96);
    texture.needsUpdate = true;
  };

  updateSign(initialText, subText, '#ffd166');

  // 3D Extruded Brass Frame
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4a359,
    roughness: 0.25,
    metalness: 0.85,
    clearcoat: 0.8,
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.12), frameMat);
  group.add(backing);

  const faceMat = new THREE.MeshBasicMaterial({ map: texture });
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
  faceMesh.position.z = 0.068;
  group.add(faceMesh);

  return { group, updateSign };
}

/**
 * Builds the 10-part composite 3D boy protagonist with MeshPhysicalMaterial and
 * a full THREE.AnimationMixer Blend Tree (Idle, Run, Hit, Victory).
 */
function buildPlayerBoyMesh(): {
  root: THREE.Group;
  pelvis: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  head: THREE.Mesh;
  neuralHalo: THREE.Group;
  haloMat: THREE.MeshPhysicalMaterial;
  bodyMat: THREE.MeshPhysicalMaterial;
  mixer: THREE.AnimationMixer;
  actions: {
    idle: THREE.AnimationAction;
    run: THREE.AnimationAction;
    hit: THREE.AnimationAction;
    victory: THREE.AnimationAction;
  };
} {
  const root = new THREE.Group();
  root.add(createContactShadowMesh(1.0));

  const pelvis = new THREE.Group();
  pelvis.name = 'pelvis';
  root.add(pelvis);

  const sneakerMat = new THREE.MeshPhysicalMaterial({
    color: 0xe63946,
    roughness: 0.45,
    metalness: 0.1,
    clearcoat: 0.5,
  });
  const legMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d3557,
    roughness: 0.68,
    metalness: 0.08,
  });
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a9d8f,
    roughness: 0.38,
    metalness: 0.15,
    clearcoat: 0.35,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4a261,
    roughness: 0.55,
    metalness: 0.05,
    sheen: 0.3,
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b1d12,
    roughness: 0.78,
    metalness: 0.05,
  });
  const backpackMat = new THREE.MeshPhysicalMaterial({
    color: 0xe9c46a,
    roughness: 0.28,
    metalness: 0.5,
    clearcoat: 0.65,
  });

  const legGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.7, 12);
  const shoeGeo = new THREE.BoxGeometry(0.24, 0.14, 0.36);

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.name = 'leftLeg';
  leftLeg.position.set(-0.2, 0.38, 0);
  leftLeg.castShadow = true;
  const leftShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  leftShoe.position.set(0, -0.3, 0.05);
  leftLeg.add(leftShoe);
  pelvis.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.name = 'rightLeg';
  rightLeg.position.set(0.2, 0.38, 0);
  rightLeg.castShadow = true;
  const rightShoe = new THREE.Mesh(shoeGeo, sneakerMat);
  rightShoe.position.set(0, -0.3, 0.05);
  rightLeg.add(rightShoe);
  pelvis.add(rightLeg);

  const torsoGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.82, 16);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.name = 'torso';
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;
  pelvis.add(torso);

  const packGeo = new THREE.BoxGeometry(0.48, 0.54, 0.26);
  const backpack = new THREE.Mesh(packGeo, backpackMat);
  backpack.position.set(0, 1.12, -0.34);
  backpack.castShadow = true;
  pelvis.add(backpack);

  const armGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.62, 10);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.46, 1.1, 0);
  leftArm.castShadow = true;
  pelvis.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.name = 'rightArm';
  rightArm.position.set(0.46, 1.1, 0);
  rightArm.castShadow = true;
  pelvis.add(rightArm);

  const headGeo = new THREE.SphereGeometry(0.34, 18, 16);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.name = 'head';
  head.position.set(0, 1.78, 0);
  head.castShadow = true;
  pelvis.add(head);

  const hairGeo = new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.04, -0.02);
  hair.rotation.x = -0.18;
  head.add(hair);

  // Dynamic Synaptic Neural Crown (High-Emissive PBR for Selective Bloom)
  const neuralHalo = new THREE.Group();
  neuralHalo.position.set(0, 2.34, 0);
  const haloMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd166,
    emissive: 0xffb703,
    emissiveIntensity: 1.35,
    roughness: 0.15,
    metalness: 0.85,
    clearcoat: 1.0,
  });
  const ringGeo = new THREE.TorusGeometry(0.48, 0.038, 10, 28);
  ringGeo.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, haloMat);
  neuralHalo.add(ringMesh);

  const nodeGeo = new THREE.OctahedronGeometry(0.085, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const node = new THREE.Mesh(nodeGeo, haloMat);
    node.position.set(Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.48);
    neuralHalo.add(node);
  }
  pelvis.add(neuralHalo);

  // Build THREE.AnimationMixer & 4 Skeletal Blend Tree Clips (Idle, Run, Hit, Victory)
  const mixer = new THREE.AnimationMixer(root);

  // 1. Idle Clip (subtle breathing bob & gentle arm sway)
  const idleClip = new THREE.AnimationClip('Idle', 1.6, [
    new THREE.NumberKeyframeTrack('pelvis.position[y]', [0, 0.8, 1.6], [0, 0.04, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.8, 1.6], [-0.06, 0.06, -0.06]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.8, 1.6], [0.06, -0.06, 0.06]),
    new THREE.NumberKeyframeTrack('leftLeg.rotation[x]', [0, 1.6], [0, 0]),
    new THREE.NumberKeyframeTrack('rightLeg.rotation[x]', [0, 1.6], [0, 0]),
  ]);

  // 2. Run Clip (energetic stride & opposing arm pump)
  const runClip = new THREE.AnimationClip('Run', 0.56, [
    new THREE.NumberKeyframeTrack('pelvis.position[y]', [0, 0.14, 0.28, 0.42, 0.56], [0, 0.09, 0, 0.09, 0]),
    new THREE.NumberKeyframeTrack('leftLeg.rotation[x]', [0, 0.14, 0.28, 0.42, 0.56], [0, 0.62, 0, -0.62, 0]),
    new THREE.NumberKeyframeTrack('rightLeg.rotation[x]', [0, 0.14, 0.28, 0.42, 0.56], [0, -0.62, 0, 0.62, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.14, 0.28, 0.42, 0.56], [0, -0.58, 0, 0.58, 0]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.14, 0.28, 0.42, 0.56], [0, 0.58, 0, -0.58, 0]),
  ]);

  // 3. Hit Clip (recoil stumble when impacting tobacco/alcohol hazard)
  const hitClip = new THREE.AnimationClip('Hit', 0.45, [
    new THREE.NumberKeyframeTrack('pelvis.rotation[x]', [0, 0.15, 0.45], [0, -0.32, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.2, 0.45], [0, 0.55, 0]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[z]', [0, 0.2, 0.45], [0, -0.55, 0]),
  ]);

  // 4. Victory Clip (celebratory jump & raised arms)
  const victoryClip = new THREE.AnimationClip('Victory', 0.9, [
    new THREE.NumberKeyframeTrack('pelvis.position[y]', [0, 0.45, 0.9], [0, 0.35, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.45, 0.9], [0.8, 2.5, 0.8]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[z]', [0, 0.45, 0.9], [-0.8, -2.5, -0.8]),
  ]);

  const actions = {
    idle: mixer.clipAction(idleClip),
    run: mixer.clipAction(runClip),
    hit: mixer.clipAction(hitClip),
    victory: mixer.clipAction(victoryClip),
  };

  actions.idle.play();
  actions.run.play();
  actions.hit.play();
  actions.victory.play();

  actions.idle.setEffectiveWeight(1);
  actions.run.setEffectiveWeight(0);
  actions.hit.setEffectiveWeight(0);
  actions.victory.setEffectiveWeight(0);

  return {
    root,
    pelvis,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    neuralHalo,
    haloMat,
    bodyMat,
    mixer,
    actions,
  };
}

/**
 * Builds the Synaptic Portal + Don Santiago Ramón y Cajal mentor figure + 3D Diegetic Banner.
 */
function buildCajalPortalGroup(position: { x: number; z: number }): {
  group: THREE.Group;
  vortexRing: THREE.Mesh;
  vortexMat: THREE.MeshPhysicalMaterial;
  cajalFigure: THREE.Group;
  updatePortalSign: (bp: number, unlocked: boolean) => void;
} {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4a359,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.85,
  });
  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d405b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const vortexMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.95,
    roughness: 0.12,
    metalness: 0.5,
    clearcoat: 1.0,
  });

  const baseGeo = new THREE.CylinderGeometry(3.4, 3.8, 0.32, 24);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.position.y = 0.16;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.35, 4.2, 16);
  const leftPillar = new THREE.Mesh(pillarGeo, brassMat);
  leftPillar.position.set(-2.3, 2.1, 0);
  leftPillar.castShadow = true;
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, brassMat);
  rightPillar.position.set(2.3, 2.1, 0);
  rightPillar.castShadow = true;
  group.add(rightPillar);

  const archGeo = new THREE.TorusGeometry(2.3, 0.22, 14, 32, Math.PI);
  const archMesh = new THREE.Mesh(archGeo, brassMat);
  archMesh.position.set(0, 2.1, 0);
  group.add(archMesh);

  const vortexGeo = new THREE.TorusGeometry(1.75, 0.14, 12, 32);
  const vortexRing = new THREE.Mesh(vortexGeo, vortexMat);
  vortexRing.position.set(0, 2.2, 0);
  group.add(vortexRing);

  // Diegetic 3D Sign mounted above the Portal Archway
  const portalSign = buildDiegetic3DSign('PORTAL SINÁPTICO', 'RED NEURONAL: 20% / 100%', 4.8, 1.05);
  portalSign.group.position.set(0, 5.1, 0);
  group.add(portalSign.group);

  let lastSignBp = -1;
  const updatePortalSign = (bp: number, unlocked: boolean) => {
    const rounded = Math.round(bp);
    if (rounded === lastSignBp) return;
    lastSignBp = rounded;
    if (unlocked) {
      portalSign.updateSign('¡PORTAL SINÁPTICO ACTIVO!', 'RED NEURONAL: 100% COMPLETA', '#34d399');
    } else {
      portalSign.updateSign('PORTAL SINÁPTICO DE CAJAL', `PROGRESO NEURONAL: ${rounded}% / 100%`, '#ffd166');
    }
  };

  // Don Santiago Ramón y Cajal Mentor Figure
  const cajalFigure = new THREE.Group();
  cajalFigure.position.set(3.2, 0.16, 1.1);
  cajalFigure.rotation.y = -0.45;
  cajalFigure.add(createContactShadowMesh(0.85));

  const coatMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e222d,
    roughness: 0.68,
    metalness: 0.1,
    sheen: 0.4,
  });
  const beardMat = new THREE.MeshPhysicalMaterial({
    color: 0xe5e7eb,
    roughness: 0.82,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1c27d,
    roughness: 0.55,
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

  const standMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.0, 12), stoneMat);
  standMesh.position.set(-0.75, 0.5, 0.35);
  cajalFigure.add(standMesh);

  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.48, 12), brassMat);
  scopeTube.position.set(-0.75, 1.18, 0.35);
  scopeTube.rotation.z = 0.35;
  cajalFigure.add(scopeTube);

  group.add(cajalFigure);

  return { group, vortexRing, vortexMat, cajalFigure, updatePortalSign };
}

/**
 * Builds composite 3D pickup models using MeshPhysicalMaterial (clearcoat, ior, sheen).
 */
function buildHealthyPickupGroup(subType: ItemSubType): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadowMesh(0.72));

  const ringMat = new THREE.MeshPhysicalMaterial({
    color: 0x34d399,
    emissive: 0x059669,
    emissiveIntensity: 0.75,
    roughness: 0.18,
    metalness: 0.65,
    clearcoat: 0.9,
  });
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 24), ringMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.08;
  group.add(baseRing);

  if (subType === 'water') {
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      ior: 1.33,
    });
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.6,
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
    const appleMat = new THREE.MeshPhysicalMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.3,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
    });
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: 0x22c55e,
      roughness: 0.4,
      metalness: 0.1,
      clearcoat: 0.5,
    });
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), appleMat);
    apple.scale.set(1.05, 0.92, 1.05);
    apple.position.y = 0.7;
    group.add(apple);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x5c4033, roughness: 0.85 })
    );
    stem.position.y = 1.08;
    group.add(stem);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.12), leafMat);
    leaf.position.set(0.12, 1.1, 0);
    leaf.rotation.z = 0.35;
    group.add(leaf);
  } else if (subType === 'walnut') {
    const nutMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.35,
      roughness: 0.52,
      metalness: 0.15,
      clearcoat: 0.35,
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
    // science_book (Tratado de Histología)
    const coverMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd166,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.65,
      clearcoat: 0.9,
    });
    const pagesMat = new THREE.MeshPhysicalMaterial({
      color: 0xfef3c7,
      roughness: 0.75,
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
    const cigBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.85, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xe5e7eb, roughness: 0.75 })
    );
    cigBody.position.set(0, 0.55, 0);
    cigBody.rotation.z = 0.45;
    group.add(cigBody);

    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0xff4500,
        emissive: 0xff2200,
        emissiveIntensity: 1.5,
        roughness: 0.35,
      })
    );
    ember.position.set(-0.2, 0.92, 0);
    group.add(ember);

    const smokeMat = new THREE.MeshPhysicalMaterial({
      color: 0x4b5563,
      roughness: 0.88,
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
    const canMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      roughness: 0.2,
      metalness: 0.72,
      clearcoat: 0.85,
    });
    const lidMat = new THREE.MeshPhysicalMaterial({
      color: 0xd1d5db,
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.8,
    });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 16), canMat);
    can.position.y = 0.65;
    group.add(can);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.08, 16), lidMat);
    lid.position.y = 1.15;
    group.add(lid);

    const sugarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.08, 8, 20),
      new THREE.MeshPhysicalMaterial({ color: 0xfbbf24, roughness: 0.45, clearcoat: 0.6 })
    );
    sugarRing.rotation.x = Math.PI / 2;
    sugarRing.position.y = 0.55;
    group.add(sugarRing);
  } else {
    const bottleMat = new THREE.MeshPhysicalMaterial({
      color: 0x7e22ce,
      emissive: 0x581c87,
      emissiveIntensity: 0.6,
      roughness: 0.12,
      metalness: 0.4,
      clearcoat: 0.95,
    });
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 0.85, 16), bottleMat);
    flask.position.y = 0.58;
    group.add(flask);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.38, 12), bottleMat);
    neck.position.y = 1.15;
    group.add(neck);

    const toxinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.06, 8, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.9,
      })
    );
    toxinRing.rotation.x = 1.2;
    toxinRing.position.y = 0.85;
    group.add(toxinRing);
  }

  return { group, telegraphRing, telegraphMat };
}

/**
 * Populates natural perimeter trees/props, PBR road surfaces, and a 3D Diegetic Stage Archway.
 */
function buildLevelEnvironment(
  scene: THREE.Scene,
  level: LevelConfig,
  pathTextures: {
    colorMap: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
    roughnessMap: THREE.CanvasTexture;
  }
): THREE.Group {
  const envGroup = new THREE.Group();

  const groundGeo = new THREE.PlaneGeometry(180, 180);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshPhysicalMaterial({
    color: level.groundColor,
    roughness: 0.88,
    metalness: 0.04,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  envGroup.add(groundMesh);

  // Central Histological Cobblestone Avenue with PBR Bump & Roughness Maps
  const roadGeo = new THREE.PlaneGeometry(11.5, 52);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: pathTextures.colorMap,
    bumpMap: pathTextures.bumpMap,
    bumpScale: 0.045,
    roughnessMap: pathTextures.roughnessMap,
    roughness: 0.75,
    metalness: 0.08,
    clearcoat: 0.22,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0.02, -1);
  roadMesh.receiveShadow = true;
  envGroup.add(roadMesh);

  const railMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4a359,
    roughness: 0.3,
    metalness: 0.75,
    clearcoat: 0.7,
  });
  [-5.85, 5.85].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 52), railMat);
    rail.position.set(rx, 0.08, -1);
    rail.receiveShadow = true;
    envGroup.add(rail);
  });

  const trunkMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a3525,
    roughness: 0.85,
    metalness: 0.05,
  });
  const canopyColor =
    level.environmentTheme === 'park'
      ? 0x2d6a4f
      : level.environmentTheme === 'school'
      ? 0xd97706
      : 0x4c1d95;
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: canopyColor,
    roughness: 0.58,
    metalness: 0.08,
    clearcoat: 0.25,
  });
  const lampGlowMat = new THREE.MeshPhysicalMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.25,
    roughness: 0.15,
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
    tree.add(createContactShadowMesh(1.4));

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

    const tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), lampGlowMat);
    tipLight.position.y = 5.4;
    tree.add(tipLight);

    envGroup.add(tree);
  });

  scene.add(envGroup);
  return envGroup;
}

/**
 * Ambient 3D Synaptic Sparkles (<Sparkles/> InstancedMesh equivalent) floating along the avenue.
 */
function createAmbientSparkleField(scene: THREE.Scene): AmbientSparkleField {
  const count = 48;
  const geo = new THREE.OctahedronGeometry(0.08, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe082 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const basePositions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = ((i * 73) % 100) / 10 - 5.0;
    const y = 0.6 + ((i * 31) % 30) / 10;
    const z = 16 - (i / count) * 36;
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;
    phases[i] = i * 0.7;

    _vec3A.set(x, y, z);
    _quat.identity();
    _scaleVec.setScalar(0.8);
    _mat4.compose(_vec3A, _quat, _scaleVec);
    mesh.setMatrixAt(i, _mat4);
    mesh.setColorAt(i, _color.setHex(i % 3 === 0 ? 0x38bdf8 : 0xffd166));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  return { mesh, basePositions, phases, count };
}

function createParticlePool(scene: THREE.Scene): ParticlePool {
  const count = 96;
  const geo = new THREE.OctahedronGeometry(0.13, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
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
  burstCount = 16
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
    const speed = 2.4 + (idx % 5) * 0.7;
    pool.velocities[i3] = Math.cos(angle) * speed;
    pool.velocities[i3 + 1] = 2.7 + (idx % 4) * 0.85;
    pool.velocities[i3 + 2] = Math.sin(angle) * speed;

    pool.lives[idx] = 0.6;
    pool.maxLives[idx] = 0.6;
    pool.scales[idx] = 1.05 + (idx % 3) * 0.35;

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
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      52,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      160
    );

    // Post-Processing Pipeline: RenderPass -> CognitiveFatigueShader (Selective Bloom + Desaturation + Modal DOF)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const fatiguePass = new ShaderPass(CognitiveFatigueShader);
    composer.addPass(fatiguePass);

    // HDRI-equivalent Procedural Studio Environment (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

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
    const sparkleField = createAmbientSparkleField(scene);

    // Build Protagonist Boy with AnimationMixer Blend Tree
    const playerRig = buildPlayerBoyMesh();
    scene.add(playerRig.root);

    let currentEnvGroup: THREE.Group | null = null;
    let currentPortalRig: ReturnType<typeof buildCajalPortalGroup> | null = null;
    let pickups: ActivePickup[] = [];
    let hazards: ActiveHazard[] = [];
    let currentLevel: LevelConfig = LEVELS[levelIndexRef.current] || LEVELS[0];
    let playerState: PlayerPhysicsState = createInitialPlayerState(currentLevel);

    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let bloomSurgeTimer = 0;
    let stageElapsedTime = 0;
    let portalWasUnlocked = false;
    let cajalBannerText = currentLevel.cajalIntroQuote;
    let cajalBannerType: HudSnapshot['cajalBannerType'] = 'intro';
    let lastHudEmitTime = 0;
    let outcomeTriggered = false;
    let currentAnimState: HudSnapshot['animState'] = 'Idle';

    const initialFatigue = calculateCognitiveFatigue(playerState.brainPower);
    let currentDesaturation = initialFatigue.desaturation;
    let currentVignette = initialFatigue.vignette;
    let currentBloom = initialFatigue.bloomStrength;
    let currentModalBlur = 0;

    const emitHud = (force = false, nowSec = 0) => {
      if (!force && nowSec - lastHudEmitTime < 0.1) return;
      lastHudEmitTime = nowSec;
      const { fatiguePercent } = calculateCognitiveFatigue(playerState.brainPower);
      onHudUpdateRef.current({
        brainPower: Math.round(playerState.brainPower),
        cognitiveFatiguePct: fatiguePercent,
        animState: currentAnimState,
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
      currentBloom = startFatigue.bloomStrength;
      fatiguePass.uniforms.uDesaturation.value = currentDesaturation;
      fatiguePass.uniforms.uVignette.value = currentVignette;
      fatiguePass.uniforms.uBloomStrength.value = currentBloom;
      container.dataset.desaturation = String(startFatigue.fatiguePercent);
      hitstopTimer = 0;
      cameraTrauma = 0;
      bloomSurgeTimer = 0;
      stageElapsedTime = 0;
      portalWasUnlocked = false;
      outcomeTriggered = false;
      currentAnimState = 'Idle';
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
      currentPortalRig.updatePortalSign(playerState.brainPower, false);
      scene.add(currentPortalRig.group);

      playerRig.root.position.set(playerState.x, 0, playerState.z);
      playerRig.root.rotation.y = playerState.facingAngle;

      camera.position.set(playerState.x * 0.55, 7.6, playerState.z + 10.2);
      camera.lookAt(playerState.x * 0.35, 1.4, playerState.z - 4.5);

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

      // Update Neural Halo visual scale & Selective Bloom brightness from BrainPower
      const bpRatio = playerState.brainPower / 100;
      const haloScale = 0.65 + bpRatio * 0.85;
      playerRig.neuralHalo.scale.setScalar(haloScale);
      playerRig.neuralHalo.rotation.y += dt * (1.4 + bpRatio * 2.8);
      playerRig.haloMat.emissiveIntensity = 0.6 + bpRatio * 1.8 + (bloomSurgeTimer > 0 ? 1.2 : 0);

      // Animate Cajal Portal Vortex & Diegetic 3D Sign
      if (currentPortalRig) {
        const unlocked = playerState.brainPower >= currentLevel.targetBrainPower;
        currentPortalRig.vortexRing.rotation.z += dt * (unlocked ? 2.8 : 0.9);
        currentPortalRig.vortexMat.color.setHex(unlocked ? 0xffd166 : 0x38bdf8);
        currentPortalRig.vortexMat.emissive.setHex(unlocked ? 0xf59e0b : 0x0284c7);
        currentPortalRig.vortexMat.emissiveIntensity = unlocked ? 1.85 : 0.7;
        currentPortalRig.updatePortalSign(playerState.brainPower, unlocked);
      }

      // Animate Ambient 3D Synaptic Sparkles Field
      for (let i = 0; i < sparkleField.count; i++) {
        const i3 = i * 3;
        const phase = sparkleField.phases[i] + elapsed * 2.2;
        const sx = sparkleField.basePositions[i3] + Math.sin(phase) * 0.25;
        const sy = sparkleField.basePositions[i3 + 1] + Math.cos(phase * 1.3) * 0.22;
        const sz = sparkleField.basePositions[i3 + 2];
        const pulseScale = 0.55 + (Math.sin(phase * 2.0) + 1) * 0.35;
        _vec3A.set(sx, sy, sz);
        _quat.identity();
        _scaleVec.setScalar(pulseScale);
        _mat4.compose(_vec3A, _quat, _scaleVec);
        sparkleField.mesh.setMatrixAt(i, _mat4);
      }
      sparkleField.mesh.instanceMatrix.needsUpdate = true;

      if (mode === 'title') {
        const tourAngle = elapsed * 0.22;
        camTargetPos.set(Math.sin(tourAngle) * 14, 8.5, 10 + Math.cos(tourAngle) * 12);
        camLookTarget.set(0, 1.8, -6);
        camera.position.lerp(camTargetPos, 1 - Math.exp(-3.5 * dt));
        camera.lookAt(camLookTarget);
        playerRig.mixer.update(dt);
      } else if (mode === 'playing') {
        stageElapsedTime += dt;
        bloomSurgeTimer = Math.max(0, bloomSurgeTimer - dt);

        // 50ms Hit Stop on hazard collision
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        } else {
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
            spawnParticleBurst(particlePool, playerState.x, 1.0, playerState.z, 0x38bdf8, 12);
          }

          playerState = stepPlayerKinematics(
            playerState,
            { moveX, moveZ, dashJustPressed: useDash },
            dt,
            { minX: -7.5, maxX: 7.5, minZ: -21.5, maxZ: 20.5 }
          );

          playerRig.root.position.set(playerState.x, 0, playerState.z);
          playerRig.root.rotation.y = THREE.MathUtils.damp(
            playerRig.root.rotation.y,
            playerState.facingAngle,
            12,
            dt
          );

          // Update Skeletal AnimationMixer Blend Tree (Idle, Run, Hit, Victory)
          const speedMag = Math.hypot(playerState.vx, playerState.vz);
          const isHitActive = playerState.invulnerableTimer > 0.65;
          const isVictoryActive = outcomeTriggered && playerState.brainPower >= 100;
          const blend = computeAnimationBlendWeights(
            speedMag,
            playerState.baseSpeed,
            isHitActive,
            isVictoryActive
          );
          currentAnimState = blend.dominantState;
          playerRig.actions.idle.setEffectiveWeight(blend.idle);
          playerRig.actions.run.setEffectiveWeight(blend.run);
          playerRig.actions.hit.setEffectiveWeight(blend.hit);
          playerRig.actions.victory.setEffectiveWeight(blend.victory);
          playerRig.mixer.update(dt);

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
                item.respawnTimer = 6.5;
                bloomSurgeTimer = 1.25; // High-intensity Selective Bloom surge when Neural Crown grows!

                cajalBannerText = item.spec.scientificNote;
                cajalBannerType = 'healthy';
                soundEngine.playHealthyPickup(playerState.brainPower);

                // Golden 28-particle burst on Tratado de Histología (science_book), 16 on other healthy items
                const burstCount = item.spec.subType === 'science_book' ? 28 : 16;
                spawnParticleBurst(
                  particlePool,
                  item.baseX,
                  1.15,
                  item.baseZ,
                  0xffd166,
                  burstCount
                );

                if (
                  !portalWasUnlocked &&
                  playerState.brainPower >= currentLevel.targetBrainPower
                ) {
                  portalWasUnlocked = true;
                  cajalBannerText =
                    '¡Red Neuronal al 100%! El Portal Sináptico de Cajal brilla al final del paseo.';
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
                  haz.windupTimer = 0.48;
                } else {
                  const targetX = haz.homeX + Math.sin(elapsed * 1.3) * 2.2;
                  const targetZ = haz.homeZ + Math.cos(elapsed * 1.1) * 1.8;
                  haz.x = THREE.MathUtils.damp(haz.x, targetX, 3.0, dt);
                  haz.z = THREE.MathUtils.damp(haz.z, targetZ, 3.0, dt);
                }
              }
            } else if (haz.policy === 'charger_junk') {
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
                  haz.windupTimer = 0.55;
                } else {
                  haz.x = haz.homeX + Math.sin(elapsed * 1.5) * 3.2;
                }
              }
            } else {
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

            if (isCircleCollision(playerState.x, playerState.z, 0.78, haz.x, haz.z, 0.75)) {
              const { nextState, applied } = applyItemCollision(playerState, haz.spec);
              if (applied) {
                playerState = nextState;
                hitstopTimer = 0.05; // 50ms Hit Stop before desaturation ramps up
                cameraTrauma = 0.6;
                cajalBannerText = haz.spec.scientificNote;
                cajalBannerType = 'hazard';
                soundEngine.playHazardHit();
                spawnParticleBurst(particlePool, haz.x, 1.0, haz.z, 0xef4444, 22);
                emitHud(true, elapsed);
              }
            }
          }

          // Check Stage Victory / Defeat Outcome
          const outcome = evaluateStageOutcome(playerState, currentLevel);
          if (outcome !== 'playing' && !outcomeTriggered) {
            outcomeTriggered = true;
            if (outcome === 'victory') {
              currentAnimState = 'Victory';
              soundEngine.playVictoryFanfare();
            } else {
              soundEngine.playDefeatSting();
            }
            emitHud(true, elapsed);
            const endFatigue = calculateCognitiveFatigue(playerState.brainPower);
            onStageEndRef.current(outcome, {
              brainPower: Math.round(playerState.brainPower),
              cognitiveFatiguePct: endFatigue.fatiguePercent,
              animState: currentAnimState,
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
        const shakeOffset = cameraTrauma * cameraTrauma * 0.48 * feelSettings.shakeScale; // ajuste de accesibilidad
        const shakeX = Math.sin(elapsed * 48) * shakeOffset;
        const shakeY = Math.cos(elapsed * 54) * shakeOffset;

        camTargetPos.set(playerState.x * 0.55 + shakeX, 7.6 + shakeY, playerState.z + 10.2);
        camLookTarget.set(playerState.x * 0.35, 1.4, playerState.z - 4.5);

        const camBlend = 1 - Math.exp(-7.5 * dt);
        camera.position.lerp(camTargetPos, camBlend);
        camera.lookAt(camLookTarget);

        emitHud(false, elapsed);
      }

      // Update pooled InstancedMesh burst particles in-place (Zero GC)
      let anyParticleAlive = false;
      for (let i = 0; i < particlePool.count; i++) {
        if (particlePool.lives[i] > 0) {
          anyParticleAlive = true;
          particlePool.lives[i] = Math.max(0, particlePool.lives[i] - dt);
          const i3 = i * 3;
          particlePool.positions[i3] += particlePool.velocities[i3] * dt;
          particlePool.positions[i3 + 1] += particlePool.velocities[i3 + 1] * dt;
          particlePool.positions[i3 + 2] += particlePool.velocities[i3 + 2] * dt;
          particlePool.velocities[i3 + 1] -= 6.5 * dt;

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

      // Update Post-Processing Uniforms: Desaturation + Selective Synaptic Bloom + Modal DOF Blur
      const targetFatigue = calculateCognitiveFatigue(playerState.brainPower);
      const targetBloom = targetFatigue.bloomStrength + (bloomSurgeTimer > 0 ? 0.55 : 0);
      const targetModalBlur = mode === 'paused' || mode === 'gameover' ? 0.75 : 0.0;

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
      currentBloom = THREE.MathUtils.damp(currentBloom, targetBloom, 8.0, dt);
      currentModalBlur = THREE.MathUtils.damp(currentModalBlur, targetModalBlur, 8.0, dt);

      fatiguePass.uniforms.uDesaturation.value = currentDesaturation;
      fatiguePass.uniforms.uVignette.value = currentVignette;
      fatiguePass.uniforms.uBloomStrength.value = currentBloom;
      fatiguePass.uniforms.uModalBlur.value = currentModalBlur;

      if (container) {
        container.dataset.desaturation = String(Math.round(currentDesaturation * 100));
        container.dataset.animState = currentAnimState;
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
      data-anim-state="Idle"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0d1117]"
    />
  );
};
