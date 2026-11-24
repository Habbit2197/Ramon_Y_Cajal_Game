/**
 * RhythmGame.tsx — Sinapsis rítmica: soltar neurotransmisores a tiempo hasta que la neurona dispare.
 *
 * Canvas para los carriles y las notas (a 60 fps sin re-render de React) y un HUD en DOM
 * que se actualiza 10 veces por segundo.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LabGameProps } from './LabMode';
import { LANES, RHYTHM_RULES, makeChart, songLength, newRhythm, tap, advance, accuracy, rhythmCards, type Lane, type RhythmState } from '../../game/lab/rhythm';
import { activeParams } from '../../game/difficulty';
import { soundEngine } from '../../game/sound';

const FALL = 1.7; // segundos que tarda una nota en bajar
const KEYS: Record<string, Lane> = { KeyA: 0, KeyS: 1, KeyD: 2, KeyJ: 0, KeyK: 1, KeyL: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 };

export default function RhythmGame({ seed, paused, touch, onFinish }: LabGameProps) {
  const params = useMemo(() => activeParams().lab, []);
  const bpm = Math.round(100 / Math.sqrt(params.time));
  const tol = params.tolerance;
  const state = useRef<RhythmState>(newRhythm(makeChart(seed, bpm)));
  const length = songLength(bpm);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ start: performance.now(), pausedAt: 0, pausedTotal: 0 });
  const pressed = useRef<[number, number, number]>([0, 0, 0]);
  const [hud, setHud] = useState({ score: 0, combo: 0, potential: 0, fires: 0, t: 0 });
  const finished = useRef(false);
  const pausedRef = useRef(paused);

  const now = () => (pausedRef.current ? clock.current.pausedAt : performance.now() - clock.current.start - clock.current.pausedTotal) / 1000;

  // Pausa: el reloj de la canción se detiene
  useEffect(() => {
    const c = clock.current;
    if (paused && !pausedRef.current) c.pausedAt = performance.now() - c.start - c.pausedTotal;
    if (!paused && pausedRef.current) c.pausedTotal = performance.now() - c.start - c.pausedAt;
    pausedRef.current = paused;
  }, [paused]);

  const press = (lane: Lane) => {
    if (pausedRef.current || finished.current) return;
    pressed.current[lane] = performance.now();
    const t = now();
    const r = tap(state.current, lane, t, tol);
    if (r.result === 'perfect' || r.result === 'good') soundEngine.tone(LANES[lane].freq, 0.12, 'triangle', r.result === 'perfect' ? 0.13 : 0.09);
    else if (r.result === 'tapped') soundEngine.tone(110, 0.25, 'sawtooth', 0.08);
    if (r.fired) {
      soundEngine.tone(523.25, 0.3, 'sine', 0.1);
      soundEngine.tone(783.99, 0.3, 'sine', 0.08, 0.06);
      soundEngine.tone(1046.5, 0.4, 'sine', 0.07, 0.12);
      navigator.vibrate?.(30);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = KEYS[e.code];
      if (l === undefined || e.repeat) return;
      e.preventDefault();
      press(l);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Bucle de dibujo
  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let lastT = now();
    let nextBeat = 0;
    const beat = 60 / bpm;
    let hudAt = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = cv.getBoundingClientRect();
      const W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const t = now();
      const s = state.current;
      if (!pausedRef.current) {
        advance(s, t, Math.max(0, t - lastT), tol);
        // pulso del ritmo
        const b = Math.floor((t - RHYTHM_RULES.lead) / beat);
        if (t >= RHYTHM_RULES.lead && b >= nextBeat && t < length - 1.5) {
          nextBeat = b + 1;
          soundEngine.kick(b % 4 === 0 ? 0.16 : 0.08);
        }
        if (t >= length && !finished.current) {
          finished.current = true;
          const acc = accuracy(s);
          onFinish({
            score: s.score,
            completed: acc >= 70,
            accuracy: acc,
            cards: rhythmCards(s),
            detail: `${Math.round(acc)} % de aciertos`,
            lines: [`Aciertos: ${Math.round(acc)} %.`, `Potenciales de acción: ${s.fires}.`, `Mejor combo: ${s.bestCombo}. Frenos de GABA esquivados: ${s.gabaAvoided}.`],
          });
        }
      }
      lastT = t;

      // ── Dibujo ──
      ctx.clearRect(0, 0, W, H);
      const laneW = Math.min(W / 3.4, 150 * dpr);
      const x0 = (W - laneW * 3) / 2;
      const hitY = H * 0.8;
      const pxPerSec = (hitY - 20 * dpr) / FALL;
      // carriles: axones que bajan
      for (let l = 0; l < 3; l++) {
        const cx = x0 + laneW * (l + 0.5);
        const glow = Math.max(0, 1 - (performance.now() - pressed.current[l]) / 180);
        ctx.fillStyle = `rgba(255,255,255,${0.03 + glow * 0.08})`;
        ctx.fillRect(x0 + laneW * l + 4 * dpr, 0, laneW - 8 * dpr, H);
        ctx.strokeStyle = `${LANES[l].color}55`;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, hitY);
        ctx.stroke();
        // receptor en la membrana
        ctx.strokeStyle = LANES[l].color;
        ctx.lineWidth = (3 + glow * 3) * dpr;
        ctx.beginPath();
        ctx.moveTo(cx - 16 * dpr, hitY + 14 * dpr);
        ctx.lineTo(cx, hitY);
        ctx.lineTo(cx + 16 * dpr, hitY + 14 * dpr);
        ctx.stroke();
      }
      // membrana de la otra neurona
      ctx.strokeStyle = 'rgba(127,224,168,0.7)';
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.moveTo(x0 - 10 * dpr, hitY + 18 * dpr);
      ctx.quadraticCurveTo(W / 2, hitY + 30 * dpr, x0 + laneW * 3 + 10 * dpr, hitY + 18 * dpr);
      ctx.stroke();
      // notas
      for (const n of s.notes) {
        const dy = (n.t - t) * pxPerSec;
        if (dy > hitY + 30 * dpr) break;
        if (n.result !== null && n.result !== 'avoided') continue;
        if (dy < -60 * dpr) continue;
        const cx = x0 + laneW * (n.lane + 0.5);
        const y = hitY - dy;
        const r = Math.min(22 * dpr, laneW * 0.22);
        if (n.gaba) {
          ctx.globalAlpha = n.result === 'avoided' ? 0.35 : 1;
          ctx.fillStyle = '#ff6b6b';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(cx - r, y - r * 0.8, r * 2, r * 1.6, 6 * dpr);
          else ctx.rect(cx - r, y - r * 0.8, r * 2, r * 1.6);
          ctx.fill();
          ctx.fillStyle = '#2b0606';
          ctx.fillRect(cx - r * 0.6, y - 3 * dpr, r * 1.2, 6 * dpr);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = LANES[n.lane].color;
          ctx.beginPath();
          ctx.arc(cx, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(cx + Math.cos(k * 2.1) * r * 0.4, y + Math.sin(k * 2.1) * r * 0.4, r * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // juicio
      const last = s.last;
      if (last && t - last.at < 0.6) {
        const k = (t - last.at) / 0.6;
        const label = { perfect: '¡Perfecto!', good: 'Bien', miss: 'Fallo', tapped: '¡Era un freno!', avoided: '', fire: '¡Potencial de acción!' }[last.kind ?? 'miss'] ?? '';
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = last.kind === 'fire' ? '#ffd166' : last.kind === 'miss' || last.kind === 'tapped' ? '#ff9f9f' : '#ffffff';
        ctx.font = `600 ${(last.kind === 'fire' ? 26 : 18) * dpr}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(label, last.kind === 'fire' ? W / 2 : x0 + laneW * (last.lane + 0.5), hitY - (60 + k * 30) * dpr);
        ctx.globalAlpha = 1;
      }
      if (t < RHYTHM_RULES.lead) {
        ctx.fillStyle = '#f4efe6';
        ctx.font = `600 ${28 * dpr}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(t < RHYTHM_RULES.lead - 0.6 ? '¡Prepárate!' : '¡Ya!', W / 2, H * 0.4);
      }
      const nowMs = performance.now();
      if (nowMs - hudAt > 100) {
        hudAt = nowMs;
        setHud({ score: s.score, combo: s.combo, potential: s.potential, fires: s.fires, t });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(1, hud.t / length);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 sm:px-6 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-2xl font-semibold text-white [font-variant-numeric:tabular-nums]">{hud.score.toLocaleString('es-ES')}</span>
          <span className="text-[#c9c2b4]">Combo <strong className="text-white">{hud.combo}</strong></span>
          <span className="text-[#ffd166]">Disparos: {hud.fires}</span>
        </div>
        <div className="flex items-center gap-2" title="Potencial de la neurona: al llegar al umbral, dispara">
          <span className="text-xs text-[#a9a293] shrink-0">Potencial</span>
          <span className="relative flex-1 h-3 rounded-full bg-white/10 overflow-hidden" role="meter" aria-label="Potencial de la neurona" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.potential)}>
            <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#7fe0a8] to-[#ffd166] transition-[width] duration-100" style={{ width: `${hud.potential}%` }} />
          </span>
          <span className="text-xs text-[#ffd166] shrink-0">Umbral</span>
        </div>
        <div className="h-1 rounded-full bg-white/8 overflow-hidden" aria-hidden>
          <div className="h-full bg-white/30" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-label="Carriles de neurotransmisores" role="img" />
        {/* Zonas táctiles (también sirven con ratón) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] flex justify-center safe-pad !pt-0 !px-0">
          <div className="flex h-full" style={{ width: 'min(88.2%, 450px)' }}>
            {LANES.map((l, i) => (
              <button
                key={l.name}
                type="button"
                aria-label={`Soltar ${l.name}`}
                onPointerDown={(e) => { e.preventDefault(); press(i as Lane); }}
                className="flex-1 h-full touch-none flex items-end justify-center pb-3 cursor-pointer select-none"
              >
                <span className="text-[0.7rem] font-semibold rounded-full px-2 py-0.5 bg-black/40" style={{ color: l.color }}>
                  {l.name}
                  {!touch && <span className="text-[#8e887c] font-normal"> ({['A', 'S', 'D'][i]})</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
