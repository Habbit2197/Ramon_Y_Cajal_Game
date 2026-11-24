/**
 * BrushGame.tsx — «Cepíllate los dientes».
 *
 * 1. Pasta: mantener pulsado el tubo hasta poner una bolita del tamaño de un guisante.
 * 2. Cepillado: cuatro zonas de la boca, 30 s cada una (en Científico), por fuera, por dentro
 *    y por arriba. La placa (amarilla, con bacterias) se va con vaivenes cortos.
 * 3. Final: qué hacer con la espuma (escupir sin enjuagar).
 *
 * Canvas a 60 fps para dientes, placa, bacterias, espuma y cepillo; React solo para el HUD.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, RotateCcw, Check, X as XIcon, Timer } from 'lucide-react';
import type { LabGameProps } from './LabMode';
import {
  QUADRANTS, FACES, FACE_LABEL, FACE_SHARE, QUADRANT_SECONDS, GRID_W, GRID_H, TOOTH_TOP, TOOTH_BOTTOM,
  makeFace, cleanliness, scrub, newStroke, teethFor, pasteAmount, pasteVerdict, AFTER_OPTIONS, brushScore, brushCards,
  type Face, type FaceState, type PasteVerdict, type ToothKind,
} from '../../game/lab/brush';
import { activeParams } from '../../game/difficulty';
import { soundEngine } from '../../game/sound';
import { mulberry32 } from '../../engine/rng';

const ACCENT = '#9fe7f5';

/** roundRect con alternativa para navegadores antiguos */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// ── Dibujo de los dientes ─────────────────────────────────────────────────
function toothPath(ctx: CanvasRenderingContext2D, kind: ToothKind, x0: number, x1: number, top: number, bottom: number, upper: boolean, face: Face) {
  const w = x1 - x0, h = bottom - top;
  const pad = w * 0.06;
  const L = x0 + pad, R = x1 - pad;
  ctx.beginPath();
  if (face === 'arriba') {
    // vista desde arriba: corona redondeada
    const r = Math.min(w, h) * 0.28;
    roundRect(ctx, L, top + h * 0.12, R - L, h * 0.76, r);
    return;
  }
  // vista de lado: la encía en un extremo y el borde que muerde en el otro
  const gum = upper ? top : bottom;
  const bite = upper ? bottom : top;
  const dir = upper ? 1 : -1;
  ctx.moveTo(L + w * 0.04, gum);
  ctx.lineTo(L, gum + dir * h * 0.55);
  if (kind === 'canino') {
    ctx.quadraticCurveTo(L, bite - dir * h * 0.12, (L + R) / 2, bite);
    ctx.quadraticCurveTo(R, bite - dir * h * 0.12, R, gum + dir * h * 0.55);
  } else if (kind === 'incisivo') {
    ctx.quadraticCurveTo(L, bite, L + w * 0.12, bite);
    ctx.lineTo(R - w * 0.12, bite);
    ctx.quadraticCurveTo(R, bite, R, gum + dir * h * 0.55);
  } else {
    const cusps = kind === 'molar' ? 3 : 2;
    const step = (R - L) / cusps;
    ctx.quadraticCurveTo(L, bite - dir * h * 0.05, L + step * 0.25, bite);
    for (let c = 0; c < cusps; c++) {
      const cx = L + step * (c + 0.5);
      ctx.quadraticCurveTo(cx, bite + dir * h * 0.02, cx + step * 0.25, bite - dir * h * 0.06);
      ctx.quadraticCurveTo(cx + step * 0.4, bite - dir * h * 0.02, Math.min(R, L + step * (c + 1) + step * 0.25), bite);
    }
    ctx.quadraticCurveTo(R, bite - dir * h * 0.05, R, gum + dir * h * 0.55);
  }
  ctx.lineTo(R - w * 0.04, gum);
  ctx.closePath();
}

