/**
 * sim.ts — Simulación pura del Modo Laberinto (sin Three.js ni React).
 *
 * Reglas, inspiradas en el comecocos pero un punto más difíciles:
 * - Recorres la red recogiendo vesículas de neurotransmisor. Si las recoges todas, la red se activa y pasas de nivel.
 * - Cuatro toxinas con personalidad propia te persiguen por los axones.
 * - Disparas de frente con 3 cargas que se recargan. El disparo aturde a la toxina, no la elimina.
 * - El BDNF de las esquinas te da unos segundos de poder: disparas en las cuatro direcciones
 *   y puedes neutralizar toxinas tocándolas (vuelven a la guarida).
 * - Cada nivel: red nueva, toxinas más rápidas y poder más corto.
 */
import { mulberry32 } from '../../engine/rng';
import { generateMaze, isGhostOnly, DIRS, OPP, DC, DR, type Dir, type MazeGraph } from './graph';

// ── Ajustes de dificultad (todo en un sitio) ──────────────────────────────
export const MAZE_RULES = {
  playerSpeed: 4.3, // aristas por segundo
  ghostSpeed: (level: number) => Math.min(1.02, 0.86 + 0.04 * (level - 1)), // × velocidad del jugador
  frightenedSpeed: 0.55,
  eatenSpeed: 2.2,
  powerSeconds: (level: number) => Math.max(2.5, 7 - 0.9 * (level - 1)),
  stunSeconds: (level: number) => Math.max(1.5, 3 - 0.3 * (level - 1)),
  release: [0, 2.5, 5.5, 8.5], // segundos hasta que sale cada toxina (nivel 1)
  schedule: (level: number) => (level <= 2 ? [6, 20, 5, 20, 4] : [4, 22, 3, 24, 2]), // dispersión / persecución alternas
  charges: 3,
  rechargeSeconds: 2.2,
  shotSpeed: 13,
  shotLife: 1.1,
  lives: 3,
  extraLifeEvery: 10000,
  catchDistance: 0.85,
  pelletDistance: 0.6,
  points: { pellet: 10, power: 50, stun: 30, ghost: 200, clear: 500 },
};

export type GhostKind = 'nicotina' | 'azucar' | 'alcohol' | 'insomnio';
export const GHOST_KINDS: GhostKind[] = ['nicotina', 'azucar', 'alcohol', 'insomnio'];

export interface Mover {
  from: number;
  to: number;
  t: number; // 0..1 a lo largo de la arista
  dir: Dir;
}

export type GhostMode = 'home' | 'leaving' | 'active' | 'frightened' | 'eaten';

export interface Ghost extends Mover {
  kind: GhostKind;
  mode: GhostMode;
  releaseIn: number;
  stun: number;
}

export interface Shot extends Mover {
  life: number;
}

export interface Pellet {
  x: number;
  z: number;
  power: boolean;
  eaten: boolean;
}

export type MazePhase = 'ready' | 'playing' | 'dying' | 'cleared' | 'gameover';

export type MazeEvent = 'pellet' | 'power' | 'powerEnd' | 'eat' | 'death' | 'stun' | 'shot' | 'clear' | 'extraLife' | 'gameover' | 'start';

export interface MazeState {
  level: number;
  seed: number;
  graph: MazeGraph;
  phase: MazePhase;
  phaseTimer: number;
  player: Mover & { desired: Dir; facing: Dir };
  ghosts: Ghost[];
  shots: Shot[];
  pellets: Pellet[];
  pelletsLeft: number;
  score: number;
  lives: number;
  nextExtraLife: number;
  charges: number;
  rechargeTimer: number;
  power: number; // segundos de BDNF restantes
  chain: number; // toxinas neutralizadas en este BDNF
  scheduleIdx: number;
  scheduleTimer: number;
  scattering: boolean;
  time: number;
  // estadísticas de la partida
  stuns: number;
  bestChain: number;
  events: MazeEvent[];
  rng: () => number;
  /** Dificultad de la partida (velocidad de las toxinas, duración del BDNF, puntos) */
  diff: MazeDifficulty;
  /** Premio de la pregunta de Cajal: empezar el siguiente nivel con BDNF */
  pendingPower?: boolean;
}

