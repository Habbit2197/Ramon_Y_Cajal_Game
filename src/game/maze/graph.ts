/**
 * graph.ts — Red neuronal del Modo Laberinto.
 *
 * Las neuronas son nodos en una cuadrícula y los axones son las aristas que las unen.
 * Cada nivel genera una red nueva (con semilla, así se puede reproducir):
 *  1. árbol aleatorio en la mitad izquierda, reflejado a la derecha (simetría, como el comecocos);
 *  2. se eliminan los callejones sin salida (nadie queda atrapado);
 *  3. se añaden algunos atajos para formar circuitos, evitando cuadraditos 1×1;
 *  4. en el centro está la guarida de las toxinas, unida solo por arriba y cerrada al jugador.
 */
import { mulberry32 } from '../../engine/rng';

/** 0 arriba, 1 derecha, 2 abajo, 3 izquierda */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: Dir[] = [0, 1, 2, 3];
export const OPP: Record<Dir, Dir> = { 0: 2, 1: 3, 2: 0, 3: 1 };
export const DC = [0, 1, 0, -1];
export const DR = [-1, 0, 1, 0];

export interface MazeNode {
  c: number;
  r: number;
  x: number;
  z: number;
  /** índice del vecino en cada dirección, o -1 */
  links: [number, number, number, number];
}

export interface MazeGraph {
  cols: number;
  rows: number;
  /** distancia entre neuronas en unidades del mundo */
  spacing: number;
  nodes: MazeNode[];
  home: number; // guarida de las toxinas
  door: number; // neurona justo encima de la guarida
  start: number; // salida del jugador
  powers: number[]; // esquinas con BDNF
}

export const MAZE_COLS = 9;
export const MAZE_ROWS = 11;
export const SPACING = 2.2;

export const nodeIndex = (g: { cols: number }, c: number, r: number) => r * g.cols + c;

/** ¿La arista home↔door? Solo la usan las toxinas. */
export const isGhostOnly = (g: MazeGraph, a: number, b: number) =>
  (a === g.home && b === g.door) || (a === g.door && b === g.home);

