/**
 * CajalQuiz.tsx — Pregunta de Cajal entre niveles.
 *
 * Tres respuestas grandes (teclas 1, 2 y 3 en escritorio). Acierte o falle, se explica
 * la respuesta; si acierta, se dice qué ayuda gana y qué ficha del Museo descubre.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, ArrowRight, Landmark } from 'lucide-react';
import { pickQuestion, shuffledOptions, REWARD_TEXT, type QuizReward } from '../../game/quiz';
import { MUSEUM_BY_ID } from '../../game/museum';
import { mulberry32 } from '../../engine/rng';
import { useProfileStore, useCurrentProgress } from '../../store/useProfileStore';
import { soundEngine } from '../../game/sound';

export function CajalQuiz({
  reward,
  accent = '#e8b45a',
  seed,
  onDone,
}: {
  reward: QuizReward;
  accent?: string;
  /** Semilla fija (Desafío Diario): misma pregunta para todos */
  seed?: number;
  onDone: (correct: boolean) => void;
}) {
  const progress = useCurrentProgress();
  // la pregunta se elige una vez al abrir
  const [question] = useState(() => pickQuestion(progress.quizAnswered, seed !== undefined ? mulberry32(seed) : Math.random));
  const options = useMemo(() => shuffledOptions(question, seed ?? Date.now()), [question, seed]);
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;
  const correct = answered && options[chosen].correct;
  const card = MUSEUM_BY_ID[question.card];
  const alreadyKnown = !!progress.discoveries[question.card];

  const choose = (i: number) => {
    if (answered) return;
    setChosen(i);
    const ok = options[i].correct;
    useProfileStore.getState().recordQuiz(question.id, ok);
    if (ok) soundEngine.tone(880, 0.18, 'triangle', 0.14);
    else soundEngine.tone(196, 0.25, 'sawtooth', 0.08);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!answered && ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) {
        e.preventDefault();
        choose(Number(e.code.slice(-1)) - 1);
      } else if (answered && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        onDone(correct);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="quiz-q" className="fixed inset-0 z-[55] bg-[#070b14]/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 safe-pad">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-lg rounded-3xl bg-[#121a2a]/97 border p-6 sm:p-7 flex flex-col gap-5"
          style={{ borderColor: `${accent}55` }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: accent }}>Pregunta de Cajal</div>
            <h2 id="quiz-q" className="mt-1 font-display text-2xl sm:text-[1.7rem] leading-tight text-white">{question.q}</h2>
            {!answered && <p className="mt-1.5 text-sm text-[#a9a293]">Si aciertas: {REWARD_TEXT[reward].charAt(0).toLowerCase() + REWARD_TEXT[reward].slice(1)}</p>}
          </div>

          <ol className="flex flex-col gap-2.5">
            {options.map((o, i) => {
              const state = !answered ? 'idle' : o.correct ? 'right' : i === chosen ? 'wrong' : 'dim';
              return (
                <li key={o.text}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => choose(i)}
                    autoFocus={i === 0}
                    className={`w-full min-h-14 text-left rounded-2xl px-4 py-3 border flex items-center gap-3 transition-colors cursor-pointer disabled:cursor-default ${
                      state === 'right'
                        ? 'border-[#7fe0a8] bg-[#7fe0a8]/15 text-white'
                        : state === 'wrong'
                          ? 'border-[#ff8f8f] bg-[#ff8f8f]/12 text-white'
                          : state === 'dim'
                            ? 'border-white/8 text-[#8e887c]'
                            : 'border-white/15 bg-white/[0.03] text-[#f4efe6] hover:border-white/35 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full shrink-0 inline-flex items-center justify-center text-sm font-semibold bg-white/8">
                      {state === 'right' ? <Check className="w-4 h-4 text-[#7fe0a8]" aria-label="Correcta" /> : state === 'wrong' ? <X className="w-4 h-4 text-[#ff8f8f]" aria-label="Incorrecta" /> : i + 1}
                    </span>
                    <span className="text-[0.98rem] leading-snug">{o.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {answered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3" aria-live="polite">
              <p className="text-[1.05rem] font-semibold" style={{ color: correct ? '#7fe0a8' : '#ffb3a1' }}>
                {correct ? '¡Correcto!' : 'Casi. La respuesta buena está marcada en verde.'}
              </p>
              <p className="text-[#e9e3d6] leading-relaxed">{question.explain}</p>
              {correct && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-[#e9e3d6] flex flex-col gap-1.5">
                  <span><strong className="text-white">Ayuda ganada:</strong> {REWARD_TEXT[reward]}</span>
                  {card && !alreadyKnown && (
                    <span className="inline-flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-[#7fe0a8]" aria-hidden />
                      Nueva ficha en el Museo: <strong className="text-white">{card.title}</strong>
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => onDone(correct)}
                className="self-start h-12 px-6 rounded-xl font-semibold inline-flex items-center gap-2 cursor-pointer"
                style={{ background: accent, color: '#14110b' }}
              >
                Seguir <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
