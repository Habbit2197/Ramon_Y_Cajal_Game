/**
 * ClassroomPanel.tsx — Modo aula.
 *
 * Alumno: se une a una clase con el código que le da su profe; su dispositivo envía un
 * resumen de su progreso (solo números del juego) cada vez que juega.
 * Profe: crea una clase (código + clave secreta) y ve el progreso de todos en una tabla,
 * que puede descargar para abrirla en una hoja de cálculo.
 */
import { useEffect, useState } from 'react';
import { X, School, Copy, Check, RefreshCw, Download, Trash2, LogOut, Send, ArrowLeft } from 'lucide-react';
import { useProfileStore, useCurrentProgress, type TeacherClass } from '../../store/useProfileStore';
import { randomAlias } from '../../game/names';
import { classCsv, isClassCode, normalizeClassCode } from '../../game/classroom';
import { DIFFICULTY_INFO, isDifficulty } from '../../game/difficulty';
import { classroomEnabled, classroomMessage, createClass, deleteClass, joinClass, leaveClass, removeStudent, viewClass, type ClassView } from '../../net/classroom';
import { NeuronGlyph, AVATAR_COLORS } from './NeuronGlyph';

const ACCENT = '#7fb8ff';
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Field({ id, label, hint, ...rest }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm text-[#e9e3d6]">
      {label}
      <input id={id} autoComplete="off" spellCheck={false} className="h-12 rounded-xl bg-black/40 border border-white/15 focus:border-[#7fb8ff] outline-none px-4 text-base text-white placeholder:text-[#6f6a60]" {...rest} />
      {hint && <span className="text-xs text-[#a9a293]">{hint}</span>}
    </label>
  );
}

const btn = 'h-11 px-5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const primary = `${btn} bg-[#7fb8ff] hover:bg-[#9cc9ff] text-[#071a33]`;
const secondary = `${btn} border border-white/15 text-[#e9e3d6] hover:bg-white/5 font-normal`;

function StudentTab() {
  const progress = useCurrentProgress();
  const playerName = useProfileStore((s) => s.playerName);
  const avatar = useProfileStore((s) => s.avatar);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const c = progress.classroom;

  const join = async () => {
    const st = useProfileStore.getState();
    if (!st.playerName) st.setPlayerName(randomAlias());
    const name = useProfileStore.getState().playerName;
    setBusy(true);
    setMsg(null);
    try {
      const r = await joinClass(code, name, avatar);
      useProfileStore.getState().setClassroom({ code, className: r.className, token: r.studentToken });
      useProfileStore.getState().syncClassroomNow();
      setMsg({ ok: true, text: `Te has unido a «${r.className}».` });
    } catch (e) {
      setMsg({ ok: false, text: classroomMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!c) return;
    setBusy(true);
    try {
      await leaveClass(c.code, playerName, c.token);
    } catch {
      /* si la clase ya no existe, se sale igualmente */
    }
    useProfileStore.getState().setClassroom(null);
    setBusy(false);
    setMsg({ ok: true, text: 'Has salido de la clase.' });
  };

  if (c)
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[#7fb8ff]/30 bg-[#7fb8ff]/8 p-4">
          <div className="text-sm text-[#a9c9f0]">Estás en la clase</div>
          <div className="font-display text-2xl text-white">{c.className}</div>
          <div className="text-sm text-[#c9c2b4] mt-1">
            Código <span className="font-semibold tracking-[0.15em] text-white">{c.code}</span>, como <strong className="text-white">{playerName}</strong>.
          </div>
        </div>
        <p className="text-sm text-[#c9c2b4] leading-relaxed">
          Tu profe ve tu alias y los números de tu cuaderno: medallas, estrellas, fichas del Museo, preguntas acertadas, partidas y mejores puntuaciones. Nada más. Se envía solo cada vez que juegas.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} disabled={busy} onClick={() => { useProfileStore.getState().syncClassroomNow(); setMsg({ ok: true, text: 'Progreso enviado.' }); }}>
            <Send className="w-4 h-4" aria-hidden /> Enviar mi progreso ahora
          </button>
          <button type="button" className={secondary} disabled={busy} onClick={leave}>
            <LogOut className="w-4 h-4" aria-hidden /> Salir de la clase
          </button>
        </div>
        {msg && <p role="status" className="text-sm" style={{ color: msg.ok ? '#7fe0a8' : '#ffb3a1' }}>{msg.text}</p>}
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (isClassCode(code)) void join();
        else setMsg({ ok: false, text: 'El código tiene 6 letras y números.' });
      }}
    >
      <p className="text-sm text-[#c9c2b4] leading-relaxed">
        Escribe el código que te ha dado tu profe. Te unirás con tu alias{playerName ? <> (<strong className="text-white">{playerName}</strong>)</> : ''}: no pongas tu nombre real.
      </p>
      <Field
        id="class-code"
        label="Código de la clase"
        value={code}
        onChange={(e) => { setCode(normalizeClassCode(e.target.value)); setMsg(null); }}
        placeholder="K7QMZP"
        maxLength={6}
        inputMode="text"
        style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
        autoFocus
      />
      <button type="submit" className={`${primary} self-start`} disabled={busy || code.length !== 6}>
        <School className="w-4 h-4" aria-hidden /> Unirme a la clase
      </button>
      {msg && <p role="alert" className="text-sm" style={{ color: msg.ok ? '#7fe0a8' : '#ffb3a1' }}>{msg.text}</p>}
    </form>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={secondary}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
      }}
    >
      {done ? <Check className="w-4 h-4 text-[#7fe0a8]" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />} {done ? 'Copiado' : label}
    </button>
  );
}