export function generateMaze(seed: number, cols = MAZE_COLS, rows = MAZE_ROWS, spacing = SPACING): MazeGraph {
  const rng = mulberry32(seed);
  const half = Math.floor(cols / 2);
  const idx = (c: number, r: number) => r * cols + c;
  const nodes: MazeNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      nodes.push({ c, r, x: (c - (cols - 1) / 2) * spacing, z: (r - (rows - 1) / 2) * spacing, links: [-1, -1, -1, -1] });

  const home = idx(half, Math.floor(rows / 2));
  const door = idx(half, Math.floor(rows / 2) - 1);
  const start = idx(half, rows - 3);

  const inGrid = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows;
  const linked = (a: number, d: Dir) => nodes[a].links[d] >= 0;
  const link = (a: number, d: Dir) => {
    const n = nodes[a];
    const b = idx(n.c + DC[d], n.r + DR[d]);
    n.links[d] = b;
    nodes[b].links[OPP[d]] = a;
  };
  /** Une a con su vecino en la dirección d y hace lo mismo en el lado reflejado. */
  const linkMirrored = (a: number, d: Dir) => {
    link(a, d);
    const n = nodes[a];
    const md: Dir = d === 1 ? 3 : d === 3 ? 1 : d;
    link(idx(cols - 1 - n.c, n.r), md);
  };
  const neighbor = (a: number, d: Dir) => {
    const n = nodes[a];
    const c = n.c + DC[d], r = n.r + DR[d];
    return inGrid(c, r) ? idx(c, r) : -1;
  };
  const degree = (a: number) => nodes[a].links.filter((x) => x >= 0).length;
  /** ¿Unir a→d cerraría un cuadradito 1×1? */
  const makesSquare = (a: number, d: Dir) => {
    const b = neighbor(a, d);
    for (const side of d === 0 || d === 2 ? ([1, 3] as Dir[]) : ([0, 2] as Dir[])) {
      const a2 = nodes[a].links[side];
      const b2 = nodes[b].links[side];
      if (a2 >= 0 && b2 >= 0 && nodes[a2].links[d] === b2) return true;
    }
    return false;
  };
  const usable = (a: number, d: Dir) => {
    const b = neighbor(a, d);
    return b >= 0 && b !== home && a !== home;
  };

  // 1. Árbol aleatorio (DFS) en la mitad izquierda, columna central incluida
  const visited = new Set<number>([home]);
  const stack = [idx(half, rows - 1)];
  visited.add(stack[0]);
  while (stack.length) {
    const a = stack[stack.length - 1];
    const opts = DIRS.filter((d) => {
      const b = neighbor(a, d);
      return b >= 0 && nodes[b].c <= half && !visited.has(b) && usable(a, d);
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rng() * opts.length)];
    const b = neighbor(a, d);
    linkMirrored(a, d);
    visited.add(b);
    stack.push(b);
  }

  // 2. Sin callejones sin salida (la guarida no cuenta)
  for (let pass = 0; pass < 4; pass++) {
    for (let a = 0; a < nodes.length; a++) {
      if (a === home || nodes[a].c > half || degree(a) !== 1) continue;
      const opts = DIRS.filter((d) => !linked(a, d) && usable(a, d));
      if (!opts.length) continue;
      const preferred = opts.filter((d) => !makesSquare(a, d));
      const pool = preferred.length ? preferred : opts;
      // mejor unir con otro callejón: arregla dos de una vez
      pool.sort((d1, d2) => degree(neighbor(a, d1)) - degree(neighbor(a, d2)));
      linkMirrored(a, pool[0]);
    }
  }

  // 3. Atajos: más circuitos para poder escapar
  const extra = 5 + Math.floor(rng() * 3);
  for (let k = 0, tries = 0; k < extra && tries < 200; tries++) {
    const a = idx(Math.floor(rng() * (half + 1)), Math.floor(rng() * rows));
    const d = DIRS[Math.floor(rng() * 4)];
    if (linked(a, d) || !usable(a, d) || makesSquare(a, d)) continue;
    linkMirrored(a, d);
    k++;
  }

  // 4. Guarida: solo conectada hacia arriba
  nodes[home].links = [-1, -1, -1, -1];
  link(home, 0);

  const powers = [idx(0, 0), idx(cols - 1, 0), idx(0, rows - 1), idx(cols - 1, rows - 1)];
  return { cols, rows, spacing, nodes, home, door, start, powers };
}

/** Comprobaciones de calidad (las usan los tests). */
export function mazeProblems(g: MazeGraph): string[] {
  const problems: string[] = [];
  const playable = g.nodes.map((_, i) => i).filter((i) => i !== g.home);
  // conexo para el jugador
  const seen = new Set([g.start]);
  const q = [g.start];
  while (q.length) {
    const a = q.shift()!;
    for (const b of g.nodes[a].links) if (b >= 0 && b !== g.home && !seen.has(b)) { seen.add(b); q.push(b); }
  }
  if (seen.size !== playable.length) problems.push(`no conexo: ${seen.size}/${playable.length}`);
  for (const i of playable) {
    const deg = g.nodes[i].links.filter((b) => b >= 0 && b !== g.home).length;
    if (deg < 2) problems.push(`callejón en ${g.nodes[i].c},${g.nodes[i].r}`);
  }
  // simetría
  for (const n of g.nodes) {
    const m = g.nodes[n.r * g.cols + (g.cols - 1 - n.c)];
    if ((n.links[0] >= 0) !== (m.links[0] >= 0) || (n.links[1] >= 0) !== (m.links[3] >= 0)) {
      problems.push(`asimetría en ${n.c},${n.r}`);
      break;
    }
  }
  return problems;
}
