/**
 * MazeScene.tsx — Escena 3D del Modo Laberinto.
 *
 * La simulación (sim.ts) avanza aquí mismo, en el useFrame, con pasos de como mucho 1/60 s
 * que se adaptan al refresco de la pantalla: el movimiento no va con retraso ni a tirones.
 * La red se «enciende» a medida que el jugador recoge las vesículas: cada axón y cada neurona
 * pasan de apagados a brillantes.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { stepMaze, moverPos, type MazeState, type MazeInput, type GhostKind } from '../../game/maze/sim';
import { isGhostOnly, type MazeGraph } from '../../game/maze/graph';
import { NeuralNetwork } from '../../components/3d/NeuralNetwork';

export const GHOST_COLORS: Record<GhostKind, string> = {
  nicotina: '#c3b4e6',
  azucar: '#ff9f5a',
  alcohol: '#ff6b6b',
  insomnio: '#6f8cff',
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);
/** cono tumbado: apunta a +Z antes de girarlo */
const ARROW_GEO = new THREE.ConeGeometry(0.16, 0.36, 12).rotateX(Math.PI / 2);
const AXON_OFF = new THREE.Color(0.12, 0.28, 0.42);
const AXON_ON = new THREE.Color(0.5, 2.2, 2.8); // HDR → bloom
const SOMA_OFF = new THREE.Color(0.18, 0.36, 0.5);
const SOMA_ON = new THREE.Color(1.6, 3.2, 3.6);

// ── Simulación dentro del bucle de render ─────────────────────────────────
function SimDriver({ state, input, paused, onEvents }: {
  state: React.MutableRefObject<MazeState>;
  input: React.MutableRefObject<MazeInput & { fireQueued: boolean }>;
  paused: React.MutableRefObject<boolean>;
  onEvents: (ev: string[]) => void;
}) {
  useFrame((_, delta) => {
    if (paused.current) return;
    let remaining = Math.min(delta, 0.1);
    const s = state.current;
    while (remaining > 1e-5) {
      const h = Math.min(remaining, 1 / 60);
      stepMaze(s, { dir: input.current.dir, fire: input.current.fireQueued }, h);
      input.current.fireQueued = false;
      remaining -= h;
    }
    if (s.events.length) {
      onEvents(s.events.slice());
      s.events.length = 0;
    }
  }, -1);
  return null;
}

// ── Cámara: encuadra toda la red, dejando sitio al HUD ────────────────────
function FitCamera({ graph, shake }: { graph: MazeGraph; shake: React.MutableRefObject<number> }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useFrame((st, dt) => {
    const w = (graph.cols - 1) * graph.spacing + 3;
    const h = (graph.rows - 1) * graph.spacing + 3;
    const aspect = size.width / size.height;
    // margen para el HUD: arriba en todas, abajo también en pantallas táctiles estrechas
    const hudFrac = aspect < 0.8 ? 0.6 : 0.84;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    // el margen del HUD solo se reserva en vertical; en el ancho basta un pequeño borde
    const needH = Math.max(h / hudFrac, w / aspect / 0.96);
    const dist = needH / 2 / Math.tan(vfov / 2);
    shake.current = Math.max(0, shake.current - dt * 2.2);
    const k = shake.current * shake.current * 0.5;
    const t = st.clock.elapsedTime * 40;
    camera.position.set(Math.sin(t) * k, dist, dist * 0.16 + Math.cos(t * 1.3) * k);
    camera.lookAt(0, 0, aspect < 0.8 ? 0.4 : 0);
    camera.updateProjectionMatrix();
  });
  return null;
}

