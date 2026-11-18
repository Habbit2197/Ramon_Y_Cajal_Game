/**
 * MainMenu.tsx — Menú principal: alias, elección de modo y clasificación.
 *
 * Los modos se presentan como dos preparaciones de microscopio:
 * - Historia: tinción de Golgi (tinta sobre ámbar), como las láminas de Cajal.
 * - Arcade: fluorescencia (cian sobre negro), como el tejido del modo shooter.
 * Detrás, el Canvas3D del parque hace su recorrido de cámara por el nivel elegido.
 */
import { useEffect, useRef, useState } from 'react';
import { Dices, Volume2, VolumeX, BookOpen, Trophy, X, Pencil, CircleHelp, Settings, Award } from 'lucide-react';
import { LEVELS } from '../../game/rules';
import { randomAlias, NAME_MAX } from '../../game/names';
import { useProfileStore, useCurrentProgress, type GameMode } from '../../store/useProfileStore';
import { TROPHIES } from '../../game/trophies';
import { StarRow } from './TrophyBook';
import { NeuronGlyph, SpecimenArt, AVATAR_COLORS } from './NeuronGlyph';
import { Leaderboard } from './Leaderboard';

const shortLevelName = (name: string) => name.replace(/^Nivel \d+:\s*/, '');

interface MainMenuProps {
  mode: GameMode;
  onModeChange: (m: GameMode) => void;
  levelIndex: number;
  onLevelChange: (i: number) => void;
  onPlay: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenGdd: () => void;
  onHowToPlay: () => void;
  onOpenBook: () => void;
  onOpenSettings: () => void;
  /** false mientras hay otra ventana encima (onboarding, cuaderno…) */
  keyboardEnabled: boolean;
}

