/**
 * NeuronArt.tsx — Dibujo SVG de un tipo de neurona (tinta sobre papel, como las láminas de Cajal).
 */
import { useMemo } from 'react';
import { drawNeuron, strokeToPath, somaPath, type CellType } from '../../game/lab/neuronShapes';

export function NeuronArt({ type, seed = 7, size = 96, ink = '#1b130a', title }: { type: CellType; seed?: number; size?: number; ink?: string; title?: string }) {
  const { paths, soma, view } = useMemo(() => {
    const d = drawNeuron(type, seed);
    const S = 100;
    const b = d.bounds;
    const w = (b.maxX - b.minX) * S, h = (b.maxY - b.minY) * S;
    const pad = 6;
    return {
      paths: d.strokes.map((st) => ({ d: strokeToPath(st, S), w: st.w })),
      soma: somaPath(d.soma, S),
      view: `${(b.minX * S - pad).toFixed(1)} ${(b.minY * S - pad).toFixed(1)} ${(w + pad * 2).toFixed(1)} ${(h + pad * 2).toFixed(1)}`,
    };
  }, [type, seed]);
  return (
    <svg width={size} height={size} viewBox={view} preserveAspectRatio="xMidYMid meet" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) => (
          <path key={i} d={p.d} strokeWidth={p.w * 0.9} />
        ))}
      </g>
      <path d={soma} fill={ink} />
    </svg>
  );
}
