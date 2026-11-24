/**
 * BuildGame.tsx — Construye la neurona: tres talleres con piezas, pistas y un impulso final.
 *
 * Las piezas se arrastran a su hueco o se tocan (pieza y luego hueco). Cada hueco tiene
 * un número y una pista sobre la función de la parte que falta.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Zap, ArrowRight, Timer } from 'lucide-react';
import type { LabGameProps } from './LabMode';
import { BUILD_LEVELS, PARTS, LEVEL_SECONDS, newBuildState, placePart, levelComplete, levelScore, wrongMessage, type BuildState } from '../../game/lab/build';
import { shuffle } from '../../game/daily';
import { mulberry32 } from '../../engine/rng';
import { activeParams } from '../../game/difficulty';
import { soundEngine } from '../../game/sound';

const ON = '#ffb86b';
const OFF = '#3a4358';

/** Dibujo de cada pieza; `on` = colocada (en color) o no (contorno apagado) */
function Part({ id, on, level }: { id: string; on: boolean; level: number }) {
  const stroke = on ? ON : OFF;
  const dash = on ? undefined : '5 5';
  switch (id) {
    case 'dendritas':
      return (
        <g fill="none" stroke={stroke} strokeWidth={on ? 6 : 3} strokeLinecap="round" strokeDasharray={dash}>
          <path d="M142 140 C110 120 90 104 58 88 M100 116 C84 108 70 112 40 104 M142 160 C112 178 92 194 60 212 M100 184 C86 194 72 190 42 200 M140 150 C110 150 80 148 26 150 M80 149 C70 138 58 132 46 126" />
        </g>
      );
    case 'soma':
      return <circle cx={175} cy={150} r={36} fill={on ? `${ON}33` : 'none'} stroke={stroke} strokeWidth={on ? 5 : 3} strokeDasharray={dash} />;
    case 'nucleo':
      return <circle cx={175} cy={150} r={12} fill={on ? ON : 'none'} stroke={stroke} strokeWidth={3} strokeDasharray={dash} />;
    case 'axon':
      return level === 1 ? (
        <path d="M211 150 L286 150" stroke={stroke} strokeWidth={on ? 8 : 4} strokeLinecap="round" strokeDasharray={dash} />
      ) : (
        <path d="M211 150 L396 150" stroke={stroke} strokeWidth={on ? 8 : 4} strokeLinecap="round" strokeDasharray={dash} />
      );
    case 'mielina':
      return (
        <g fill={on ? '#f4efe6' : 'none'} stroke={on ? '#d6c9a8' : OFF} strokeWidth={3} strokeDasharray={dash}>
          <rect x={288} y={136} width={50} height={28} rx={13} />
          <rect x={364} y={136} width={30} height={28} rx={13} />
        </g>
      );
    case 'ranvier':
      return <g stroke={stroke} strokeWidth={on ? 4 : 2.5} strokeDasharray={dash}><path d="M351 138 L351 162" /><circle cx={351} cy={150} r={on ? 6 : 5} fill={on ? ON : 'none'} /></g>;
    case 'terminales':
      return level === 2 ? (
        <path d="M240 0 L240 14 C200 18 156 40 156 76 C156 116 196 128 240 128 C284 128 324 116 324 76 C324 40 280 18 240 14" fill={on ? `${ON}26` : 'none'} stroke={stroke} strokeWidth={on ? 5 : 3} strokeDasharray={dash} />
      ) : (
        <g fill={on ? ON : 'none'} stroke={stroke} strokeWidth={on ? 5 : 3} strokeLinecap="round" strokeDasharray={dash}>
          <path d="M396 150 C414 140 426 120 444 108 M396 150 L452 150 M396 150 C414 162 426 180 444 194" fill="none" />
          <circle cx={448} cy={106} r={8} />
          <circle cx={456} cy={150} r={8} />
          <circle cx={448} cy={196} r={8} />
        </g>
      );
    case 'vesiculas':
      return (
        <g fill={on ? '#ff8fb1' : 'none'} stroke={on ? '#ff8fb1' : OFF} strokeWidth={2.5} strokeDasharray={on ? undefined : '3 3'}>
          {[[204, 100], [228, 110], [252, 98], [276, 108], [240, 90]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={9} fillOpacity={on ? 0.5 : 0} />)}
        </g>
      );
    case 'hendidura':
      return <rect x={124} y={142} width={232} height={18} rx={4} fill={on ? '#5ee6ff22' : 'none'} stroke={on ? '#5ee6ff' : OFF} strokeWidth={2.5} strokeDasharray={on ? '2 6' : dash} />;
    case 'receptores':
      return (
        <g stroke={stroke} strokeWidth={on ? 4 : 2.5} fill="none" strokeLinecap="round" strokeDasharray={dash}>
          {[170, 205, 240, 275, 310].map((x) => <path key={x} d={`M${x} 190 L${x} 178 M${x - 7} 170 L${x} 178 L${x + 7} 170`} />)}
        </g>
      );
    case 'postsinaptica':
      return <path d="M120 300 L120 214 C120 196 150 190 240 190 C330 190 360 196 360 214 L360 300" fill={on ? '#7fe0a822' : 'none'} stroke={on ? '#7fe0a8' : OFF} strokeWidth={on ? 5 : 3} strokeDasharray={dash} />;
  }
  return null;
}

