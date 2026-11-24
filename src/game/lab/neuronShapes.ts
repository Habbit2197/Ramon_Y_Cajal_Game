/**
 * neuronShapes.ts — Neuronas dibujadas por procedimiento, al estilo de las láminas de Cajal.
 *
 * Devuelve trazos (polilíneas con grosor) en coordenadas locales: el soma está en (0, 0)
 * y una unidad equivale al alto aproximado de la neurona. Lo usan el Microscopio (canvas)
 * y las fichas del Museo (SVG). Función pura con semilla: misma semilla, mismo dibujo.
 */
import { mulberry32 } from '../../engine/rng';

export type CellType = 'piramidal' | 'purkinje' | 'granulo' | 'estrellada' | 'astrocito';

export const CELL_INFO: Record<CellType, { name: string; where: string; clue: string }> = {
  piramidal: { name: 'Neurona piramidal', where: 'corteza cerebral', clue: 'Cuerpo en triángulo y una dendrita larga que sube.' },
  purkinje: { name: 'Célula de Purkinje', where: 'cerebelo', clue: 'Un árbol de dendritas enorme, plano como un abanico.' },
  granulo: { name: 'Célula granular', where: 'cerebelo', clue: 'Diminuta, con pocas dendritas cortas acabadas en garra.' },
  estrellada: { name: 'Neurona estrellada', where: 'corteza cerebral', clue: 'Dendritas que salen en todas direcciones, como una estrella.' },
  astrocito: { name: 'Astrocito (glía)', where: 'todo el cerebro', clue: 'Muchas prolongaciones cortas y onduladas: no es una neurona.' },
};

export interface Stroke {
  pts: number[]; // x0, y0, x1, y1, …
  w: number; // grosor relativo
}

export interface NeuronDrawing {
  type: CellType;
  soma: { shape: 'tri' | 'round' | 'pear'; r: number };
  strokes: Stroke[];
  /** Caja que ocupa, para colocarla sin salirse */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function grow(
  out: Stroke[],
  rng: () => number,
  x: number,
  y: number,
  angle: number,
  len: number,
  w: number,
  depth: number,
  opt: { spread: number; shrink: number; wiggle: number; clampUp?: boolean; steps?: number },
) {
  const steps = opt.steps ?? 6;
  const pts = [x, y];
  let a = angle;
  let cx = x, cy = y;
  for (let i = 0; i < steps; i++) {
    a += (rng() - 0.5) * opt.wiggle;
    if (opt.clampUp) a = Math.max(-Math.PI + 0.35, Math.min(-0.35, a));
    cx += Math.cos(a) * (len / steps);
    cy += Math.sin(a) * (len / steps);
    pts.push(cx, cy);
  }
  out.push({ pts, w });
  if (depth <= 0) return;
  const n = rng() < 0.25 && depth > 1 ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const off = n === 2 ? (k === 0 ? -1 : 1) : k - 1;
    grow(out, rng, cx, cy, a + off * opt.spread * (0.6 + rng() * 0.6), len * opt.shrink * (0.8 + rng() * 0.4), w * 0.72, depth - 1, opt);
  }
}