function Dashboard({ cls, onBack }: { cls: TeacherClass; onBack: () => void }) {
  const [data, setData] = useState<ClassView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await viewClass(cls.code, cls.key));
    } catch (e) {
      setError(classroomMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls.code]);

  const download = () => {
    if (!data) return;
    const blob = new Blob([classCsv(data.students)], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `clase-${cls.code}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const students = data?.students ?? [];
  const totals = students.reduce((t, s) => ({ medals: t.medals + (s.progress.medals ?? 0), museum: t.museum + (s.progress.museum ?? 0), quiz: t.quiz + (s.progress.quiz ?? 0) }), { medals: 0, museum: 0, quiz: 0 });

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-sm text-[#c9c2b4] hover:text-white inline-flex items-center gap-1.5 cursor-pointer">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Mis clases
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">{cls.className}</h3>
          <p className="text-sm text-[#c9c2b4]">Código para los alumnos: <span className="font-semibold tracking-[0.15em] text-white text-base">{cls.code}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={load} disabled={loading}><RefreshCw className="w-4 h-4" aria-hidden /> Actualizar</button>
          <button type="button" className={secondary} onClick={download} disabled={!students.length}><Download className="w-4 h-4" aria-hidden /> Descargar CSV</button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#ffb3a1]">{error}</p>
      ) : !data ? (
        <p role="status" className="text-sm text-[#a9a293]">Cargando la clase…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-[#a9a293] leading-relaxed">Aún no se ha unido nadie. Los alumnos entran en «Aula», pestaña «Soy alumno», y escriben el código <strong className="text-white">{cls.code}</strong>.</p>
      ) : (
        <>
          <p className="text-sm text-[#c9c2b4]">
            {students.length} {students.length === 1 ? 'alumno' : 'alumnos'}. Entre todos: {totals.medals} medallas, {totals.museum} fichas del Museo y {totals.quiz} preguntas de Cajal acertadas.
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-separate border-spacing-y-1 min-w-[42rem]">
              <thead>
                <tr className="text-left text-xs text-[#a9a293]">
                  {['Alumno', 'Medallas', 'Estrellas', 'Museo', 'Preguntas', 'Partidas', 'Desafíos', 'Dificultad', 'Última vez', ''].map((h) => <th key={h} className="font-normal px-2 py-1">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const p = s.progress;
                  return (
                    <tr key={s.name} className="bg-white/[0.04]">
                      <td className="px-2 py-2 rounded-l-lg">
                        <span className="inline-flex items-center gap-2 text-white font-semibold">
                          <NeuronGlyph color={AVATAR_COLORS[s.avatar % AVATAR_COLORS.length]} size={20} /> {s.name}
                        </span>
                      </td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.medals ?? 0}</td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.stars ?? 0}/18</td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.museum ?? 0}</td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.quiz ?? 0}</td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.games ?? 0}</td>
                      <td className="px-2 [font-variant-numeric:tabular-nums]">{p.daily ?? 0}</td>
                      <td className="px-2 text-[#c9c2b4]">{isDifficulty(p.difficulty) ? DIFFICULTY_INFO[p.difficulty].label : ''}</td>
                      <td className="px-2 text-[#a9a293] whitespace-nowrap">{s.updated ? dateFmt.format(new Date(s.updated)) : ''}</td>
                      <td className="px-2 rounded-r-lg text-right">
                        <button
                          type="button"
                          aria-label={`Quitar a ${s.name} de la clase`}
                          title="Quitar de la clase"
                          onClick={async () => {
                            try { await removeStudent(cls.code, cls.key, s.name); void load(); } catch (e) { setError(classroomMessage(e)); }
                          }}
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#a9a293] hover:text-[#ff9f9f] hover:bg-white/5 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-3 text-sm">
        {confirmDelete ? (
          <>
            <span className="text-[#ffb3a1]">Se borrará la clase y el progreso de todos. ¿Seguro?</span>
            <button
              type="button"
              className={`${btn} bg-[#ff8f8f] text-[#2b0606]`}
              onClick={async () => {
                try { await deleteClass(cls.code, cls.key); } catch { /* ya no existía */ }
                useProfileStore.getState().removeTeacherClass(cls.code);
                onBack();
              }}
            >
              Sí, borrar la clase
            </button>
            <button type="button" className={secondary} onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-[#a9a293] hover:text-[#ff9f9f] cursor-pointer">
            <Trash2 className="w-4 h-4" aria-hidden /> Borrar esta clase
          </button>
        )}
      </div>
    </div>
  );
}