/** Capa con los dientes (solo dientes, fondo transparente): sirve de máscara para la placa */
function drawTeeth(W: number, H: number, face: Face, upper: boolean, dpr: number) {
  const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = cv.getContext('2d')!;
  const top = H * TOOTH_TOP, bottom = H * TOOTH_BOTTOM;
  for (const t of teethFor(face)) {
    const x0 = t.x0 * W, x1 = t.x1 * W;
    const g = ctx.createLinearGradient(0, upper ? top : bottom, 0, upper ? bottom : top);
    g.addColorStop(0, '#efe4cb');
    g.addColorStop(0.35, '#fbf7ee');
    g.addColorStop(1, '#f4eee2');
    ctx.fillStyle = g;
    toothPath(ctx, t.kind, x0, x1, top, bottom, upper, face);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,120,95,0.45)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
    // brillo del esmalte
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x0 + (x1 - x0) * 0.32, (top + bottom) / 2, (x1 - x0) * 0.08, (bottom - top) * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (face === 'arriba') {
      // surcos de la superficie que mastica
      ctx.strokeStyle = 'rgba(150,125,95,0.55)';
      ctx.lineWidth = 1.4 * dpr;
      const cx = (x0 + x1) / 2, cy = (top + bottom) / 2;
      ctx.beginPath();
      ctx.moveTo(x0 + (x1 - x0) * 0.2, cy);
      ctx.quadraticCurveTo(cx, cy + (bottom - top) * 0.06, x1 - (x1 - x0) * 0.2, cy);
      if (t.kind === 'molar') { ctx.moveTo(cx, top + (bottom - top) * 0.25); ctx.lineTo(cx, bottom - (bottom - top) * 0.25); }
      ctx.stroke();
    }
    ctx.restore();
  }
  return cv;
}

/** Fondo de la boca: encía, lengua o paladar según la cara */
function drawMouth(ctx: CanvasRenderingContext2D, W: number, H: number, face: Face, upper: boolean) {
  ctx.fillStyle = '#2a0a10';
  ctx.fillRect(0, 0, W, H);
  const gumH = H * (TOOTH_TOP + 0.08);
  const gumY = face === 'arriba' ? -1 : upper ? 0 : H - gumH;
  if (face !== 'arriba') {
    const g = ctx.createLinearGradient(0, gumY, 0, gumY + gumH);
    g.addColorStop(upper ? 0 : 1, '#c4566a');
    g.addColorStop(upper ? 1 : 0, '#e8899a');
    ctx.fillStyle = g;
    ctx.fillRect(0, gumY, W, gumH);
  }
  // por dentro: lengua (abajo) o paladar (arriba); por arriba: lengua y mejilla a los lados
  const other = face === 'arriba' ? null : upper ? { y: H * 0.95, h: H * 0.05 } : { y: 0, h: H * 0.05 };
  if (face === 'dentro' || face === 'arriba') {
    ctx.fillStyle = face === 'arriba' ? '#b84a5c' : upper ? '#a83f52' : '#c25467';
    if (face === 'arriba') {
      ctx.fillRect(0, 0, W, H * 0.14);
      ctx.fillRect(0, H * 0.9, W, H * 0.1);
    } else if (other) ctx.fillRect(0, other.y, W, other.h);
  }
}

interface Germ { i: number; x: number; y: number; phase: number; hue: number; alive: boolean }
interface Bubble { x: number; y: number; r: number; life: number }