export interface MazeDifficulty {
  ghostSpeed: number;
  powerSeconds: number;
  scoreMult: number;
  lives: number;
}

export const DEFAULT_MAZE_DIFF: MazeDifficulty = { ghostSpeed: 1, powerSeconds: 1, scoreMult: 1, lives: MAZE_RULES.lives };

/** Segundos de BDNF de un nivel con la dificultad de la partida */
export const powerSecondsFor = (s: Pick<MazeState, 'level' | 'diff'>) => MAZE_RULES.powerSeconds(s.level) * s.diff.powerSeconds;

// ── Utilidades de movimiento ──────────────────────────────────────────────
export function moverPos(g: MazeGraph, m: Mover): { x: number; z: number } {
  const a = g.nodes[m.from], b = g.nodes[m.to];
  return { x: a.x + (b.x - a.x) * m.t, z: a.z + (b.z - a.z) * m.t };
}

const atNode = (m: Mover) => m.from === m.to;

/** ¿Puede ir desde el nodo a en la dirección d? (las toxinas pueden usar la puerta de la guarida) */
function canGo(g: MazeGraph, a: number, d: Dir, ghostDoor: boolean) {
  const b = g.nodes[a].links[d];
  if (b < 0) return false;
  if (isGhostOnly(g, a, b) && !ghostDoor) return false;
  return true;
}

/** Avanza `dist` aristas; en cada neurona pregunta a `choose` hacia dónde seguir (−1 = parar). */
function advance(g: MazeGraph, m: Mover, dist: number, choose: (node: number) => number) {
  let guard = 0;
  while (dist > 1e-6 && guard++ < 16) {
    if (atNode(m)) {
      const d = choose(m.from);
      if (d < 0) return;
      m.dir = d as Dir;
      m.to = g.nodes[m.from].links[d];
      m.t = 0;
    }
    const remaining = 1 - m.t;
    if (dist < remaining) {
      m.t += dist;
      return;
    }
    dist -= remaining;
    m.from = m.to;
    m.t = 0;
  }
}

// ── Creación de partida y de nivel ────────────────────────────────────────
function buildPellets(g: MazeGraph): Pellet[] {
  const out: Pellet[] = [];
  const skip = new Set([g.home, g.door, g.start]);
  g.nodes.forEach((n, i) => {
    if (skip.has(i)) return;
    out.push({ x: n.x, z: n.z, power: g.powers.includes(i), eaten: false });
  });
  // una vesícula a mitad de cada axón (sin duplicar, sin la puerta de la guarida)
  g.nodes.forEach((n, i) => {
    for (const d of [1, 2] as Dir[]) {
      const j = n.links[d];
      if (j < 0 || isGhostOnly(g, i, j) || j === g.home) continue;
      const m = g.nodes[j];
      out.push({ x: (n.x + m.x) / 2, z: (n.z + m.z) / 2, power: false, eaten: false });
    }
  });
  return out;
}

function resetPositions(s: MazeState) {
  const g = s.graph;
  s.player = { from: g.start, to: g.start, t: 0, dir: 3, desired: 3, facing: 3 };
  const rel = MAZE_RULES.release.map((t) => t / Math.sqrt(s.level));
  s.ghosts = GHOST_KINDS.map((kind, i) => ({
    kind,
    from: i === 0 ? g.door : g.home,
    to: i === 0 ? g.door : g.home,
    t: 0,
    dir: 0 as Dir,
    mode: i === 0 ? ('active' as GhostMode) : ('home' as GhostMode),
    releaseIn: rel[i],
    stun: 0,
  }));
  s.shots = [];
  s.power = 0;
  s.chain = 0;
  s.scheduleIdx = 0;
  s.scheduleTimer = MAZE_RULES.schedule(s.level)[0];
  s.scattering = true;
  s.phase = 'ready';
  s.phaseTimer = 2;
}