/** Lo que ya está montado en los talleres 2 y 3 (contexto, no se coloca) */
function Context({ level }: { level: number }) {
  if (level === 1)
    return (
      <g opacity={0.9}>
        <Part id="dendritas" on level={0} />
        <Part id="soma" on level={0} />
        <Part id="nucleo" on level={0} />
        <path d="M286 150 L396 150" stroke={ON} strokeWidth={6} strokeLinecap="round" />
      </g>
    );
  return null;
}

/** Recorrido del impulso al terminar cada taller */
function Impulse({ level }: { level: number }) {
  if (level === 0)
    return (
      <circle r={9} fill="#fff6d8" style={{ filter: 'drop-shadow(0 0 8px #ffd166)' }}>
        <animateMotion dur="2.2s" repeatCount="indefinite" path="M40 104 C70 112 100 116 142 140 L175 150 L396 150 C414 140 426 120 448 106" />
      </circle>
    );
  if (level === 1)
    return (
      <g>
        {/* con mielina: salta de nodo en nodo */}
        <circle r={9} fill="#fff6d8" style={{ filter: 'drop-shadow(0 0 8px #ffd166)' }}>
          <animateMotion dur="1.2s" repeatCount="indefinite" calcMode="discrete" keyPoints="0;0.306;0.571;1" keyTimes="0;0.25;0.5;0.75" path="M211 150 L286 150 L351 150 L456 150" />
        </circle>
        <text x={330} y={110} fill="#ffd166" fontSize={13} textAnchor="middle">¡salta de nodo en nodo!</text>
      </g>
    );
  return (
    <g>
      {[204, 240, 276].map((x, i) => (
        <circle key={x} cx={x} r={4} fill="#ff8fb1">
          <animate attributeName="cy" values="104;150;178" dur="1.6s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0" dur="1.6s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <rect x={150} y={168} width={180} height={4} fill="#7fe0a8">
        <animate attributeName="opacity" values="0;0;1;0" dur="1.6s" repeatCount="indefinite" />
      </rect>
    </g>
  );
}

export default function BuildGame({ seed, paused, onFinish }: LabGameProps) {
  const params = useMemo(() => activeParams().lab, []);
  const levelSeconds = LEVEL_SECONDS * params.time;
  const [level, setLevel] = useState(0);
  const st = useRef<BuildState>(newBuildState(0));
  const [, force] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(levelSeconds);
  const [done, setDone] = useState<null | { score: number }>(null);
  const [impulse, setImpulse] = useState(false);
  const total = useRef({ score: 0, mistakes: 0, cards: new Set<string>() });
  const finished = useRef(false);
  const lvl = BUILD_LEVELS[level];
  const complete = levelComplete(st.current);

  const chips = useMemo(
    () => shuffle([...lvl.slots.map((s) => s.part), lvl.intruder.id], mulberry32(seed + level * 31)),
    [lvl, seed, level],
  );
  const label = (id: string) => PARTS[id]?.label ?? lvl.intruder.label;

  useEffect(() => {
    if (paused || complete) return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      setTimeLeft((v) => Math.max(0, v - (now - last) / 1000));
      last = now;
    }, 100);
    return () => window.clearInterval(t);
  }, [paused, complete]);

  const attempt = (partId: string, slotPart: string) => {
    if (st.current.placed[slotPart]) return;
    const ok = placePart(st.current, partId, slotPart);
    if (ok) {
      soundEngine.tone(660 + Object.keys(st.current.placed).length * 90, 0.14, 'triangle', 0.12);
      const card = PARTS[partId]?.card;
      if (card) total.current.cards.add(card);
      setMessage({ ok: true, text: `${label(partId)}: ¡en su sitio!` });
      setSelected(null);
      if (levelComplete(st.current)) {
        const sc = levelScore(st.current.mistakes, timeLeft, 120 / params.tolerance);
        total.current.score += sc;
        total.current.mistakes += st.current.mistakes;
        setDone({ score: sc });
        soundEngine.playPortalReady();
      }
    } else {
      soundEngine.tone(196, 0.2, 'sawtooth', 0.07);
      navigator.vibrate?.(40);
      setMessage({ ok: false, text: wrongMessage(level, partId, slotPart) });
    }
    force((n) => n + 1);
  };

  const next = () => {
    if (level + 1 >= BUILD_LEVELS.length) {
      if (finished.current) return;
      finished.current = true;
      const t = total.current;
      onFinish({
        score: t.score,
        completed: true,
        cards: [...t.cards],
        detail: `Tres talleres, ${t.mistakes} ${t.mistakes === 1 ? 'fallo' : 'fallos'}`,
        lines: ['Has montado la neurona, la neurona rápida y la sinapsis.', `Fallos: ${t.mistakes}.`],
      });
      return;
    }
    st.current = newBuildState(level + 1);
    setLevel(level + 1);
    setDone(null);
    setImpulse(false);
    setMessage(null);
    setSelected(null);
    setTimeLeft(levelSeconds);
  };

  // Arrastrar piezas (ratón y dedo)
  const drag = useRef<{ id: string; x0: number; y0: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const onChipDown = (e: React.PointerEvent, id: string) => {
    if (paused || complete) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = { id, x0: e.clientX, y0: e.clientY, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) d.moved = true;
      if (d.moved) setGhost({ id: d.id, x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      setGhost(null);
      if (!d.moved) {
        setSelected((s) => (s === d.id ? null : d.id));
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]');
      const slot = el?.getAttribute('data-slot');
      if (slot) attempt(d.id, slot);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl text-white">Taller {level + 1} de 3: {lvl.title}</h2>
            <p className="text-sm text-[#c9c2b4]">{lvl.intro}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-[#c9c2b4] [font-variant-numeric:tabular-nums]" title="Cuanto antes termines, más puntos">
            <Timer className="w-4 h-4" aria-hidden /> {Math.ceil(timeLeft)} s
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="rounded-2xl bg-[#0f1626] border border-white/8 p-2">
            <svg viewBox="0 0 480 300" className="w-full h-auto select-none" role="img" aria-label={`Dibujo del taller ${lvl.title}`}>
              <Context level={level} />
              {lvl.slots.map((s) => <Part key={s.part} id={s.part} on={!!st.current.placed[s.part]} level={level} />)}
              {lvl.slots.map((s, i) => {
                const placed = st.current.placed[s.part];
                if (s.after && !st.current.placed[s.after]) return null; // hueco interior: después del de fuera
                return (
                  <g
                    key={`slot-${s.part}`}
                    data-slot={s.part}
                    onClick={() => (selected ? attempt(selected, s.part) : setMessage({ ok: true, text: `Hueco ${i + 1}: ${s.clue}` }))}
                    className={placed ? '' : 'cursor-pointer'}
                  >
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      rx={8}
                      fill={selected && !placed ? 'rgba(255,184,107,0.10)' : 'transparent'}
                      stroke={placed ? 'transparent' : selected ? ON : 'rgba(255,255,255,0.25)'}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    {!placed && (
                      <g>
                        <circle cx={s.x + 10} cy={s.y + 10} r={9} fill="#ffb86b" />
                        <text x={s.x + 10} y={s.y + 14} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2a1404">{i + 1}</text>
                      </g>
                    )}
                  </g>
                );
              })}
              {impulse && <Impulse level={level} />}
            </svg>
          </div>

          <div className="flex flex-col gap-3">
            <ol className="flex flex-col gap-1.5 text-sm">
              {lvl.slots.map((s, i) => {
                const placed = st.current.placed[s.part];
                return (
                  <li key={s.part} className={`flex gap-2 items-start rounded-lg px-2 py-1.5 ${placed ? 'text-[#8e887c]' : 'text-[#e9e3d6]'}`}>
                    <span className={`w-5 h-5 rounded-full shrink-0 inline-flex items-center justify-center text-[0.7rem] font-bold ${placed ? 'bg-[#7fe0a8] text-[#06200f]' : 'bg-[#ffb86b] text-[#2a1404]'}`}>
                      {placed ? <Check className="w-3 h-3" aria-label="Colocada" /> : i + 1}
                    </span>
                    <span>
                      {placed ? <strong className="text-[#7fe0a8] font-semibold">{label(s.part)}. </strong> : null}
                      {s.clue}
                      {!placed && s.after && !st.current.placed[s.after] ? <span className="text-[#8e887c]"> (Aparece al colocar {label(s.after).toLowerCase()}.)</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {!complete ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-[#a9a293]" aria-live="polite">
              {message ? <span style={{ color: message.ok ? '#7fe0a8' : '#ffb3a1' }}>{message.text}</span> : selected ? `Ahora toca el hueco de «${label(selected)}».` : 'Arrastra una pieza a su hueco, o tócala y después toca el hueco.'}
            </div>
            <div className="flex flex-wrap gap-2" role="listbox" aria-label="Piezas">
              {chips.map((id) => {
                const used = !!st.current.placed[id];
                if (used) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected === id}
                    onPointerDown={(e) => onChipDown(e, id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected((s) => (s === id ? null : id)); } }}
                    className={`touch-none h-12 px-4 rounded-xl border text-sm font-semibold cursor-grab active:cursor-grabbing transition-colors ${
                      selected === id ? 'bg-[#ffb86b] text-[#2a1404] border-transparent' : 'bg-white/[0.04] border-white/15 text-white hover:border-[#ffb86b]'
                    }`}
                  >
                    {label(id)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.04] border border-[#ffb86b]/30 p-4 flex flex-col gap-3">
              {!impulse ? (
                <>
                  <p className="text-white font-semibold">¡Taller montado! Ahora comprueba que funciona.</p>
                  <button type="button" autoFocus onClick={() => { setImpulse(true); soundEngine.playDash(); }} className="self-start h-12 px-6 rounded-xl bg-[#ffb86b] text-[#2a1404] font-semibold inline-flex items-center gap-2 cursor-pointer">
                    <Zap className="w-4 h-4" aria-hidden /> Enviar impulso
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[#e9e3d6] leading-relaxed">{lvl.impulse}</p>
                  <p className="text-sm text-[#ffb86b] [font-variant-numeric:tabular-nums]">+{done?.score.toLocaleString('es-ES')} puntos</p>
                  <button type="button" autoFocus onClick={next} className="self-start h-12 px-6 rounded-xl bg-[#ffb86b] text-[#2a1404] font-semibold inline-flex items-center gap-2 cursor-pointer">
                    {level + 1 >= BUILD_LEVELS.length ? 'Ver resultado' : 'Siguiente taller'} <ArrowRight className="w-4 h-4" aria-hidden />
                  </button>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {ghost && (
        <div className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 h-12 px-4 rounded-xl bg-[#ffb86b] text-[#2a1404] text-sm font-semibold inline-flex items-center shadow-xl" style={{ left: ghost.x, top: ghost.y }}>
          {label(ghost.id)}
        </div>
      )}
    </div>
  );
}