export default function BrushGame({ seed, paused, touch, onFinish }: LabGameProps) {
  const params = useMemo(() => activeParams().lab, []);
  const quadrantSeconds = QUADRANT_SECONDS * params.time;
  const [phase, setPhase] = useState<'paste' | 'brush' | 'after'>('paste');
  // ── Pasta ──
  const [paste, setPaste] = useState(0);
  const squeezing = useRef<number | null>(null);
  const [pasteDone, setPasteDone] = useState<PasteVerdict | null>(null);
  // ── Cepillado ──
  const [q, setQ] = useState(0);
  const [fi, setFi] = useState(0);
  const face = FACES[fi];
  const quad = QUADRANTS[q];
  const faceState = useRef<FaceState>(makeFace('fuera', seed, true));
  const results = useRef<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(quadrantSeconds * FACE_SHARE.fuera);
  const [clean, setClean] = useState(0);
  const [tip, setTip] = useState<{ ok: boolean; text: string } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const finished = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layers = useRef<{ teeth: HTMLCanvasElement; plaque: HTMLCanvasElement; W: number; H: number; dpr: number } | null>(null);
  const brush = useRef({ x: 0.5, y: 0.5, down: false, shown: false });
  const stroke = useRef(newStroke());
  const germs = useRef<Germ[]>([]);
  const bubbles = useRef<Bubble[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused || !!banner || phase !== 'brush';

  // ── Pasta: mantener pulsado ──
  useEffect(() => {
    if (phase !== 'paste') return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (squeezing.current !== null) setPaste(pasteAmount((performance.now() - squeezing.current) / 1000));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);
  const startSqueeze = () => {
    if (pasteDone) return;
    squeezing.current = performance.now() - (paste / 1) * 2200;
  };
  const stopSqueeze = () => {
    if (squeezing.current === null) return;
    squeezing.current = null;
  };

  // ── Preparar cada cara ──
  const loadFace = useCallback(
    (qi: number, f: number) => {
      const fs = makeFace(FACES[f], seed + qi * 101 + f * 13, QUADRANTS[qi].upper);
      faceState.current = fs;
      stroke.current = newStroke();
      const rng = mulberry32(seed + qi * 7 + f);
      const dirty: number[] = [];
      fs.plaque.forEach((p, i) => { if (p > 0.6) dirty.push(i); });
      germs.current = Array.from({ length: Math.min(9, dirty.length) }, () => {
        const i = dirty[Math.floor(rng() * dirty.length)];
        return { i, x: ((i % GRID_W) + 0.5) / GRID_W, y: (Math.floor(i / GRID_W) + 0.5) / GRID_H, phase: rng() * 6, hue: rng() < 0.5 ? 0 : 1, alive: true };
      });
      setTimeLeft(quadrantSeconds * FACE_SHARE[FACES[f]]);
      setClean(0);
      setTip(null);
      layers.current = null; // se redibuja con el tamaño actual
    },
    [seed, quadrantSeconds],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      // apaisado en pantallas anchas; en un móvil en vertical, más alto para que los dientes se vean grandes
      const aspect = r.width > r.height ? 2.4 : 1.25;
      const w = Math.floor(Math.min(r.width, r.height * aspect));
      setSize({ w, h: Math.floor(w / aspect) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // ── Cambiar de cara o de zona ──
  const nextFace = useCallback(() => {
    results.current.push(cleanliness(faceState.current));
    soundEngine.tone(784, 0.12, 'triangle', 0.1);
    if (fi < FACES.length - 1) {
      const nf = fi + 1;
      setFi(nf);
      loadFace(q, nf);
      setBanner(`${QUADRANTS[q].label}: ${FACE_LABEL[FACES[nf]].toLowerCase()}`);
    } else if (q < QUADRANTS.length - 1) {
      const nq = q + 1;
      setQ(nq);
      setFi(0);
      loadFace(nq, 0);
      setBanner(`Zona ${nq + 1} de 4: ${QUADRANTS[nq].label.toLowerCase()}`);
      soundEngine.playPortalReady();
    } else {
      setPhase('after');
    }
  }, [fi, q, loadFace]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1300);
    return () => window.clearTimeout(t);
  }, [banner]);

  // reloj de la cara
  useEffect(() => {
    if (phase !== 'brush') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (pausedRef.current) return;
      setTimeLeft((t) => Math.max(0, t - dt));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (phase === 'brush' && timeLeft <= 0 && !banner) nextFace();
  }, [timeLeft, phase, banner, nextFace]);

  // ── Bucle de dibujo ──
  useEffect(() => {
    if (phase !== 'brush' || !size.w) return;
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr);
    cv.width = W;
    cv.height = H;
    const tmp = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const tctx = tmp.getContext('2d')!;
    const plaqueImg = new ImageData(GRID_W, GRID_H);
    let raf = 0;
    let lastT = performance.now();
    let hudAt = 0;
    let lastFace: FaceState | null = null;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const fs = faceState.current;
      if (!layers.current || lastFace !== fs) {
        const plaque = Object.assign(document.createElement('canvas'), { width: GRID_W, height: GRID_H });
        layers.current = { teeth: drawTeeth(W, H, fs.face, QUADRANTS[qRef.current].upper, dpr), plaque, W, H, dpr };
        lastFace = fs;
      }
      const L = layers.current;
      // placa: rejilla pequeña escalada con suavizado → manchas blandas
      const d = plaqueImg.data;
      for (let i = 0; i < fs.plaque.length; i++) {
        const p = fs.plaque[i];
        d[i * 4] = 214;
        d[i * 4 + 1] = 190;
        d[i * 4 + 2] = 92;
        d[i * 4 + 3] = Math.round(Math.min(1, p * 1.1) * 235);
      }
      L.plaque.getContext('2d')!.putImageData(plaqueImg, 0, 0);

      drawMouth(ctx, W, H, fs.face, QUADRANTS[qRef.current].upper);
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, W, H);
      tctx.drawImage(L.teeth, 0, 0);
      tctx.globalCompositeOperation = 'source-atop';
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(L.plaque, 0, 0, W, H);
      ctx.drawImage(tmp, 0, 0);

      // bacterias
      for (const g of germs.current) {
        if (!g.alive) continue;
        if (fs.plaque[g.i] < 0.25) {
          g.alive = false;
          for (let k = 0; k < 6; k++) bubbles.current.push({ x: g.x * W + (Math.random() - 0.5) * 20 * dpr, y: g.y * H, r: (3 + Math.random() * 5) * dpr, life: 0.6 });
          soundEngine.tone(1200 + Math.random() * 300, 0.05, 'sine', 0.05);
          continue;
        }
        const t = now / 1000 + g.phase;
        const gx = g.x * W + Math.sin(t * 2.3) * 4 * dpr, gy = g.y * H + Math.cos(t * 1.7) * 3 * dpr;
        const r = 9 * dpr * (1 + Math.sin(t * 6) * 0.06);
        ctx.fillStyle = g.hue ? '#7bc96f' : '#b07fd6';
        ctx.beginPath();
        for (let a = 0; a <= 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          const rr = r * (1 + Math.sin(ang * 5 + t * 4) * 0.12);
          if (a === 0) ctx.moveTo(gx + Math.cos(ang) * rr, gy + Math.sin(ang) * rr);
          else ctx.lineTo(gx + Math.cos(ang) * rr, gy + Math.sin(ang) * rr);
        }
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(gx - r * 0.35, gy - r * 0.2, r * 0.28, 0, 7); ctx.arc(gx + r * 0.35, gy - r * 0.2, r * 0.28, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1020';
        ctx.beginPath(); ctx.arc(gx - r * 0.3, gy - r * 0.15, r * 0.13, 0, 7); ctx.arc(gx + r * 0.4, gy - r * 0.15, r * 0.13, 0, 7); ctx.fill();
      }

      // espuma
      bubbles.current = bubbles.current.filter((b) => (b.life -= dt) > 0);
      for (const b of bubbles.current) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, b.life * 1.4)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // cepillo inclinado 45° hacia la encía, como se recomienda
      const br = brush.current;
      if (br.shown) {
        const bx = br.x * W, by = br.y * H;
        const upper = QUADRANTS[qRef.current].upper && fs.face !== 'arriba';
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(upper ? -Math.PI / 4 : Math.PI / 4);
        const hw = W * 0.06, hh = H * 0.1;
        // mango
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        roundRect(ctx, hw * 0.6, -hh * 0.18, W * 0.3, hh * 0.36, hh * 0.18);
        ctx.fill();
        // cabezal
        ctx.fillStyle = '#e8f8fc';
        ctx.fillRect(-hw, -hh * 0.3, hw * 1.7, hh * 0.6);
        // cerdas
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2 * dpr;
        for (let k = 0; k < 9; k++) {
          const x = -hw + (k + 0.5) * ((hw * 1.7) / 9);
          ctx.beginPath(); ctx.moveTo(x, -hh * 0.3); ctx.lineTo(x, -hh * 0.75); ctx.stroke();
        }
        ctx.restore();
      }

      if (now - hudAt > 120) {
        hudAt = now;
        setClean(cleanliness(fs));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, size]);
  const qRef = useRef(q);
  qRef.current = q;

  // ── Gesto ──
  const lastMove = useRef(performance.now());
  const move = (x: number, y: number) => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastMove.current) / 1000);
    lastMove.current = now;
    brush.current.x = x;
    brush.current.y = y;
    brush.current.shown = true;
    if (pausedRef.current) return;
    const r = scrub(faceState.current, stroke.current, x, y, dt, params.tolerance);
    if (r.cleaned > 0) {
      const L = layers.current;
      if (L && Math.random() < 0.6) bubbles.current.push({ x: x * L.W + (Math.random() - 0.5) * 30 * L.dpr, y: y * L.H + (Math.random() - 0.5) * 20 * L.dpr, r: (2 + Math.random() * 5) * L.dpr, life: 0.5 + Math.random() * 0.5 });
    }
    if (r.tooFast) setTip({ ok: false, text: 'Más despacio: vaivenes cortos y suaves.' });
    else if (r.quality > 0.6 && r.cleaned > 0) setTip({ ok: true, text: '¡Así! Vaivenes cortos sobre cada diente.' });
  };
  const toFace = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    // con el dedo, el cepillo queda algo por encima para no taparlo
    const lift = e.pointerType === 'touch' ? 28 : 0;
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top - lift) / r.height)) };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' && !brush.current.down) return;
    const p = toFace(e);
    move(p.x, p.y);
  };

  // teclado: flechas para mover el cepillo
  useEffect(() => {
    if (phase !== 'brush') return;
    const onKey = (e: KeyboardEvent) => {
      const step = 0.03;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step * 2], ArrowDown: [0, step * 2] };
      const v = d[e.code];
      if (!v) return;
      e.preventDefault();
      const b = brush.current;
      move(Math.max(0, Math.min(1, b.x + v[0])), Math.max(0, Math.min(1, b.y + v[1])));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const startBrushing = () => {
    if (!pasteDone) return;
    setPhase('brush');
    loadFace(0, 0);
    setBanner(`Zona 1 de 4: ${QUADRANTS[0].label.toLowerCase()}`);
  };

  const finish = (choice: string) => {
    if (finished.current) return;
    finished.current = true;
    const ok = AFTER_OPTIONS.find((o) => o.id === choice)?.correct ?? false;
    const faces = results.current;
    const avg = faces.length ? faces.reduce((a, b) => a + b, 0) / faces.length : 0;
    const verdict = pasteDone ?? 'poca';
    onFinish({
      score: brushScore(faces, verdict, ok),
      completed: avg >= 0.8,
      clean: avg * 100,
      cards: brushCards(avg, verdict, ok, Math.ceil(faces.length / FACES.length)),
      detail: `Dientes limpios al ${Math.round(avg * 100)} %`,
      lines: [
        `Limpieza media: ${Math.round(avg * 100)} %.`,
        `Pasta: ${{ guisante: 'del tamaño de un guisante, perfecto', mucha: 'demasiada (con un guisante basta)', poca: 'muy poca' }[verdict]}.`,
        `Después: ${ok ? 'escupir sin enjuagar, muy bien' : 'lo mejor es escupir sin enjuagar'}.`,
      ],
    });
  };

  // ── Pantallas ──
  if (phase === 'paste') {
    const verdict = pasteVerdict(paste);
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center gap-6 p-5 safe-pad max-w-2xl mx-auto">
          <div className="text-center">
            <h2 className="font-display text-3xl text-white">Primero, la pasta</h2>
            <p className="mt-2 text-[#c9c2b4]">{touch ? 'Mantén el dedo' : 'Mantén pulsado'} sobre el tubo y suelta cuando haya una bolita del tamaño de un guisante.</p>
          </div>
          <svg viewBox="0 0 400 220" className="w-full max-w-xl select-none" role="img" aria-label={`Cepillo con ${Math.round(paste * 100)} % de pasta`}>
            {/* cepillo: la pasta cae sobre las cerdas */}
            <rect x="30" y="160" width="250" height="22" rx="11" fill={ACCENT} />
            <rect x="280" y="152" width="96" height="36" rx="9" fill="#e8f8fc" />
            {Array.from({ length: 15 }, (_, i) => <line key={i} x1={286 + i * 6} y1="152" x2={286 + i * 6} y2="128" stroke="#ffffff" strokeWidth="3" />)}
            {/* tamaño de un guisante: la guía */}
            <ellipse cx="328" cy="120" rx="20" ry="8" fill="none" stroke="#7fe0a8" strokeWidth="2" strokeDasharray="4 3" />
            <text x="328" y="210" textAnchor="middle" fill="#7fe0a8" fontSize="12">la línea verde: un guisante</text>
            {/* pasta: crece sobre las cerdas */}
            {paste > 0 && (
              <g>
                <ellipse cx="328" cy={124 - paste * 8} rx={4 + paste * 52} ry={4 + paste * 9} fill="#f2fbff" stroke="#9fe7f5" strokeWidth="2" />
                <ellipse cx="328" cy={124 - paste * 8} rx={(4 + paste * 52) * 0.55} ry={(4 + paste * 9) * 0.35} fill="#d6f2ff" />
              </g>
            )}
            {squeezing.current !== null && <line x1="328" y1="70" x2="328" y2={118 - paste * 12} stroke="#f2fbff" strokeWidth="7" strokeLinecap="round" />}
            {/* tubo con la boquilla hacia abajo, encima del cepillo */}
            <g
              role="button"
              aria-label="Apretar el tubo de pasta"
              tabIndex={0}
              onPointerDown={(e) => { e.preventDefault(); startSqueeze(); }}
              onPointerUp={stopSqueeze}
              onPointerLeave={stopSqueeze}
              onPointerCancel={stopSqueeze}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (squeezing.current === null) startSqueeze(); } }}
              onKeyUp={stopSqueeze}
              style={{ cursor: pasteDone ? 'default' : 'pointer', touchAction: 'none' }}
            >
              <path d={`M150 ${squeezing.current !== null ? 26 : 20} L300 22 Q318 24 318 40 Q318 56 300 58 L150 ${squeezing.current !== null ? 54 : 60} Q138 40 150 ${squeezing.current !== null ? 26 : 20} Z`} fill="#ffffff" stroke="#c9d6dc" strokeWidth="2" />
              <rect x="318" y="34" width="20" height="12" rx="2" fill="#2f80c9" />
              <rect x="322" y="46" width="12" height="22" rx="3" fill="#e6eef2" stroke="#c9d6dc" />
              <rect x="166" y="29" width="122" height="22" rx="4" fill="#2f80c9" />
              <text x="227" y="44" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">PASTA CON FLÚOR</text>
              <text x="227" y="12" textAnchor="middle" fill="#a9a293" fontSize="11">{touch ? 'mantén el dedo aquí' : 'mantén pulsado aquí'}</text>
            </g>
          </svg>
          <div className="w-full max-w-md">
            <div className="h-3 rounded-full bg-white/10 relative overflow-hidden" role="meter" aria-label="Cantidad de pasta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paste * 100)}>
              <div className="absolute inset-y-0 bg-[#7fe0a8]/30" style={{ left: '20%', width: '22%' }} />
              <div className="absolute inset-y-0 left-0 bg-[#9fe7f5]" style={{ width: `${paste * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-[#a9a293] mt-1"><span>Nada</span><span className="text-[#7fe0a8]">Guisante</span><span>Mucha</span></div>
          </div>
          {pasteDone ? (
            <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
              <p className="font-semibold" style={{ color: pasteDone === 'guisante' ? '#7fe0a8' : '#ffb3a1' }}>
                {pasteDone === 'guisante' ? '¡Perfecto! Del tamaño de un guisante.' : pasteDone === 'mucha' ? 'Demasiada: más pasta no limpia más. Con un guisante basta.' : 'Muy poca: pon un poco más, del tamaño de un guisante.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {pasteDone !== 'guisante' && (
                  <button type="button" onClick={() => { setPaste(0); setPasteDone(null); }} className="h-11 px-5 rounded-xl border border-white/15 text-[#e9e3d6] inline-flex items-center gap-2 cursor-pointer">
                    <RotateCcw className="w-4 h-4" aria-hidden /> Volver a poner
                  </button>
                )}
                <button type="button" autoFocus onClick={startBrushing} className="h-12 px-6 rounded-xl font-semibold inline-flex items-center gap-2 cursor-pointer" style={{ background: ACCENT, color: '#052a33' }}>
                  A cepillar <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={paste === 0} onClick={() => setPasteDone(verdict)} className="h-12 px-6 rounded-xl font-semibold cursor-pointer disabled:opacity-40" style={{ background: ACCENT, color: '#052a33' }}>
              Ya está
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'after') {
    return (
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-5 safe-pad">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg flex flex-col gap-4">
            <h2 className="font-display text-3xl text-white">¡Dos minutos! Y ahora, ¿qué haces con la espuma?</h2>
            <div className="flex flex-col gap-2">
              {AFTER_OPTIONS.map((o) => {
                const chosen = after === o.id;
                const state = !after ? 'idle' : o.correct ? 'right' : chosen ? 'wrong' : 'dim';
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!!after}
                    onClick={() => { setAfter(o.id); soundEngine.tone(o.correct ? 880 : 220, 0.18, o.correct ? 'triangle' : 'sawtooth', 0.1); }}
                    className={`min-h-14 rounded-2xl px-4 py-3 border text-left flex items-center gap-3 cursor-pointer disabled:cursor-default ${
                      state === 'right' ? 'border-[#7fe0a8] bg-[#7fe0a8]/15 text-white' : state === 'wrong' ? 'border-[#ff8f8f] bg-[#ff8f8f]/12 text-white' : state === 'dim' ? 'border-white/8 text-[#8e887c]' : 'border-white/15 bg-white/[0.03] text-[#f4efe6] hover:border-white/35'
                    }`}
                  >
                    {state === 'right' ? <Check className="w-5 h-5 text-[#7fe0a8]" aria-label="Correcta" /> : state === 'wrong' ? <XIcon className="w-5 h-5 text-[#ff8f8f]" aria-label="Incorrecta" /> : <span className="w-5" />}
                    {o.text}
                  </button>
                );
              })}
            </div>
            {after && (
              <>
                <p className="text-[#e9e3d6] leading-relaxed">Lo mejor es escupir la espuma y no enjuagarse con agua: así el flúor de la pasta sigue protegiendo tus dientes un rato más. Y recuerda: el cepillado de antes de dormir es el más importante.</p>
                <button type="button" autoFocus onClick={() => finish(after)} className="self-start h-12 px-6 rounded-xl font-semibold inline-flex items-center gap-2 cursor-pointer" style={{ background: ACCENT, color: '#052a33' }}>
                  Ver resultado <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
              </>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Cepillado ──
  const faceTotal = quadrantSeconds * FACE_SHARE[face];
  const doneFaces = results.current;
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 sm:px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-semibold text-white">Zona {q + 1} de 4: {quad.label}</span>
        <span className="text-[#9fe7f5]">{FACE_LABEL[face]}</span>
        <span className={`inline-flex items-center gap-1.5 [font-variant-numeric:tabular-nums] ${timeLeft < 3 ? 'text-[#ffb3a1]' : 'text-[#c9c2b4]'}`}>
          <Timer className="w-4 h-4" aria-hidden /> {Math.ceil(timeLeft)} s
        </span>
        <span className="inline-flex items-center gap-2 text-[#c9c2b4]">
          Limpio
          <span className="w-24 h-2 rounded-full bg-white/10 overflow-hidden" role="meter" aria-label="Limpieza de esta cara" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clean * 100)}>
            <span className="block h-full bg-[#7fe0a8]" style={{ width: `${clean * 100}%` }} />
          </span>
          <span className="[font-variant-numeric:tabular-nums] text-white">{Math.round(clean * 100)} %</span>
        </span>
        {/* mapa de la boca: 12 caras (4 zonas × 3) */}
        <span className="ml-auto inline-grid grid-cols-6 gap-0.5" aria-label={`Caras cepilladas: ${doneFaces.length} de 12`}>
          {QUADRANTS.flatMap((qq, qi) =>
            FACES.map((ff, fj) => {
              const k = qi * 3 + fj;
              const v = doneFaces[k];
              const current = qi === q && fj === fi;
              return <span key={`${qq.id}-${ff}`} className="w-3 h-3 rounded-sm" style={{ background: v !== undefined ? `rgba(127,224,168,${0.25 + v * 0.75})` : current ? ACCENT : 'rgba(255,255,255,0.12)' }} />;
            }),
          )}
        </span>
      </div>
      <div className="px-4 sm:px-6 pb-2">
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full bg-[#9fe7f5]" style={{ width: `${(1 - timeLeft / faceTotal) * 100}%` }} />
        </div>
      </div>
      <div ref={wrapRef} className="relative flex-1 min-h-0 flex items-center justify-center px-3 pb-3">
        <canvas
          ref={canvasRef}
          style={{ width: size.w, height: size.h }}
          className="rounded-[22px] touch-none cursor-none shadow-[0_0_0_6px_#1b1f2b,0_30px_60px_-20px_rgba(0,0,0,0.8)]"
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); brush.current.down = true; const p = toFace(e); stroke.current = newStroke(); move(p.x, p.y); }}
          onPointerMove={onPointerMove}
          onPointerUp={() => { brush.current.down = false; }}
          onPointerCancel={() => { brush.current.down = false; }}
          onPointerLeave={() => { brush.current.shown = false; brush.current.down = false; }}
          role="img"
          aria-label={`${quad.label}, ${FACE_LABEL[face].toLowerCase()}: ${Math.round(clean * 100)} % limpio`}
        />
        {banner && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-2xl bg-[#0b1220]/90 px-6 py-4 text-center">
              <div className="font-display text-2xl text-white first-letter:uppercase">{banner}</div>
              <div className="text-sm text-[#9fe7f5] mt-1">Inclina el cepillo hacia la encía</div>
            </div>
          </motion.div>
        )}
      </div>
      <div className="px-4 sm:px-6 pb-4 flex flex-wrap items-center justify-between gap-3 safe-pad !pt-0">
        <span className="text-sm min-h-5" aria-live="polite" style={{ color: tip ? (tip.ok ? '#7fe0a8' : '#ffb3a1') : '#a9a293' }}>
          {tip ? tip.text : touch ? 'Pasa el dedo sobre los dientes con vaivenes cortos.' : 'Mueve el ratón sobre los dientes con vaivenes cortos (o usa las flechas).'}
        </span>
        <button
          type="button"
          onClick={nextFace}
          disabled={clean < 0.9}
          className="h-11 px-5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: ACCENT, color: '#052a33' }}
          title={clean < 0.9 ? 'Deja esta cara limpia al 90 % para pasar antes de tiempo' : undefined}
        >
          {clean >= 0.9 ? '¡Limpio! Siguiente' : 'Siguiente'} <ArrowRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
