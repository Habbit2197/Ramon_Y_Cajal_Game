/**
 * TouchControls.tsx — Joystick virtual y botones para jugar el Arcade en móvil y tablet.
 * El joystick escribe en useGameStore.joystickVector (lo lee Player.tsx);
 * los botones disparan los mismos eventos que el teclado.
 */
import { useEffect, useRef, useState } from 'react';
import { Zap, Waves } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { world } from '../../engine/world';

const RADIUS = 52; // recorrido máximo del pomo, en px
const DEAD = 0.12;

export function TouchControls() {
  const setJoy = useGameStore((s) => s.setJoystickVector);
  const resetJoy = useGameStore((s) => s.resetJoystickVector);
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const ultRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => resetJoy(), [resetJoy]);

  // El botón Ola se ilumina cuando está cargada
  useEffect(() => {
    const t = window.setInterval(() => {
      if (ultRef.current) ultRef.current.dataset.ready = world.player.ultCharge >= 100 ? 'true' : 'false';
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  const move = (clientX: number, clientY: number) => {
    const r = baseRef.current!.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    setKnob({ x: dx, y: dy });
    const nx = dx / RADIUS, ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    setJoy(mag < DEAD ? { x: 0, z: 0 } : { x: nx, z: ny });
  };

  const end = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    resetJoy();
  };

  return (
    <div className="absolute inset-x-0 bottom-[10.5rem] sm:bottom-40 z-40 flex items-end justify-between px-5 pointer-events-none select-none">
      <div
        ref={baseRef}
        role="slider"
        aria-label="Joystick de movimiento"
        aria-valuetext="Arrastra para moverte"
        className="pointer-events-auto w-32 h-32 rounded-full bg-white/8 border border-white/20 backdrop-blur-sm relative touch-none"
        onPointerDown={(e) => {
          pointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerId.current === e.pointerId) move(e.clientX, e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span
          className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-[#5ee6ff]/35 border border-[#5ee6ff]/70"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        <button
          ref={ultRef}
          type="button"
          aria-label="Lanzar Ola de Potenciación"
          onPointerDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('trigger-touch-ult')); }}
          className="ult-touch w-16 h-16 rounded-full bg-[#06161c]/80 border border-[#5ee6ff]/40 text-[#7ff3ff] inline-flex flex-col items-center justify-center text-[0.65rem] font-semibold touch-none"
        >
          <Waves className="w-5 h-5" aria-hidden />
          Ola
        </button>
        <button
          type="button"
          aria-label="Impulso de mielina"
          onPointerDown={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('trigger-touch-dash')); }}
          className="w-20 h-20 rounded-full bg-[#ffd166] text-[#1a1206] inline-flex flex-col items-center justify-center text-xs font-semibold shadow-lg active:scale-95 touch-none"
        >
          <Zap className="w-6 h-6" aria-hidden />
          Impulso
        </button>
      </div>
    </div>
  );
}
