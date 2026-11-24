/**
 * MicroGame.tsx — Microscopio: aplicar la tinción de Golgi y descubrir neuronas.
 *
 * Tres capas en canvas: el tejido sin teñir, la zona tocada por el reactivo (ámbar)
 * y las neuronas teñidas (tinta negra), que solo se ven dentro de esa zona.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Droplet, ArrowRight } from 'lucide-react';
import type { LabGameProps } from './LabMode';
import {
  MICRO_ROUNDS, FIELD_W, FIELD_H, BRUSH_R, ROUND_SECONDS, generateSample, applyStain, inkLeft, roundScore, type MicroSample, type SampleCell,
} from '../../game/lab/micro';
import { drawNeuron, CELL_INFO, type CellType } from '../../game/lab/neuronShapes';
import { shuffle } from '../../game/daily';
import { mulberry32 } from '../../engine/rng';
import { activeParams } from '../../game/difficulty';
import { soundEngine } from '../../game/sound';

const INK = '#1b130a';
/** Reactivo según la dificultad: 85 % de la muestra en Científico, toda en Explorador, 64 % en Nobel */
const inkFor = (tolerance: number) => Math.min(1, 0.85 * tolerance);
/** Pista: el contorno de las neuronas teñidas se intuye un poco (más en Explorador, nada en Nobel) */
const hintFor = (tolerance: number) => (tolerance > 1 ? 0.12 : tolerance >= 1 ? 0.035 : 0);