function TeacherTab() {
  const classes = useProfileStore((s) => s.teacherClasses);
  const [open, setOpen] = useState<TeacherClass | null>(null);
  const [className, setClassName] = useState('');
  const [created, setCreated] = useState<TeacherClass | null>(null);
  const [other, setOther] = useState({ code: '', key: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (open) return <Dashboard cls={open} onBack={() => setOpen(null)} />;

  return (
    <div className="flex flex-col gap-6">
      {created ? (
        <div className="rounded-2xl border border-[#7fb8ff]/40 bg-[#7fb8ff]/8 p-5 flex flex-col gap-3">
          <div className="text-sm text-[#a9c9f0]">Clase creada: {created.className}</div>
          <div>
            <div className="text-sm text-[#c9c2b4]">Código para tus alumnos (escríbelo en la pizarra):</div>
            <div className="font-display text-5xl text-white tracking-[0.2em] mt-1">{created.code}</div>
          </div>
          <div>
            <div className="text-sm text-[#c9c2b4]">Tu clave de profe, para ver la clase desde otro dispositivo. <strong className="text-white">Guárdala y no la compartas.</strong></div>
            <div className="mt-1 rounded-lg bg-black/40 px-3 py-2 text-white break-all select-all">{created.key}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={`Clase: ${created.className}\nCódigo para alumnos: ${created.code}\nClave de profe: ${created.key}`} label="Copiar código y clave" />
            <button type="button" className={primary} onClick={() => { setOpen(created); setCreated(null); }}>Ver la clase</button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            try {
              const r = await createClass(className);
              const c = { code: r.code, className: r.className, key: r.teacherKey };
              useProfileStore.getState().addTeacherClass(c);
              setCreated(c);
              setClassName('');
            } catch (err) {
              setMsg(classroomMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field id="class-name" label="Crear una clase" hint="Un nombre corto, sin datos de los alumnos: «5.º B», «Taller de ciencias»." value={className} onChange={(e) => setClassName(e.target.value)} placeholder="5.º B" maxLength={24} />
          <button type="submit" className={`${primary} self-start`} disabled={busy || className.trim().length < 2}>Crear clase</button>
          {msg && <p role="alert" className="text-sm text-[#ffb3a1]">{msg}</p>}
        </form>
      )}

      {classes.length > 0 && (
        <section aria-labelledby="my-classes" className="flex flex-col gap-2">
          <h3 id="my-classes" className="text-white font-semibold">Mis clases en este dispositivo</h3>
          <ul className="flex flex-col gap-1.5">
            {classes.map((c) => (
              <li key={c.code}>
                <button type="button" onClick={() => setOpen(c)} className="w-full text-left rounded-xl px-4 py-3 bg-white/[0.04] border border-white/8 hover:border-[#7fb8ff]/50 flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-white">{c.className}</span>
                  <span className="text-sm text-[#a9a293] tracking-[0.15em]">{c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form
        className="flex flex-col gap-3 pt-4 border-t border-white/10"
        onSubmit={(e) => {
          e.preventDefault();
          const c = { code: normalizeClassCode(other.code), className: 'Clase', key: other.key.trim() };
          if (!isClassCode(c.code) || c.key.length < 16) return setMsg('Escribe el código de 6 caracteres y la clave completa.');
          viewClass(c.code, c.key)
            .then((v) => {
              const full = { ...c, className: v.className };
              useProfileStore.getState().addTeacherClass(full);
              setOpen(full);
            })
            .catch((err) => setMsg(classroomMessage(err)));
        }}
      >
        <h3 className="text-white font-semibold">Abrir una clase creada en otro dispositivo</h3>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field id="other-code" label="Código" value={other.code} onChange={(e) => setOther({ ...other, code: normalizeClassCode(e.target.value) })} maxLength={6} placeholder="K7QMZP" />
          <Field id="other-key" label="Clave de profe" value={other.key} onChange={(e) => setOther({ ...other, key: e.target.value })} placeholder="La clave que guardaste" />
        </div>
        <button type="submit" className={`${secondary} self-start`}>Abrir</button>
      </form>
    </div>
  );
}

export function ClassroomPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="aula-title" className="fixed inset-0 z-40 bg-[#0b1220]/92 backdrop-blur-md overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8 md:py-12 safe-pad flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="aula-title" className="font-display text-3xl md:text-4xl text-white flex items-center gap-3">
              <School className="w-7 h-7" style={{ color: ACCENT }} aria-hidden /> Aula
            </h2>
            <p className="mt-1 text-sm text-[#c9c2b4] max-w-[40rem]">El profe crea una clase y ve cómo avanza cada alumno: medallas, estrellas, fichas del Museo y preguntas de Cajal. Solo se usan los alias del juego.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[#c9c2b4] hover:text-white hover:bg-white/8 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!classroomEnabled() ? (
          <p className="text-[#c9c2b4]">El modo aula no está activado en esta versión del juego.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Quién eres" className="flex rounded-full bg-white/5 p-1 self-start text-sm">
              {(['student', 'teacher'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-full cursor-pointer ${tab === t ? 'bg-[#f4efe6] text-[#14110b] font-semibold' : 'text-[#c9c2b4] hover:text-white'}`}
                >
                  {t === 'student' ? 'Soy alumno' : 'Soy profe'}
                </button>
              ))}
            </div>
            <div className="menu-panel rounded-3xl p-5 sm:p-6">{tab === 'student' ? <StudentTab /> : <TeacherTab />}</div>
          </>
        )}
      </div>
    </div>
  );
}