export function drawNeuron(type: CellType, seed: number): NeuronDrawing {
  const rng = mulberry32(seed);
  const s: Stroke[] = [];
  const UP = -Math.PI / 2;
  const DOWN = Math.PI / 2;
  let soma: NeuronDrawing['soma'];

  switch (type) {
    case 'piramidal': {
      soma = { shape: 'tri', r: 0.075 };
      // dendrita apical con ramas oblicuas y penacho final
      const apical: number[] = [0, -0.07];
      let ax = 0, ay = -0.07;
      for (let i = 0; i < 10; i++) {
        ax += (rng() - 0.5) * 0.02;
        ay -= 0.055;
        apical.push(ax, ay);
        if (i > 1 && i < 9 && rng() < 0.55) grow(s, rng, ax, ay, UP + (rng() < 0.5 ? -1 : 1) * (0.9 + rng() * 0.4), 0.12, 1.1, 1, { spread: 0.5, shrink: 0.6, wiggle: 0.5, steps: 4 });
      }
      s.push({ pts: apical, w: 3 });
      for (let k = 0; k < 3; k++) grow(s, rng, ax, ay, UP + (k - 1) * 0.6, 0.12, 1.6, 2, { spread: 0.45, shrink: 0.7, wiggle: 0.5, steps: 4 });
      // dendritas basales
      const nb = 4 + Math.floor(rng() * 3);
      for (let k = 0; k < nb; k++) {
        const a = DOWN + (k / (nb - 1) - 0.5) * 2.6;
        grow(s, rng, Math.cos(a) * 0.05, 0.03 + Math.sin(a) * 0.03, a, 0.16 + rng() * 0.08, 1.8, 2, { spread: 0.5, shrink: 0.65, wiggle: 0.6, steps: 4 });
      }
      // axón fino hacia abajo con colaterales
      const axon: number[] = [0, 0.06];
      let bx = 0, by = 0.06;
      for (let i = 0; i < 9; i++) {
        bx += (rng() - 0.5) * 0.015;
        by += 0.05;
        axon.push(bx, by);
        if (i === 3 || i === 6) grow(s, rng, bx, by, DOWN + (rng() < 0.5 ? -1 : 1) * 1.1, 0.12, 0.7, 0, { spread: 0, shrink: 0, wiggle: 0.3, steps: 4 });
      }
      s.push({ pts: axon, w: 0.9 });
      break;
    }
    case 'purkinje': {
      soma = { shape: 'pear', r: 0.07 };
      for (let k = 0; k < 2; k++) {
        grow(s, rng, (k - 0.5) * 0.03, -0.06, UP + (k - 0.5) * 0.5, 0.14, 3, 5, { spread: 0.42, shrink: 0.78, wiggle: 0.35, clampUp: true, steps: 4 });
      }
      const axon: number[] = [0, 0.06];
      let by = 0.06, bx = 0;
      for (let i = 0; i < 8; i++) { bx += (rng() - 0.5) * 0.02; by += 0.05; axon.push(bx, by); }
      s.push({ pts: axon, w: 1 });
      break;
    }
    case 'granulo': {
      soma = { shape: 'round', r: 0.035 };
      for (let k = 0; k < 4; k++) {
        const a = DOWN + (k - 1.5) * 0.9 + (rng() - 0.5) * 0.3;
        const ex = Math.cos(a) * 0.11, ey = Math.sin(a) * 0.11;
        s.push({ pts: [0, 0, ex * 0.5 + (rng() - 0.5) * 0.02, ey * 0.5, ex, ey], w: 1.2 });
        for (let c = -1; c <= 1; c++) s.push({ pts: [ex, ey, ex + Math.cos(a + c * 0.7) * 0.025, ey + Math.sin(a + c * 0.7) * 0.025], w: 0.9 });
      }
      // axón que sube y se abre en T (fibra paralela)
      s.push({ pts: [0, -0.03, 0.01, -0.2, -0.01, -0.4, 0, -0.55], w: 0.7 });
      s.push({ pts: [-0.32, -0.56, -0.15, -0.55, 0, -0.55, 0.16, -0.56, 0.32, -0.55], w: 0.6 });
      break;
    }
    case 'estrellada': {
      soma = { shape: 'round', r: 0.05 };
      const n = 7 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rng() * 0.4;
        grow(s, rng, Math.cos(a) * 0.045, Math.sin(a) * 0.045, a, 0.14 + rng() * 0.06, 1.6, 2, { spread: 0.5, shrink: 0.7, wiggle: 0.5, steps: 4 });
      }
      break;
    }
    case 'astrocito': {
      soma = { shape: 'round', r: 0.04 };
      const n = 14 + Math.floor(rng() * 6);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rng() * 0.3;
        grow(s, rng, Math.cos(a) * 0.035, Math.sin(a) * 0.035, a, 0.1 + rng() * 0.08, 1.7, 1, { spread: 0.35, shrink: 0.55, wiggle: 0.9, steps: 5 });
      }
      break;
    }
  }

  let minX = -soma.r, minY = -soma.r, maxX = soma.r, maxY = soma.r;
  for (const st of s) {
    for (let i = 0; i < st.pts.length; i += 2) {
      minX = Math.min(minX, st.pts[i]);
      maxX = Math.max(maxX, st.pts[i]);
      minY = Math.min(minY, st.pts[i + 1]);
      maxY = Math.max(maxY, st.pts[i + 1]);
    }
  }
  return { type, soma, strokes: s, bounds: { minX, minY, maxX, maxY } };
}

/** Trazado SVG de una polilínea suavizada */
export function strokeToPath(st: Stroke, scale = 1, ox = 0, oy = 0): string {
  const p = st.pts;
  let d = `M${(p[0] * scale + ox).toFixed(1)} ${(p[1] * scale + oy).toFixed(1)}`;
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * scale + ox;
    const my = ((p[i + 1] + p[i + 3]) / 2) * scale + oy;
    d += ` Q${(p[i] * scale + ox).toFixed(1)} ${(p[i + 1] * scale + oy).toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += ` L${(p[p.length - 2] * scale + ox).toFixed(1)} ${(p[p.length - 1] * scale + oy).toFixed(1)}`;
  return d;
}

export function somaPath(soma: NeuronDrawing['soma'], scale = 1, ox = 0, oy = 0): string {
  const r = soma.r * scale;
  if (soma.shape === 'tri') return `M${ox} ${oy - r * 1.4} L${ox + r * 1.1} ${oy + r * 0.8} Q${ox} ${oy + r * 1.1} ${ox - r * 1.1} ${oy + r * 0.8} Z`;
  if (soma.shape === 'pear') return `M${ox} ${oy - r * 1.2} C${ox + r * 1.3} ${oy - r * 0.6} ${ox + r * 1.1} ${oy + r} ${ox} ${oy + r} C${ox - r * 1.1} ${oy + r} ${ox - r * 1.3} ${oy - r * 0.6} ${ox} ${oy - r * 1.2} Z`;
  return `M${ox - r} ${oy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
}