export function MainMenu({ mode, onModeChange, levelIndex, onLevelChange, onPlay, muted, onToggleMute, onOpenGdd, onHowToPlay, onOpenBook, onOpenSettings, keyboardEnabled }: MainMenuProps) {
  const progress = useCurrentProgress();
  const medals = Object.keys(progress.trophies).length;
  const playerName = useProfileStore((s) => s.playerName);
  const avatar = useProfileStore((s) => s.avatar);
  const [editingName, setEditingName] = useState(!playerName);
  const [showBoard, setShowBoard] = useState(false);

  const canPlay = !!playerName && !editingName;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyboardEnabled && e.code === 'Enter' && canPlay && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPlay, onPlay, keyboardEnabled]);

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto menu-scrim">
      <div className="min-h-full w-full max-w-[1200px] mx-auto px-5 py-6 md:px-10 md:py-6 grid gap-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,22rem)] lg:justify-between content-between">
        {/* Columna principal */}
        <div className="flex flex-col gap-5">
          <header className="menu-enter">
            <h1 className="font-display text-[2.6rem] md:text-[3.1rem] leading-[0.95] text-[#f4efe6] tracking-[-0.01em]" style={{ fontVariationSettings: '"opsz" 144' }}>
              Cajal
              <span className="block text-[#e8b45a] italic font-normal text-[0.62em] mt-1">el jardín de las neuronas</span>
            </h1>
            <p className="mt-3 text-[0.95rem] text-[#c9c2b4] max-w-[30rem] leading-relaxed">
              Cuida tu cerebro con Santiago Ramón y Cajal: elige hábitos sanos, esquiva las toxinas y haz crecer tu red neuronal.
            </p>
          </header>

          {/* Alias */}
          <div className="menu-enter" style={{ animationDelay: '60ms' }}>
            {editingName ? (
              <AliasForm onDone={() => setEditingName(false)} />
            ) : (
              <div className="flex items-center gap-3">
                <NeuronGlyph color={AVATAR_COLORS[avatar]} size={34} />
                <div className="min-w-0">
                  <div className="text-xs text-[#a9a293]">Juegas como</div>
                  <div className="text-lg font-semibold text-white truncate">{playerName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="ml-1 inline-flex items-center gap-1.5 text-sm text-[#c9c2b4] hover:text-white rounded-full px-3 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden />
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={onOpenBook}
                  className="ml-auto inline-flex items-center gap-2 text-sm rounded-full pl-2.5 pr-3.5 py-1.5 bg-[#e8b45a]/12 border border-[#e8b45a]/35 text-[#f4efe6] hover:bg-[#e8b45a]/20 cursor-pointer"
                >
                  <Award className="w-4 h-4 text-[#ffd166]" aria-hidden />
                  Cuaderno <span className="text-[#ffd166] font-semibold [font-variant-numeric:tabular-nums]">{medals}/{TROPHIES.length}</span>
                </button>
              </div>
            )}
          </div>

          {/* Modos */}
          <fieldset className="flex flex-col gap-2.5 menu-enter" style={{ animationDelay: '120ms' }}>
            <legend className="sr-only">Modo de juego</legend>
            <ModeSlide
              selected={mode === 'story'}
              onSelect={() => onModeChange('story')}
              label="Historia"
              blurb="Tres paseos: el parque, el colegio y una fiesta. Recoge hábitos sanos y llega al portal de Cajal."
              stain="golgi"
            />
            {mode === 'story' && (
              <div role="radiogroup" aria-label="Escenario" className="grid grid-cols-3 gap-2 pl-1">
                {LEVELS.map((lvl, i) => (
                  <button
                    key={lvl.id}
                    type="button"
                    role="radio"
                    aria-checked={levelIndex === i}
                    onClick={() => onLevelChange(i)}
                    className={`text-left rounded-xl px-3 py-2 border transition-colors cursor-pointer ${
                      levelIndex === i
                        ? 'border-[#e8b45a] bg-[#e8b45a]/12 text-white'
                        : 'border-white/10 bg-black/25 text-[#c9c2b4] hover:border-white/25'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1 text-[0.7rem] text-[#a9a293]">Nivel {lvl.id}<StarRow n={progress.stars[i] ?? 0} size={11} /></span>
                    <span className="block text-sm font-semibold leading-tight">{shortLevelName(lvl.name).replace(/^El |^La /, '')}</span>
                  </button>
                ))}
              </div>
            )}
            <ModeSlide
              selected={mode === 'arcade'}
              onSelect={() => onModeChange('arcade')}
              label="Arcade"
              blurb="Dentro del cerebro. Dispara impulsos, esquiva con mielina y elige mejoras entre oleadas."
              stain="fluor"
            />
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 menu-enter" style={{ animationDelay: '180ms' }}>
            <button
              type="button"
              disabled={!canPlay}
              onClick={onPlay}
              data-start="true"
              className={`h-14 px-8 rounded-2xl font-semibold text-base transition-[transform,background-color] active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === 'story' ? 'bg-[#e8b45a] hover:bg-[#f2c470] text-[#1a1206]' : 'bg-[#5ee6ff] hover:bg-[#8ff0ff] text-[#03141a]'
              }`}
            >
              {mode === 'story' ? `Jugar: ${shortLevelName(LEVELS[levelIndex].name)}` : 'Jugar arcade'}
            </button>
            {canPlay ? (
              <span className="text-sm text-[#c9c2b4] max-w-[17rem] leading-snug">
                {mode === 'story' ? 'Objetivo: llena tu potencial cerebral al 100 % y cruza el portal de Cajal.' : 'Objetivo: sobrevive a 5 oleadas en cada una de las 3 regiones del cerebro.'}
              </span>
            ) : (
              <span className="text-sm text-[#a9a293]">Primero elige tu alias.</span>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#a9a293] pt-2">
            <span className="hidden md:inline">
              {mode === 'story' ? 'WASD o flechas para moverte, Espacio para el impulso' : 'WASD para moverte, el ratón apunta, Espacio para el impulso'}
            </span>
            <span className="flex items-center gap-1 md:ml-auto">
              <button
                type="button"
                onClick={onHowToPlay}
                className="h-10 px-3.5 mr-1 inline-flex items-center gap-2 rounded-full border border-white/12 text-[#e9e3d6] hover:bg-white/5 cursor-pointer"
              >
                <CircleHelp className="w-4 h-4" aria-hidden />
                Cómo se juega
              </button>
              <IconButton label="Ajustes" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </IconButton>
              <IconButton label={muted ? 'Activar sonido' : 'Silenciar'} onClick={onToggleMute}>
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </IconButton>
              <IconButton label="Cómo está hecho (GDD)" onClick={onOpenGdd}>
                <BookOpen className="w-4 h-4" />
              </IconButton>
              <span className="lg:hidden">
                <IconButton label="Clasificación" onClick={() => setShowBoard(true)}>
                  <Trophy className="w-4 h-4" />
                </IconButton>
              </span>
            </span>
          </footer>
        </div>

        {/* Clasificación: columna en escritorio */}
        <aside className="hidden lg:block self-start menu-panel rounded-3xl p-6 menu-enter" style={{ animationDelay: '240ms' }}>
          <Leaderboard key={mode} initialMode={mode} />
        </aside>
      </div>

      {/* Clasificación: hoja a pantalla completa en móvil */}
      {showBoard && (
        <div role="dialog" aria-modal="true" aria-label="Clasificación" className="lg:hidden fixed inset-0 z-30 bg-[#0b1220]/95 backdrop-blur-md p-5 overflow-y-auto">
          <div className="flex justify-end">
            <IconButton label="Cerrar" onClick={() => setShowBoard(false)}>
              <X className="w-5 h-5" />
            </IconButton>
          </div>
          <Leaderboard initialMode={mode} />
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-10 h-10 inline-flex items-center justify-center rounded-full text-[#c9c2b4] hover:text-white hover:bg-white/8 cursor-pointer"
    >
      {children}
    </button>
  );
}

function ModeSlide({
  selected,
  onSelect,
  label,
  blurb,
  stain,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  blurb: string;
  stain: 'golgi' | 'fluor';
}) {
  const golgi = stain === 'golgi';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`slide group relative grid grid-cols-[minmax(8rem,40%)_1fr] text-left overflow-hidden rounded-[10px] cursor-pointer transition-[transform,opacity,box-shadow] duration-200 ${
        selected ? 'slide-selected' : 'opacity-70 hover:opacity-95'
      } ${golgi ? 'slide-golgi' : 'slide-fluor'}`}
    >
      {/* Etiqueta esmerilada de la preparación */}
      <span className="slide-label flex flex-col justify-between gap-1.5 p-3">
        <span className="font-display italic text-[1.55rem] leading-none text-[#1d1a14]">{label}</span>
        <span className="text-[0.72rem] leading-snug text-[#3b352b]">{blurb}</span>
      </span>
      {/* Muestra teñida */}
      <span className="slide-specimen relative block h-full min-h-[6.75rem] p-2">
        <SpecimenArt ink={golgi ? '#1b130a' : '#7ff3ff'} glow={!golgi} />
      </span>
    </button>
  );
}

function AliasForm({ onDone }: { onDone: () => void }) {
  const current = useProfileStore((s) => s.playerName);
  const avatar = useProfileStore((s) => s.avatar);
  const setPlayerName = useProfileStore((s) => s.setPlayerName);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const [value, setValue] = useState(current || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const save = () => {
    const r = setPlayerName(value);
    if (!r.ok) {
      setError(r.reason ?? 'Ese alias no vale.');
      return;
    }
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="menu-panel rounded-2xl p-4 flex flex-col gap-3"
    >
      <label htmlFor="alias" className="text-sm text-[#e9e3d6]">
        Tu alias para la clasificación
        <span className="block text-xs text-[#a9a293] mt-0.5">No pongas tu nombre y apellidos: inventa uno o pide uno al azar.</span>
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="alias"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={NAME_MAX}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'alias-error' : undefined}
          placeholder="Neurona Veloz 27"
          className="min-w-0 flex-1 h-12 rounded-xl bg-black/40 border border-white/15 focus:border-[#e8b45a] outline-none px-4 text-base text-white placeholder:text-[#6f6a60]"
        />
        <button
          type="button"
          onClick={() => {
            setValue(randomAlias());
            setError(null);
          }}
          className="h-12 px-3.5 rounded-xl border border-white/15 text-[#e9e3d6] hover:bg-white/5 inline-flex items-center gap-2 cursor-pointer"
        >
          <Dices className="w-4 h-4" aria-hidden />
          <span className="text-sm">Al azar</span>
        </button>
      </div>
      {error && (
        <p id="alias-error" role="alert" className="text-sm text-[#ff9f9f]">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div role="radiogroup" aria-label="Color de tu neurona" className="flex gap-1">
          {AVATAR_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={avatar === i}
              aria-label={`Color ${i + 1}`}
              onClick={() => setAvatar(i)}
              className={`w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer ${avatar === i ? 'bg-white/12 ring-1 ring-white/40' : 'hover:bg-white/5'}`}
            >
              <NeuronGlyph color={c} size={24} />
            </button>
          ))}
        </div>
        <button type="submit" className="h-11 px-5 rounded-xl bg-[#f4efe6] hover:bg-white text-[#14110b] font-semibold text-sm cursor-pointer">
          Guardar alias
        </button>
      </div>
    </form>
  );
}