export function startLevel(s: MazeState, level: number) {
  s.level = level;
  s.graph = generateMaze(s.seed + level * 7919);
  s.pellets = buildPellets(s.graph);
  s.pelletsLeft = s.pellets.length;
  s.charges = MAZE_RULES.charges;
  s.rechargeTimer = 0;
  resetPositions(s);
  if (s.pendingPower) {
    s.pendingPower = false;
    grantPower(s);
  }
}

export function createMazeGame(seed = (Math.random() * 2 ** 31) | 0, diff: MazeDifficulty = DEFAULT_MAZE_DIFF): MazeState {
  const s = {
    level: 1,
    seed,
    score: 0,
    diff,
    lives: diff.lives,
    nextExtraLife: MAZE_RULES.extraLifeEvery,
    time: 0,
    stuns: 0,
    bestChain: 0,
    events: [],
    rng: mulberry32(seed),
  } as unknown as MazeState;
  startLevel(s, 1);
  s.events.push('start');
  return s;
}

/** Ayuda por acertar una pregunta de Cajal: BDNF al empezar el nivel siguiente */
export function grantPower(s: MazeState) {
  s.power = powerSecondsFor(s);
  s.chain = 0;
  for (const gh of s.ghosts) if (gh.mode === 'active') gh.mode = 'frightened';
}

// ── IA de las toxinas ─────────────────────────────────────────────────────
function playerNode(s: MazeState) {
  const p = s.player;
  return p.t < 0.5 ? p.from : p.to;
}

function ghostTarget(s: MazeState, gh: Ghost): { c: number; r: number } {
  const g = s.graph;
  const pn = g.nodes[playerNode(s)];
  const corner = {
    nicotina: { c: g.cols, r: -2 },
    azucar: { c: -1, r: -2 },
    alcohol: { c: g.cols, r: g.rows + 1 },
    insomnio: { c: -1, r: g.rows + 1 },
  }[gh.kind];
  if (s.scattering) return corner;
  switch (gh.kind) {
    case 'nicotina': // te persigue directamente
      return { c: pn.c, r: pn.r };
    case 'azucar': // te corta el paso: apunta dos neuronas por delante de ti
      return { c: pn.c + DC[s.player.dir] * 2, r: pn.r + DR[s.player.dir] * 2 };
    case 'alcohol': // persigue, pero tambalea (ver chooseGhostDir)
      return { c: pn.c, r: pn.r };
    case 'insomnio': { // te persigue de lejos; de cerca se aparta a su esquina
      const me = g.nodes[gh.from];
      const far = Math.hypot(me.c - pn.c, me.r - pn.r) > 4;
      return far ? { c: pn.c, r: pn.r } : corner;
    }
  }
}