// ── Red: axones, neuronas y vesículas (se reconstruye en cada nivel) ──────
function Board({ state }: { state: React.MutableRefObject<MazeState> }) {
  const s = state.current;
  const g = s.graph;
  const axons = useRef<THREE.InstancedMesh>(null!);
  const somas = useRef<THREE.InstancedMesh>(null!);
  const pellets = useRef<THREE.InstancedMesh>(null!);
  const powers = useRef<THREE.InstancedMesh>(null!);
  const lastLeft = useRef(-1);

  /** Aristas jugables y, para cada una, la vesícula de su punto medio */
  const layout = useMemo(() => {
    const edges: { a: number; b: number; pellet: number }[] = [];
    const nodePellet = new Map<number, number>();
    s.pellets.forEach((p, i) => {
      const n = g.nodes.findIndex((nd) => nd.x === p.x && nd.z === p.z);
      if (n >= 0) nodePellet.set(n, i);
    });
    g.nodes.forEach((n, i) => {
      for (const d of [1, 2] as const) {
        const j = n.links[d];
        if (j < 0) continue;
        const m = g.nodes[j];
        const pellet = s.pellets.findIndex((p) => Math.abs(p.x - (n.x + m.x) / 2) < 1e-6 && Math.abs(p.z - (n.z + m.z) / 2) < 1e-6);
        edges.push({ a: i, b: j, pellet });
      }
    });
    const normal = s.pellets.map((p, i) => ({ p, i })).filter((x) => !x.p.power);
    const power = s.pellets.map((p, i) => ({ p, i })).filter((x) => x.p.power);
    return { edges, nodePellet, normal, power };
  }, [g, s.pellets]);

  // Colocación inicial
  useEffect(() => {
    layout.edges.forEach((e, k) => {
      const a = g.nodes[e.a], b = g.nodes[e.b];
      _v.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      const horizontal = a.z === b.z;
      _q.setFromAxisAngle(new THREE.Vector3(horizontal ? 0 : 1, 0, horizontal ? 1 : 0), Math.PI / 2);
      const door = isGhostOnly(g, e.a, e.b);
      _s.set(door ? 0.5 : 1, g.spacing, door ? 0.5 : 1);
      axons.current.setMatrixAt(k, _m.compose(_v, _q, _s));
      axons.current.setColorAt(k, door ? new THREE.Color(1.2, 0.4, 0.4) : AXON_OFF);
    });
    g.nodes.forEach((n, i) => {
      _v.set(n.x, 0, n.z);
      _q.identity();
      _s.setScalar(i === g.home ? 1.6 : 1);
      somas.current.setMatrixAt(i, _m.compose(_v, _q, _s));
      somas.current.setColorAt(i, i === g.home ? new THREE.Color(0.9, 0.3, 0.35) : SOMA_OFF);
    });
    for (const mesh of [axons.current, somas.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    lastLeft.current = -1;
  }, [g, layout]);

  useFrame((st) => {
    const time = st.clock.elapsedTime;
    // Vesículas: solo las que quedan; el BDNF late
    layout.normal.forEach(({ p }, k) => {
      _v.set(p.x, 0.3, p.z);
      _s.setScalar(p.eaten ? 0 : 1);
      pellets.current.setMatrixAt(k, _m.compose(_v, _q.identity(), _s));
    });
    pellets.current.instanceMatrix.needsUpdate = true;
    layout.power.forEach(({ p }, k) => {
      _v.set(p.x, 0.35, p.z);
      _s.setScalar(p.eaten ? 0 : 1 + Math.sin(time * 6 + k) * 0.18);
      powers.current.setMatrixAt(k, _m.compose(_v, _q.identity(), _s));
    });
    powers.current.instanceMatrix.needsUpdate = true;

    // La red se enciende al recoger
    if (state.current.pelletsLeft !== lastLeft.current) {
      lastLeft.current = state.current.pelletsLeft;
      const P = state.current.pellets;
      layout.edges.forEach((e, k) => {
        if (isGhostOnly(g, e.a, e.b)) return;
        const on = e.pellet >= 0 ? P[e.pellet].eaten : false;
        axons.current.setColorAt(k, on ? AXON_ON : AXON_OFF);
      });
      layout.nodePellet.forEach((pi, n) => somas.current.setColorAt(n, P[pi].eaten ? SOMA_ON : SOMA_OFF));
      if (axons.current.instanceColor) axons.current.instanceColor.needsUpdate = true;
      if (somas.current.instanceColor) somas.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={axons} args={[undefined, undefined, layout.edges.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={somas} args={[undefined, undefined, g.nodes.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.26, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pellets} args={[undefined, undefined, Math.max(1, layout.normal.length)]} frustumCulled={false}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={[3.2, 2.5, 0.8]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={powers} args={[undefined, undefined, Math.max(1, layout.power.length)]} frustumCulled={false}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshBasicMaterial color={[4, 3.2, 1]} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ── Jugador: impulso nervioso con estela y flecha de disparo ──────────────
function PlayerBall({ state }: { state: React.MutableRefObject<MazeState> }) {
  const ball = useRef<THREE.Mesh>(null!);
  const arrow = useRef<THREE.Mesh>(null!);
  const trail = useRef<THREE.InstancedMesh>(null!);
  const hist = useRef<THREE.Vector3[]>(Array.from({ length: 8 }, () => new THREE.Vector3()));
  const mat = useRef<THREE.MeshBasicMaterial>(null!);

  useFrame((st) => {
    const s = state.current;
    const p = moverPos(s.graph, s.player);
    const dying = s.phase === 'dying';
    ball.current.position.set(p.x, 0.45, p.z);
    const sc = dying ? Math.max(0.01, s.phaseTimer / 1.6) : 1 + Math.sin(st.clock.elapsedTime * 10) * 0.05;
    ball.current.scale.setScalar(sc);
    mat.current.color.setRGB(s.power > 0 ? 4 : 1.4, s.power > 0 ? 3.4 : 3.6, s.power > 0 ? 1.4 : 4.4);
    // flecha: hacia dónde dispararás
    const f = s.player.facing;
    const fx = [0, 1, 0, -1][f], fz = [-1, 0, 1, 0][f];
    arrow.current.visible = !dying && s.power <= 0;
    arrow.current.position.set(p.x + fx * 0.72, 0.45, p.z + fz * 0.72);
    arrow.current.rotation.set(0, Math.atan2(fx, fz), 0);
    // estela
    const h = hist.current;
    const last = h.pop()!; // se reutiliza: sin crear objetos cada frame
    h.unshift(last.set(p.x, 0.45, p.z));
    h.forEach((v, i) => {
      _s.setScalar(dying ? 0 : 0.8 - i * 0.09);
      trail.current.setMatrixAt(i, _m.compose(v, _q.identity(), _s));
    });
    trail.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh ref={ball}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial ref={mat} toneMapped={false} />
      </mesh>
      <mesh ref={arrow} geometry={ARROW_GEO}>
        <meshBasicMaterial color={[2.4, 3.6, 4]} toneMapped={false} />
      </mesh>
      <instancedMesh ref={trail} args={[undefined, undefined, 8]} frustumCulled={false}>
        <sphereGeometry args={[0.32, 10, 10]} />
        <meshBasicMaterial color={[0.6, 1.8, 2.4]} transparent opacity={0.28} toneMapped={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ── Toxinas: cuerpo de color, ojos que miran hacia donde van ──────────────
function GhostMesh({ state, index }: { state: React.MutableRefObject<MazeState>; index: number }) {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const pupils = useRef<THREE.Group>(null!);
  const base = useMemo(() => new THREE.Color(GHOST_COLORS[state.current.ghosts[index].kind]).multiplyScalar(1.6), [state, index]);

  useFrame((st) => {
    const s = state.current;
    const gh = s.ghosts[index];
    const p = moverPos(s.graph, gh);
    const t = st.clock.elapsedTime;
    group.current.position.set(p.x, 0.45, p.z);
    group.current.visible = s.phase !== 'dying' || s.phaseTimer > 1.2;
    body.current.visible = gh.mode !== 'eaten';
    body.current.scale.set(1, 0.9 + Math.sin(t * 8 + index) * 0.06, 1);
    if (gh.stun > 0) {
      _c.setRGB(0.5, 0.5, 0.55);
      group.current.rotation.y = t * 9;
    } else if (gh.mode === 'frightened') {
      const blink = s.power < 2 && Math.floor(t * 8) % 2 === 0;
      _c.setRGB(blink ? 2.4 : 0.3, blink ? 2.4 : 0.6, blink ? 2.4 : 2.2);
      group.current.rotation.y = 0;
    } else {
      _c.copy(base);
      group.current.rotation.y = 0;
    }
    mat.current.color.copy(_c);
    const dx = [0, 1, 0, -1][gh.dir], dz = [-1, 0, 1, 0][gh.dir];
    pupils.current.position.set(dx * 0.06, 0, dz * 0.06);
  });

  return (
    <group ref={group}>
      <mesh ref={body}>
        <sphereGeometry args={[0.44, 20, 16]} />
        <meshBasicMaterial ref={mat} toneMapped={false} />
      </mesh>
      {/* ojos (siempre visibles: también cuando vuelve a la guarida) */}
      {[-0.15, 0.15].map((ox) => (
        <mesh key={ox} position={[ox, 0.3, 0.12]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <group ref={pupils}>
        {[-0.15, 0.15].map((ox) => (
          <mesh key={ox} position={[ox, 0.4, 0.14]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshBasicMaterial color="#10131c" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Shots({ state }: { state: React.MutableRefObject<MazeState> }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useFrame(() => {
    const s = state.current;
    let k = 0;
    for (const sh of s.shots) {
      const p = moverPos(s.graph, sh);
      _v.set(p.x, 0.45, p.z);
      const horizontal = sh.dir === 1 || sh.dir === 3;
      _q.setFromAxisAngle(Y, horizontal ? Math.PI / 2 : 0);
      _s.set(1, 1, 1);
      mesh.current.setMatrixAt(k++, _m.compose(_v, _q, _s));
    }
    mesh.current.count = k;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 16]} frustumCulled={false}>
      <boxGeometry args={[0.16, 0.16, 0.7]} />
      <meshBasicMaterial color={[4, 2.6, 0.6]} toneMapped={false} />
    </instancedMesh>
  );
}

export function MazeScene({ state, input, paused, onEvents, shake, level, reducedFlashes }: {
  state: React.MutableRefObject<MazeState>;
  input: React.MutableRefObject<MazeInput & { fireQueued: boolean }>;
  paused: React.MutableRefObject<boolean>;
  onEvents: (ev: string[]) => void;
  shake: React.MutableRefObject<number>;
  /** cambia en cada nivel para reconstruir la red */
  level: string;
  reducedFlashes: boolean;
}) {
  return (
    <Canvas flat dpr={[1, 1.75]} gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }} camera={{ fov: 40, near: 0.5, far: 200 }} style={{ background: '#03070d' }}>
      <SimDriver state={state} input={input} paused={paused} onEvents={onEvents} />
      <FitCamera graph={state.current.graph} shake={shake} key={`cam-${level}`} />
      <NeuralNetwork />
      <Board state={state} key={`board-${level}`} />
      <PlayerBall state={state} />
      {[0, 1, 2, 3].map((i) => (
        <GhostMesh key={`${level}-${i}`} state={state} index={i} />
      ))}
      <Shots state={state} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={reducedFlashes ? 0.7 : 1.1} radius={0.65} />
        <Vignette offset={0.3} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