function drawCellInk(ctx: CanvasRenderingContext2D, c: SampleCell, W: number, alpha = 1) {
  const d = drawNeuron(c.type, c.seed);
  const unit = c.scale * W;
  const cx = (c.x / FIELD_W) * W, cy = (c.y / FIELD_W) * W;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const st of d.strokes) {
    ctx.lineWidth = Math.max(0.6, st.w * unit * 0.006);
    ctx.beginPath();
    ctx.moveTo(cx + st.pts[0] * unit, cy + st.pts[1] * unit);
    for (let i = 2; i < st.pts.length; i += 2) ctx.lineTo(cx + st.pts[i] * unit, cy + st.pts[i + 1] * unit);
    ctx.stroke();
  }
  const r = d.soma.r * unit;
  ctx.beginPath();
  if (d.soma.shape === 'tri') {
    ctx.moveTo(cx, cy - r * 1.4);
    ctx.lineTo(cx + r * 1.1, cy + r * 0.8);
    ctx.quadraticCurveTo(cx, cy + r * 1.1, cx - r * 1.1, cy + r * 0.8);
    ctx.closePath();
  } else ctx.ellipse(cx, cy, r, d.soma.shape === 'pear' ? r * 1.15 : r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function MicroGame({ seed, paused, touch, onFinish }: LabGameProps) {
  const params = useMemo(() => activeParams().lab, []);
  const roundSeconds = ROUND_SECONDS * params.time;
  const [round, setRound] = useState(0);
  const sample = useRef<MicroSample>(generateSample(seed, 0, inkFor(params.tolerance)));
  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [ink, setInk] = useState(1);
  const [asking, setAsking] = useState<SampleCell | null>(null);
  const [answer, setAnswer] = useState<{ cell: SampleCell; ok: boolean; chosen: CellType } | null>(null);
  const [roundOver, setRoundOver] = useState<{ score: number; found: number } | null>(null);
  const [foundCount, setFoundCount] = useState(0);
  const total = useRef({ score: 0, found: 0, right: 0, types: new Set<CellType>() });
  const finished = useRef(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ tissue: HTMLCanvasElement; ink: HTMLCanvasElement; mask: HTMLCanvasElement; tmp: HTMLCanvasElement; W: number; H: number; dpr: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pulses = useRef<{ x: number; y: number; t: number }[]>([]);

  // Tamaño: muestra 4:3 lo más grande posible
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(Math.min(r.width, (r.height * FIELD_W) / FIELD_H));
      setSize({ w, h: Math.floor((w * FIELD_H) / FIELD_W) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Prepara las capas de la muestra actual */
  const buildLayers = useCallback(() => {
    if (!size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr);
    const mk = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    const prev = layers.current;
    const tissue = mk(), inkC = mk(), tmp = mk();
    const mask = prev && prev.W === W && prev.H === H ? prev.mask : mk();
    const s = sample.current;
    const rng = mulberry32(seed + s.round);
    // tejido sin teñir
    const t = tissue.getContext('2d')!;
    const g = t.createRadialGradient(W * 0.5, H * 0.45, W * 0.1, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, '#f1e6d6');
    g.addColorStop(1, '#d8c6b0');
    t.fillStyle = g;
    t.fillRect(0, 0, W, H);
    t.strokeStyle = 'rgba(150,110,90,0.12)';
    t.lineWidth = 1 * dpr;
    for (let i = 0; i < 60; i++) {
      t.beginPath();
      let x = rng() * W, y = rng() * H;
      t.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * W * 0.12; y += (rng() - 0.5) * H * 0.12; t.lineTo(x, y); }
      t.stroke();
    }
    t.fillStyle = 'rgba(160,110,120,0.35)';
    for (let i = 0; i < s.nuclei.length; i += 3) {
      t.beginPath();
      t.arc((s.nuclei[i] / FIELD_W) * W, (s.nuclei[i + 1] / FIELD_W) * W, s.nuclei[i + 2] * W, 0, Math.PI * 2);
      t.fill();
    }
    // pista suave (Explorador y Científico)
    const hint = hintFor(params.tolerance);
    if (hint > 0) for (const c of s.cells) drawCellInk(t, c, W, hint);
    // neuronas teñidas
    const ic = inkC.getContext('2d')!;
    for (const c of s.cells) drawCellInk(ic, c, W);
    layers.current = { tissue, ink: inkC, mask, tmp, W, H, dpr };
  }, [size, seed, params.tolerance]);

  const paint = useCallback(() => {
    const L = layers.current, cv = canvasRef.current;
    if (!L || !cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(L.tissue, 0, 0);
    const tc = L.tmp.getContext('2d')!;
    // zona con reactivo: tono ámbar
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, L.W, L.H);
    tc.drawImage(L.mask, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = 'rgba(214,150,58,0.62)';
    tc.fillRect(0, 0, L.W, L.H);
    ctx.drawImage(L.tmp, 0, 0);
    // neuronas teñidas solo dentro de esa zona
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, L.W, L.H);
    tc.drawImage(L.mask, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.drawImage(L.ink, 0, 0);
    ctx.drawImage(L.tmp, 0, 0);
    // anillos de descubrimiento
    const now = performance.now();
    pulses.current = pulses.current.filter((p) => now - p.t < 900);
    for (const p of pulses.current) {
      const k = (now - p.t) / 900;
      ctx.strokeStyle = `rgba(127,224,168,${1 - k})`;
      ctx.lineWidth = 3 * L.dpr;
      ctx.beginPath();
      ctx.arc(p.x * L.W, (p.y / FIELD_W) * L.W, (0.03 + k * 0.08) * L.W, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (pulses.current.length) requestAnimationFrame(paint);
  }, []);

  useEffect(() => {
    if (!size.w) return;
    const cv = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    buildLayers();
    paint();
  }, [size, round, buildLayers, paint]);

  // Reloj de la ronda (parado mientras se identifica, en pausa o al terminar la ronda)
  const frozen = paused || !!asking || !!answer || !!roundOver;
  useEffect(() => {
    if (frozen) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setTimeLeft((t) => Math.max(0, t - dt));
    }, 100);
    return () => window.clearInterval(id);
  }, [frozen]);

  const endRound = useCallback(
    (secondsLeft: number) => {
      const s = sample.current;
      const sc = roundScore(s, secondsLeft);
      const found = s.cells.filter((c) => c.found).length;
      total.current.score += sc;
      total.current.found += found;
      total.current.right += s.cells.filter((c) => c.identified === true).length;
      for (const c of s.cells) if (c.identified === true) total.current.types.add(c.type);
      setRoundOver({ score: sc, found });
    },
    [],
  );

  // Fin de ronda: todo descubierto, sin tiempo o sin reactivo
  useEffect(() => {
    if (roundOver || asking || answer) return;
    const s = sample.current;
    const allDone = s.cells.every((c) => c.found && c.identified !== null);
    if (allDone || timeLeft <= 0 || (ink <= 0 && s.cells.every((c) => !c.found || c.identified !== null))) endRound(timeLeft);
  }, [timeLeft, ink, asking, answer, roundOver, foundCount, endRound]);

  const nextRound = () => {
    if (round + 1 >= MICRO_ROUNDS.length) {
      if (finished.current) return;
      finished.current = true;
      const t = total.current;
      const cards = [...t.types] as string[];
      if (t.found > 0) cards.push('golgi');
      onFinish({
        score: t.score,
        completed: t.found >= 6,
        found: t.found,
        cards,
        detail: `${t.found} neuronas descubiertas`,
        lines: [`Neuronas descubiertas: ${t.found} de ${MICRO_ROUNDS.length * 4}.`, `Tipos acertados: ${t.right}.`],
      });
      return;
    }
    const r = round + 1;
    sample.current = generateSample(seed, r, inkFor(params.tolerance));
    layers.current?.mask.getContext('2d')!.clearRect(0, 0, layers.current.W, layers.current.H);
    setRound(r);
    setTimeLeft(roundSeconds);
    setInk(1);
    setFoundCount(0);
    setRoundOver(null);
  };

  // Pintar con el reactivo
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const dab = (fx: number, fy: number) => {
    const L = layers.current;
    if (!L || inkLeft(sample.current) <= 0) return;
    const m = L.mask.getContext('2d')!;
    const R = BRUSH_R * L.W;
    const gx = fx * L.W, gy = (fy / FIELD_W) * L.W;
    const grad = m.createRadialGradient(gx, gy, R * 0.55, gx, gy, R);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = grad;
    m.beginPath();
    m.arc(gx, gy, R, 0, Math.PI * 2);
    m.fill();
    const found = applyStain(sample.current, fx, fy);
    if (found.length) {
      for (const c of found) pulses.current.push({ x: c.x, y: c.y, t: performance.now() });
      soundEngine.tone(988, 0.16, 'triangle', 0.12);
      setFoundCount((n) => n + found.length);
      setAsking((a) => a ?? found[0]);
    }
    setInk(inkLeft(sample.current));
  };
  const toField = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * FIELD_W, y: ((e.clientY - r.top) / r.height) * FIELD_H };
  };
  const drawing = useRef(false);
  const onDown = (e: React.PointerEvent) => {
    if (frozen) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const p = toField(e);
    lastPt.current = p;
    dab(p.x, p.y);
    paint();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || frozen) return;
    const p = toField(e);
    const l = lastPt.current ?? p;
    const dist = Math.hypot(p.x - l.x, p.y - l.y);
    const steps = Math.max(1, Math.ceil(dist / (BRUSH_R * 0.5)));
    for (let i = 1; i <= steps; i++) dab(l.x + ((p.x - l.x) * i) / steps, l.y + ((p.y - l.y) * i) / steps);
    lastPt.current = p;
    requestAnimationFrame(paint);
  };
  const onUp = () => {
    drawing.current = false;
    lastPt.current = null;
  };

  // Identificar la célula descubierta
  const options = useMemo(() => (asking ? shuffle([...MICRO_ROUNDS[round].types], mulberry32(asking.seed)) : []), [asking, round]);
  const identify = (t: CellType) => {
    if (!asking) return;
    const ok = t === asking.type;
    asking.identified = ok;
    soundEngine.tone(ok ? 880 : 220, 0.18, ok ? 'triangle' : 'sawtooth', ok ? 0.13 : 0.07);
    setAnswer({ cell: asking, ok, chosen: t });
    setAsking(null);
  };
  const closeAnswer = () => {
    setAnswer(null);
    // ¿quedan células descubiertas sin identificar? (un mismo toque puede descubrir dos)
    const pending = sample.current.cells.find((c) => c.found && c.identified === null);
    if (pending) setAsking(pending);
  };

  const r = MICRO_ROUNDS[round];
  const lowTime = timeLeft < 8;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 sm:px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold text-white">Muestra {round + 1} de {MICRO_ROUNDS.length}: {r.title}</span>
        <span className={`inline-flex items-center gap-1.5 [font-variant-numeric:tabular-nums] ${lowTime ? 'text-[#ff9f9f]' : 'text-[#c9c2b4]'}`}>
          <Timer className="w-4 h-4" aria-hidden /> {Math.ceil(timeLeft)} s
        </span>
        <span className="inline-flex items-center gap-2 text-[#c9c2b4]" title="Reactivo que te queda">
          <Droplet className="w-4 h-4 text-[#e0a64a]" aria-hidden />
          <span className="w-24 h-2 rounded-full bg-white/10 overflow-hidden" role="meter" aria-label="Reactivo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ink * 100)}>
            <span className="block h-full bg-[#e0a64a]" style={{ width: `${ink * 100}%` }} />
          </span>
        </span>
        <span className="text-[#7fe0a8]">Descubiertas: {foundCount} de 4</span>
      </div>

      <div ref={wrapRef} className="relative flex-1 min-h-0 flex items-center justify-center px-3 pb-3">
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h }}
          className="rounded-[18px] shadow-[0_0_0_6px_#1b1f2b,0_0_0_7px_rgba(255,255,255,0.08),0_30px_60px_-20px_rgba(0,0,0,0.8)] touch-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          role="img"
          aria-label={`Muestra de ${r.title} al microscopio. ${foundCount} de 4 neuronas descubiertas.`}
        />
        {ink <= 0 && !roundOver && !asking && !answer && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 bg-[#0b1220]/90 text-sm text-[#e9e3d6]">Se ha acabado el reactivo.</div>
        )}
        {foundCount === 0 && ink === 1 && !roundOver && (
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 bg-[#0b1220]/85 text-sm text-[#e9e3d6]">
            {touch ? 'Frota la muestra con el dedo' : 'Arrastra el ratón sobre la muestra'} para teñirla
          </div>
        )}
      </div>

      <AnimatePresence>
        {(asking || answer) && (
          <motion.div
            key={(asking ?? answer!.cell).id + (answer ? 'a' : 'q')}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="dialog"
            aria-labelledby="micro-q"
            className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5 safe-pad !pt-0"
          >
            <div className="mx-auto max-w-xl rounded-3xl bg-[#121a2a]/97 border border-[#7fe0a8]/35 p-5 flex flex-col gap-3 shadow-2xl">
              {asking ? (
                <>
                  <h3 id="micro-q" className="font-display text-xl text-white">¡Neurona teñida! ¿Qué tipo de célula es?</h3>
                  <p className="text-sm text-[#a9a293]">Mira su forma en la muestra: el cuerpo, las ramas, hacia dónde crecen.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {options.map((t, i) => (
                      <button key={t} type="button" autoFocus={i === 0} onClick={() => identify(t)} className="min-h-12 rounded-xl border border-white/15 bg-white/[0.04] hover:border-[#7fe0a8] hover:bg-[#7fe0a8]/10 px-3 py-2 text-sm text-white font-semibold cursor-pointer">
                        {CELL_INFO[t].name}
                      </button>
                    ))}
                  </div>
                </>
              ) : answer ? (
                <>
                  <h3 id="micro-q" className="font-display text-xl" style={{ color: answer.ok ? '#7fe0a8' : '#ffb3a1' }}>
                    {answer.ok ? `¡Sí! Es una ${CELL_INFO[answer.cell.type].name.toLowerCase()}.` : `Era una ${CELL_INFO[answer.cell.type].name.toLowerCase()}.`}
                  </h3>
                  <p className="text-[#e9e3d6] leading-relaxed">{CELL_INFO[answer.cell.type].clue} Vive en: {CELL_INFO[answer.cell.type].where}.</p>
                  <button type="button" autoFocus onClick={closeAnswer} className="self-start h-11 px-5 rounded-xl bg-[#7fe0a8] text-[#06200f] font-semibold inline-flex items-center gap-2 cursor-pointer">
                    Seguir tiñendo <ArrowRight className="w-4 h-4" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {roundOver && (
        <div role="dialog" aria-modal="true" aria-labelledby="micro-round" className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#0b1220]/75 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-[#121a2a]/97 border border-[#7fe0a8]/30 p-6 flex flex-col gap-3">
            <h3 id="micro-round" className="font-display text-2xl text-white">{r.title}: {roundOver.found} de 4</h3>
            <p className="text-[#e9e3d6] leading-relaxed">{r.fact}</p>
            <p className="text-sm text-[#7fe0a8] [font-variant-numeric:tabular-nums]">+{roundOver.score.toLocaleString('es-ES')} puntos</p>
            <button type="button" autoFocus onClick={nextRound} className="self-start h-12 px-6 rounded-xl bg-[#7fe0a8] text-[#06200f] font-semibold inline-flex items-center gap-2 cursor-pointer">
              {round + 1 >= MICRO_ROUNDS.length ? 'Ver resultado' : 'Siguiente muestra'} <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
