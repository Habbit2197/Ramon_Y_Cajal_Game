/**
 * SettingsPanel.tsx — Ajustes de sonido y accesibilidad. Se guardan en este dispositivo.
 */
import { X } from 'lucide-react';
import { useRunStore } from '../../store/useRunStore';
import { useProfileStore } from '../../store/useProfileStore';
import { DifficultyPicker } from './MenuExtras';
import { onlineEnabled } from '../../net/onlineBoard';

const SHAKE_OPTIONS: { label: string; value: number }[] = [
  { label: 'Normal', value: 1 },
  { label: 'Suave', value: 0.45 },
  { label: 'Ninguna', value: 0 },
];

export function SettingsPanel({ muted, onToggleMute, onClose }: { muted: boolean; onToggleMute: () => void; onClose: () => void }) {
  const settings = useRunStore((s) => s.settings);
  const update = useRunStore((s) => s.updateSettings);
  const playerName = useProfileStore((s) => s.playerName);
  const resetOnboarding = useProfileStore((s) => s.setOnboardingSeen);
  const shareOnline = useProfileStore((s) => s.shareOnline);
  const setShareOnline = useProfileStore((s) => s.setShareOnline);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="fixed inset-0 z-40 bg-[#0b1220]/80 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-[#121a2a]/95 border border-white/10 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 id="settings-title" className="font-display text-3xl text-white">Ajustes</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" autoFocus className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[#c9c2b4] hover:text-white hover:bg-white/8 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <DifficultyPicker compact />
          {onlineEnabled() && (
            <Toggle
              label="Publicar en la clasificación de todos"
              hint="Solo se envían tu alias, el color de tu neurona y tus puntos. Si lo apagas, tus puntuaciones se quedan en este dispositivo."
              on={shareOnline}
              onChange={() => setShareOnline(!shareOnline)}
            />
          )}
          <Toggle label="Sonido" hint="Efectos y música del juego." on={!muted} onChange={onToggleMute} />
          <Toggle label="Vibración" hint="En móviles Android, vibra al recibir golpes." on={settings.haptics} onChange={() => update({ haptics: !settings.haptics })} />
          <Toggle
            label="Menos destellos"
            hint="Suaviza los flashes de color y los acercamientos de cámara. Recomendado si los destellos te molestan."
            on={settings.reducedFlashes}
            onChange={() => update({ reducedFlashes: !settings.reducedFlashes })}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-white font-semibold">Sacudida de cámara</legend>
            <p className="text-sm text-[#a9a293]">Cuánto tiembla la pantalla con los golpes.</p>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {SHAKE_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={settings.shakeScale === o.value}
                  onClick={() => update({ shakeScale: o.value })}
                  className={`h-10 rounded-xl border text-sm cursor-pointer ${
                    settings.shakeScale === o.value ? 'border-[#e8b45a] bg-[#e8b45a]/15 text-white' : 'border-white/12 text-[#c9c2b4] hover:bg-white/5'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          {playerName && (
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <span className="text-sm text-[#c9c2b4]">Volver a ver los tutoriales la próxima vez que juegues.</span>
              <button
                type="button"
                onClick={() => {
                  resetOnboarding('story', false);
                  resetOnboarding('arcade', false);
                  resetOnboarding('maze', false);
                  onClose();
                }}
                className="h-10 px-4 rounded-xl border border-white/15 text-sm text-[#e9e3d6] hover:bg-white/5 cursor-pointer shrink-0"
              >
                Activar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-white font-semibold">{label}</span>
        <span className="block text-sm text-[#a9a293] leading-snug">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onChange}
        className={`relative w-12 h-7 rounded-full shrink-0 transition-colors cursor-pointer ${on ? 'bg-[#7bd389]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-[left] ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  );
}
