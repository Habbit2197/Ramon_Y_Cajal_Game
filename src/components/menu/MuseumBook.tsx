/**
 * MuseumBook.tsx — Museo de descubrimientos: fichas por salas, bloqueadas hasta descubrirlas.
 * Cada ficha bloqueada dice dónde encontrarla.
 */
import { useState } from 'react';
import { X, Lock, Landmark, Microscope, Brain, FlaskConical, User } from 'lucide-react';
import { MUSEUM, ROOMS, type MuseumRoom, type MuseumCard } from '../../game/museum';
import { useCurrentProgress, useProfileStore } from '../../store/useProfileStore';
import { NeuronArt } from './NeuronArt';
import type { CellType } from '../../game/lab/neuronShapes';
import { NeuronGlyph } from './NeuronGlyph';

const ROOM_ORDER: MuseumRoom[] = ['cajal', 'escuela', 'neurona', 'tipos', 'quimica', 'regiones', 'cerebro'];
const ROOM_COLOR: Record<MuseumRoom, string> = { cajal: '#e8b45a', escuela: '#d9c08a', neurona: '#ffb86b', tipos: '#7fe0a8', quimica: '#ff8fb1', regiones: '#b49cff', cerebro: '#7fb8ff' };
const CELL_CARDS: Record<string, CellType> = { piramidal: 'piramidal', purkinje: 'purkinje', granulo: 'granulo', estrellada: 'estrellada', astrocito: 'astrocito', golgi: 'piramidal' };

function CardArt({ card, color }: { card: MuseumCard; color: string }) {
  const cell = CELL_CARDS[card.id];
  if (cell) return <NeuronArt type={cell} seed={card.id.length * 31} size={72} ink="#1b130a" />;
  const cls = 'w-8 h-8';
  const Icon = card.room === 'cajal' || card.room === 'escuela' ? User : card.room === 'quimica' ? FlaskConical : card.room === 'cerebro' || card.room === 'regiones' ? Brain : null;
  if (Icon) return <Icon className={cls} style={{ color }} aria-hidden />;
  return <NeuronGlyph color={color} size={46} />;
}

export function MuseumBook({ onClose }: { onClose: () => void }) {
  const progress = useCurrentProgress();
  const playerName = useProfileStore((s) => s.playerName);
  const got = MUSEUM.filter((c) => progress.discoveries[c.id]).length;
  const [room, setRoom] = useState<MuseumRoom | 'all'>('all');
  const rooms = room === 'all' ? ROOM_ORDER : [room];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="museum-title" className="fixed inset-0 z-40 bg-[#0b1220]/92 backdrop-blur-md overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8 md:py-12 safe-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="museum-title" className="font-display text-3xl md:text-4xl text-white flex items-center gap-3">
              <Landmark className="w-7 h-7 text-[#7fe0a8]" aria-hidden />
              Museo de descubrimientos
            </h2>
            <p className="mt-1 text-sm text-[#c9c2b4] max-w-[40rem]">
              {playerName ? `${playerName}: ${got} de ${MUSEUM.length} fichas.` : 'Elige un alias para empezar tu colección.'} Las fichas se descubren acertando preguntas de Cajal, jugando en el Laboratorio y completando desafíos.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" autoFocus className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[#c9c2b4] hover:text-white hover:bg-white/8 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 h-1.5 rounded-full bg-white/8 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={MUSEUM.length} aria-valuenow={got} aria-label="Fichas descubiertas">
          <div className="h-full bg-[#7fe0a8]" style={{ width: `${(got / MUSEUM.length) * 100}%` }} />
        </div>

        <div role="tablist" aria-label="Salas" className="mt-6 flex flex-wrap gap-1.5 text-sm">
          {(['all', ...ROOM_ORDER] as const).map((r) => (
            <button
              key={r}
              role="tab"
              type="button"
              aria-selected={room === r}
              onClick={() => setRoom(r)}
              className={`px-3 py-1.5 rounded-full border cursor-pointer ${room === r ? 'bg-[#f4efe6] text-[#14110b] border-transparent font-semibold' : 'border-white/12 text-[#c9c2b4] hover:text-white'}`}
            >
              {r === 'all' ? 'Todas las salas' : ROOMS[r].label}
            </button>
          ))}
        </div>

        {rooms.map((r) => {
          const cards = MUSEUM.filter((c) => c.room === r);
          const n = cards.filter((c) => progress.discoveries[c.id]).length;
          const color = ROOM_COLOR[r];
          return (
            <section key={r} className="mt-9" aria-labelledby={`room-${r}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={`room-${r}`} className="font-display text-xl text-white">{ROOMS[r].label}</h3>
                <span className="text-sm [font-variant-numeric:tabular-nums]" style={{ color }}>{n}/{cards.length}</span>
              </div>
              <p className="text-sm text-[#a9a293]">{ROOMS[r].blurb}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c) => {
                  const open = !!progress.discoveries[c.id];
                  return (
                    <li key={c.id} className={`rounded-2xl overflow-hidden flex ${open ? 'museum-card flex-col' : 'bg-white/[0.03] border border-white/6 items-center gap-3 px-4 py-3'}`}>
                      {open ? (
                        <>
                          <div className="h-24 flex items-center justify-center museum-plate">
                            <CardArt card={c} color={color} />
                          </div>
                          <div className="p-4 flex flex-col gap-1.5">
                            <span className="font-semibold text-white">{c.title}</span>
                            <p className="text-sm leading-relaxed text-[#e9e3d6]">{c.text}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-[#5d584f] shrink-0" aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[#8e887c]">Ficha por descubrir</span>
                            <span className="block text-xs text-[#8e887c] leading-snug">{c.hint}</span>
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <p className="mt-10 text-xs text-[#8e887c] flex items-center gap-1.5">
          <Microscope className="w-3.5 h-3.5" aria-hidden /> Los dibujos de neuronas se generan al estilo de las láminas de Cajal; no son copias de sus originales.
        </p>
      </div>
    </div>
  );
}