function chooseGhostDir(s: MazeState, gh: Ghost, node: number): number {
  const g = s.graph;
  const door = gh.mode === 'leaving' || gh.mode === 'eaten';
  let opts = DIRS.filter((d) => canGo(g, node, d, door));
  // no puede volver a entrar en la guarida salvo que vuelva neutralizada
  if (gh.mode !== 'eaten') opts = opts.filter((d) => g.nodes[node].links[d] !== g.home);
  const noReverse = opts.filter((d) => d !== OPP[gh.dir]);
  if (noReverse.length) opts = noReverse;
  if (!opts.length) return -1;

  if (gh.mode === 'frightened' || (gh.kind === 'alcohol' && gh.mode === 'active' && !s.scattering && s.rng() < 0.45)) {
    return opts[Math.floor(s.rng() * opts.length)];
  }
  let target: { c: number; r: number };
  if (gh.mode === 'eaten') target = g.nodes[g.home];
  else if (gh.mode === 'leaving') target = g.nodes[g.door];
  else target = ghostTarget(s, gh);
  // regla clásica: el vecino más cercano al objetivo (desempate: arriba, izquierda, abajo, derecha)
  const order: Dir[] = [0, 3, 2, 1];
  let best = -1, bestD = Infinity;
  for (const d of order) {
    if (!opts.includes(d)) continue;
    const n = g.nodes[g.nodes[node].links[d]];
    const dist = (n.c - target.c) ** 2 + (n.r - target.r) ** 2;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

// ── Disparo ───────────────────────────────────────────────────────────────
function fire(s: MazeState) {
  if (s.charges <= 0) return;
  const g = s.graph, p = s.player;
  const dirs: Dir[] = s.power > 0 ? [0, 1, 2, 3] : [p.facing];
  let fired = false;
  for (const d of dirs) {
    let m: Mover | null = null;
    if (atNode(p)) {
      if (canGo(g, p.from, d, false)) m = { from: p.from, to: g.nodes[p.from].links[d], t: 0, dir: d };
    } else if (d === p.dir) m = { from: p.from, to: p.to, t: p.t, dir: d };
    else if (d === OPP[p.dir]) m = { from: p.to, to: p.from, t: 1 - p.t, dir: d };
    if (m) { s.shots.push({ ...m, life: MAZE_RULES.shotLife }); fired = true; }
  }
  if (fired) {
    s.charges--;
    if (s.rechargeTimer <= 0) s.rechargeTimer = MAZE_RULES.rechargeSeconds;
    s.events.push('shot');
  }
}

function addScore(s: MazeState, pts: number) {
  s.score += Math.round(pts * s.diff.scoreMult);
  if (s.score >= s.nextExtraLife) {
    s.lives++;
    s.nextExtraLife += MAZE_RULES.extraLifeEvery;
    s.events.push('extraLife');
  }
}

// ── Paso de simulación ────────────────────────────────────────────────────
export interface MazeInput {
  dir: Dir | null; // dirección deseada (se recuerda hasta que se puede tomar)
  fire: boolean;
}

export function stepMaze(s: MazeState, input: MazeInput, dt: number) {
  const g = s.graph;
  const R = MAZE_RULES;
  s.time += dt;
  if (input.dir !== null) s.player.desired = input.dir;

  if (s.phase === 'gameover') return;
  if (s.phase !== 'playing') {
    s.phaseTimer -= dt;
    if (s.phaseTimer > 0) return;
    if (s.phase === 'ready') s.phase = 'playing';
    else if (s.phase === 'dying') {
      if (s.lives <= 0) { s.phase = 'gameover'; s.events.push('gameover'); return; }
      resetPositions(s);
      return;
    } else if (s.phase === 'cleared') { startLevel(s, s.level + 1); return; }
  }

  // ── Jugador ──
  const p = s.player;
  if (!atNode(p) && p.desired === OPP[p.dir]) {
    // media vuelta en cualquier punto del axón
    [p.from, p.to] = [p.to, p.from];
    p.t = 1 - p.t;
    p.dir = p.desired;
  }
  const pSpeed = R.playerSpeed * (s.power > 0 ? 1.05 : 1);
  advance(g, p, pSpeed * dt, (node) => {
    if (canGo(g, node, p.desired, false)) return p.desired;
    if (canGo(g, node, p.dir, false)) return p.dir;
    return -1;
  });
  if (!atNode(p)) p.facing = p.dir;
  else if (canGo(g, p.from, p.desired, false)) p.facing = p.desired;

  // ── Cargas y disparo ──
  if (s.charges < R.charges) {
    s.rechargeTimer -= dt;
    if (s.rechargeTimer <= 0) {
      s.charges++;
      s.rechargeTimer = s.charges < R.charges ? R.rechargeSeconds : 0;
    }
  }
  if (input.fire) fire(s);

  // ── Vesículas y BDNF ──
  const pp = moverPos(g, p);
  for (const pe of s.pellets) {
    if (pe.eaten || Math.abs(pe.x - pp.x) > R.pelletDistance || Math.abs(pe.z - pp.z) > R.pelletDistance) continue;
    pe.eaten = true;
    s.pelletsLeft--;
    if (pe.power) {
      addScore(s, R.points.power);
      s.power = powerSecondsFor(s);
      s.chain = 0;
      for (const gh of s.ghosts) if (gh.mode === 'active') { gh.mode = 'frightened'; if (!atNode(gh)) { [gh.from, gh.to] = [gh.to, gh.from]; gh.t = 1 - gh.t; gh.dir = OPP[gh.dir]; } }
      s.events.push('power');
    } else {
      addScore(s, R.points.pellet);
      s.events.push('pellet');
    }
  }
  if (s.pelletsLeft <= 0) {
    addScore(s, R.points.clear * s.level);
    s.phase = 'cleared';
    s.phaseTimer = 2.5;
    s.events.push('clear');
    return;
  }

  // ── Fases de dispersión / persecución (se congelan durante el BDNF) ──
  if (s.power > 0) {
    s.power -= dt;
    if (s.power <= 0) {
      s.power = 0;
      for (const gh of s.ghosts) if (gh.mode === 'frightened') gh.mode = 'active';
      s.events.push('powerEnd');
    }
  } else {
    s.scheduleTimer -= dt;
    if (s.scheduleTimer <= 0) {
      const sch = R.schedule(s.level);
      s.scheduleIdx++;
      s.scattering = s.scheduleIdx % 2 === 0;
      s.scheduleTimer = s.scheduleIdx < sch.length ? sch[s.scheduleIdx] : Infinity;
      // al cambiar de fase, las toxinas dan media vuelta (aviso visual para el jugador)
      for (const gh of s.ghosts) if (gh.mode === 'active' && !atNode(gh)) { [gh.from, gh.to] = [gh.to, gh.from]; gh.t = 1 - gh.t; gh.dir = OPP[gh.dir]; }
    }
  }

  // ── Toxinas ──
  const base = R.playerSpeed * R.ghostSpeed(s.level) * s.diff.ghostSpeed;
  for (const gh of s.ghosts) {
    if (gh.stun > 0) { gh.stun -= dt; continue; }
    if (gh.mode === 'home') {
      gh.releaseIn -= dt;
      if (gh.releaseIn <= 0) gh.mode = 'leaving';
      continue;
    }
    const speed = gh.mode === 'eaten' ? R.playerSpeed * R.eatenSpeed : gh.mode === 'frightened' ? R.playerSpeed * R.frightenedSpeed : gh.mode === 'leaving' ? base * 0.6 : base;
    advance(g, gh, speed * dt, (node) => {
      if (gh.mode === 'leaving' && node === g.door) gh.mode = s.power > 0 ? 'frightened' : 'active';
      if (gh.mode === 'eaten' && node === g.home) {
        gh.mode = 'home';
        gh.releaseIn = 1.5;
        return -1;
      }
      return chooseGhostDir(s, gh, node);
    });
  }

  // ── Disparos ──
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const sh = s.shots[i];
    sh.life -= dt;
    let dead = sh.life <= 0;
    advance(g, sh, R.shotSpeed * dt, (node) => (canGo(g, node, sh.dir, false) ? sh.dir : -1));
    if (atNode(sh) && !canGo(g, sh.from, sh.dir, false)) dead = true; // choca con el final del axón
    const sp = moverPos(g, sh);
    for (const gh of s.ghosts) {
      if (gh.mode === 'home' || gh.mode === 'eaten' || gh.stun > 0) continue;
      const gp = moverPos(g, gh);
      if (Math.hypot(gp.x - sp.x, gp.z - sp.z) < 0.75) {
        gh.stun = R.stunSeconds(s.level);
        s.stuns++;
        addScore(s, R.points.stun);
        s.events.push('stun');
        dead = true;
        break;
      }
    }
    if (dead) s.shots.splice(i, 1);
  }

  // ── Choques jugador ↔ toxinas ──
  const pnow = moverPos(g, p);
  for (const gh of s.ghosts) {
    if (gh.mode === 'home' || gh.mode === 'eaten' || gh.mode === 'leaving') continue;
    const gp = moverPos(g, gh);
    if (Math.hypot(gp.x - pnow.x, gp.z - pnow.z) > R.catchDistance) continue;
    if (gh.mode === 'frightened') {
      gh.mode = 'eaten';
      gh.stun = 0;
      addScore(s, R.points.ghost * 2 ** s.chain);
      s.chain++;
      s.bestChain = Math.max(s.bestChain, s.chain);
      s.events.push('eat');
    } else if (gh.stun <= 0) {
      s.lives--;
      s.phase = 'dying';
      s.phaseTimer = 1.6;
      s.events.push('death');
      return;
    }
  }
}
