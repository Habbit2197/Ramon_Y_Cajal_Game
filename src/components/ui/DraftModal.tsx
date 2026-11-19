/**
 * DraftModal.tsx — Elegir una mejora al subir de nivel o al superar una región del Arcade.
 *
 * Pensado para niños y para el móvil: título que dice qué ha pasado, efecto en palabras
 * sencillas, nivel actual de cada carta y tarjetas grandes. En escritorio, teclas 1, 2 y 3.
 */
import { useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Crosshair, Footprints, Shield, Heart, Magnet, Sparkles } from 'lucide-react';
import { useRunStore, REGIONS } from '../../store/useRunStore';
import { UPGRADES, type UpgradeId, type Rarity } from '../../game/upgrades';
import { StarRow } from '../menu/TrophyBook';

const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Común', color: '#e8b45a' },
  rare: { label: 'Rara', color: '#5ee6ff' },
  legendary: { label: 'Legendaria', color: '#ffd166' },
  evolution: { label: 'Evolución', color: '#b49cff' },
};

const REGION_NAMES = ['Corteza prefrontal', 'Hipocampo', 'Cerebelo'];

function TagIcon({ tags }: { tags: string[] }) {
  const cls = 'w-5 h-5';
  if (tags.includes('shot')) return <Crosshair className={cls} aria-hidden />;
  if (tags.includes('move')) return <Footprints className={cls} aria-hidden />;
  if (tags.includes('def')) return <Shield className={cls} aria-hidden />;
  if (tags.includes('hp')) return <Heart className={cls} aria-hidden />;
  if (tags.includes('util')) return <Magnet className={cls} aria-hidden />;
  return <Sparkles className={cls} aria-hidden />;
}

export function DraftModal() {
  const phase = useRunStore((s) => s.phase);
  const offer = useRunStore((s) => s.offer);
  const owned = useRunStore((s) => s.owned) as Record<string, number>;
  const rerolls = useRunStore((s) => s.rerolls);
  const pick = useRunStore((s) => s.pick);
  const reroll = useRunStore((s) => s.reroll);
  const level = useRunStore((s) => s.level);
  const region = useRunStore((s) => s.region);
  const endless = useRunStore((s) => s.endless);
  const wave = useRunStore((s) => s.wave);
  const lastStars = useRunStore((s) => s.lastRegionStars);

  const open = phase === 'draft' || phase === 'regionClear';

  // Teclas 1, 2 y 3 para elegir sin ratón
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (i >= 0 && offer[i]) {
        e.preventDefault();
        pick(offer[i]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, offer, pick]);

  if (!open || offer.length === 0) return null;
  const isRegionClear = phase === 'regionClear';
  // al superar una región, `region` ya apunta a la siguiente
  const clearedName = REGION_NAMES[Math.max(0, region - 1)];

  let title: string;
  let subtitle: string;
  if (isRegionClear && endless && wave > 0) {
    title = `¡Oleada ${wave} superada!`;
    subtitle = 'Recompensa del modo infinito: elige una mejora rara.';
  } else if (isRegionClear && endless) {
    title = 'Modo infinito';
    subtitle = 'Elige una mejora para empezar. Las oleadas no se acaban y cada vez son más duras.';
  } else if (isRegionClear) {
    title = `¡${clearedName} superada!`;
    subtitle = `Elige una mejora rara antes de entrar en ${REGION_NAMES[Math.min(region, REGIONS.length - 1)]}.`;
  } else {
    title = `¡Nivel ${level}!`;
    subtitle = 'Elige una mejora. La partida está en pausa.';
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="draft-title" className="absolute inset-0 z-50 bg-[#020a0d]/80 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6 safe-pad">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="w-full max-w-4xl flex flex-col gap-5">
          <div className="text-center">
            <h2 id="draft-title" className="font-display text-3xl sm:text-4xl text-white">{title}</h2>
            {isRegionClear && !endless && lastStars > 0 && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <StarRow n={lastStars} size={22} />
              </div>
            )}
            <p className="mt-2 text-sm text-[#cfe9ee]">{subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {offer.map((id: UpgradeId, idx) => {
              const card = UPGRADES[id];
              if (!card) return null;
              const r = RARITY[card.rarity];
              const have = owned[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  autoFocus={idx === 0}
                  onClick={() => pick(id)}
                  className="group text-left rounded-2xl p-4 sm:p-5 bg-[#0b1a22]/95 border-2 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col gap-3 min-h-[8.5rem]"
                  style={{ borderColor: `${r.color}66` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2" style={{ color: r.color }}>
                      <TagIcon tags={card.tags} />
                      <span className="text-xs font-semibold">{r.label}</span>
                    </span>
                    <span className="text-xs text-[#9fc6cf]">
                      {have > 0 ? `Nivel ${have} → ${have + 1} de ${card.max}` : card.max > 1 ? `Nueva, hasta nivel ${card.max}` : 'Nueva'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-white">{card.name}</h3>
                    <p className="mt-1 text-[0.95rem] text-[#e9f6f8] leading-snug">{card.description}</p>
                  </div>
                  <p className="text-xs text-[#9fc6cf] leading-relaxed mt-auto">{card.scientificIdea}</p>
                  <span className="hidden md:inline text-xs text-[#6f8f96]">Tecla {idx + 1}</span>
                </button>
              );
            })}
          </div>

          {!isRegionClear && rerolls > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={reroll}
                className="h-11 px-4 rounded-xl border border-white/15 text-sm text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden />
                Ver otras cartas ({rerolls} {rerolls === 1 ? 'vez' : 'veces'})
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
