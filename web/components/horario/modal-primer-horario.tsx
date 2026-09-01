'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { DIAS_SEMANA, DIA_CORTO_3 } from '@/lib/dias';
import { horaLegible } from '@/components/ajustes/horario-clases';
import { IconCheck, IconMas, IconUbicacion } from '@/components/ui/custom-icons';

/**
 * «Arma tu horario», el modal que se le lanza a un administrador al entrar.
 *
 * Existe porque dieciocho de los veintiún clubes tienen sedes y ningún
 * horario, y sin horario la lista de una clase sale de cruzar sede con
 * categoría: dos clases a horas distintas traen a la misma gente.
 *
 * Tres decisiones lo sostienen, y las tres son para que se conteste en vez de
 * cerrarse:
 *
 * - **El grupo y sus clases en una sola pantalla.** Marcar lunes, miércoles y
 *   viernes crea las tres clases de un golpe. Pedirlas una por una es donde la
 *   gente abandona.
 * - **«Ahora no» siempre visible.** Nunca bloquea. Quien lo aplaza no lo vuelve
 *   a ver en tres días, y a la tercera vez se deja de insistir.
 * - **Pide UN grupo, no el horario entero.** Hay clubes con ocho sedes:
 *   pedirles ocho grupos acá es pedirles que lo cierren. Con el primero hecho
 *   ya entendieron, y siguen en Ajustes a su ritmo.
 *
 * Quién lo ve lo decide el backend (`api/src/lib/primer-horario.ts`) y llega en
 * `/me`. Acá no se vuelve a preguntar: dos sitios decidiendo lo mismo es como
 * se termina mostrando a quien ya lo llenó.
 */

interface Sede { id: string; name: string }

type Fase = 'invitacion' | 'armar' | 'hecho';

interface Hecho { nombre: string; horario: string; clases: number }

/** Los cuatro que cubren casi todos los clubes. No es una lista cerrada. */
const SUGERENCIAS = ['Mañana', 'Tarde', 'Formativo', 'Competitivo'];

/** "Lun, Mié, Vie · 6:00 a. m." */
function resumen(dias: number[], hora: string): string {
  const orden = [...dias].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return orden.map(v => DIA_CORTO_3[v]).join(', ') + ' · ' + horaLegible(hora);
}

export default function ModalPrimerHorario({ onCerrar }: { onCerrar: () => void }) {
  const { getToken } = useAuth();

  const [fase, setFase]   = useState<Fase>('invitacion');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hechos, setHechos] = useState<Hecho[]>([]);

  const [nombre, setNombre] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [dias, setDias]     = useState<number[]>([]);
  // Puesta y no vacía: es la hora más común y ahorra una decisión.
  const [hora, setHora]     = useState('06:00');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const token = await getToken();
        const r = await apiFetch<{ locations: Sede[] }>('/locations', { token });
        if (!vivo) return;
        setSedes(r.locations);
        // Con una sola sede no hay nada que elegir: se pone y el campo no
        // aparece. Es la diferencia entre tres toques y dos.
        if (r.locations.length === 1) setSedeId(r.locations[0].id);
      } catch {
        // Si las sedes no cargan, el modal no puede hacer nada útil. Se cierra
        // sin ruido: no es culpa de quien entró y no hay nada que pedirle.
        if (vivo) onCerrar();
      }
    })();
    return () => { vivo = false; };
  }, [getToken, onCerrar]);

  const aplazar = useCallback(async () => {
    try {
      const token = await getToken();
      await apiFetch('/me/aplazar-horario', { token, method: 'POST' });
    } catch {
      // Que el aplazamiento no se guarde es molesto, no grave: lo peor que
      // pasa es que el modal vuelva antes de tiempo. Cerrar igual.
    }
    onCerrar();
  }, [getToken, onCerrar]);

  async function crear() {
    const limpio = nombre.trim();
    if (!limpio || !sedeId || dias.length === 0 || guardando) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      await apiFetch('/grupos/completo', {
        token, method: 'POST',
        body: JSON.stringify({ nombre: limpio, locationId: sedeId, dias, hora }),
      });
      setHechos(h => [...h, { nombre: limpio, horario: resumen(dias, hora), clases: dias.length }]);
      setNombre(''); setDias([]); setHora('06:00');
      setFase('hecho');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo');
    } finally { setGuardando(false); }
  }

  const listo = !!nombre.trim() && !!sedeId && dias.length > 0;
  const sede = sedes.find(s => s.id === sedeId);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
        style={{ background: 'rgba(20,12,36,0.55)', zIndex: 90 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col"
          style={{ maxHeight: '90dvh' }}
          role="dialog"
          aria-modal="true"
          aria-label="Arma tu horario"
        >
          {/* ── Encabezado ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground m-0">
                {fase === 'invitacion' ? 'Tu club no tiene horario'
                  : fase === 'armar'   ? 'Tu primer grupo'
                  : 'Tu horario'}
              </p>
              <p className="text-[11.5px] text-muted-foreground m-0 mt-0.5 truncate">
                {fase === 'invitacion' ? 'Se arma en menos de un minuto'
                  : fase === 'armar'   ? (sede?.name ?? 'Elige la sede')
                  : `${hechos.length} ${hechos.length === 1 ? 'grupo creado' : 'grupos creados'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={hechos.length ? onCerrar : aplazar}
              aria-label="Cerrar"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.20)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#EF476F' }} />
              <p className="text-[11.5px] m-0" style={{ color: '#B02A47' }}>{error}</p>
            </div>
          )}

          {/* ── Cuerpo ─────────────────────────────────────────────────── */}
          <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">

            {fase === 'invitacion' && (
              <>
                <p className="text-[13.5px] text-muted-foreground m-0">
                  Sin horario, la lista de asistencia sale de cruzar la sede con la categoría.
                  Eso hace que <strong className="text-foreground font-semibold">dos clases
                  a horas distintas traigan a la misma gente</strong>.
                </p>
                <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5"
                  style={{ background: 'rgba(56,29,160,0.04)', border: '1px solid rgba(56,29,160,0.10)' }}>
                  <p className="text-[12.5px] text-muted-foreground m-0">
                    Marcas los días, eliges la hora y listo. Puedes dejarlo para después.
                  </p>
                </div>
              </>
            )}

            {fase === 'armar' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">¿Cómo se llama?</Label>
                  {/* Campo libre, no una lista cerrada: un club puede llamarle
                      «Sub-12 Femenino» y ningún catálogo lo adivina. Las
                      sugerencias lo llenan y se pueden seguir editando. */}
                  <Input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Mañana, Competitivo, Sub-12…"
                    autoFocus
                  />
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {SUGERENCIAS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNombre(nombre === s ? '' : s)}
                        className="text-[11.5px] font-medium px-2.5 py-1.5 rounded-full transition-colors"
                        style={nombre === s
                          ? { background: 'rgba(56,29,160,0.08)', border: '1.5px solid #381DA0', color: '#381DA0' }
                          : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.12)', color: '#5B5470' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {sedes.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">¿En qué sede?</Label>
                    <div className="flex flex-col gap-1.5">
                      {sedes.map(s => {
                        const puesta = sedeId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSedeId(s.id)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                            style={puesta
                              ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                              : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                          >
                            <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                              style={{ border: `1.5px solid ${puesta ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                              {puesta && <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />}
                            </span>
                            <span className="text-[12.5px] font-medium text-foreground">{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[12px]">¿Qué días entrena?</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Mismo círculo que «Días sin entrenamiento» y que el modal
                        de clase: 40px, borde de 2 y la misma abreviatura. */}
                    {DIAS_SEMANA.map(d => {
                      const on = dias.includes(d.valor);
                      return (
                        <button
                          key={d.valor}
                          type="button"
                          aria-label={d.nombre}
                          aria-pressed={on}
                          onClick={() => setDias(p => p.includes(d.valor)
                            ? p.filter(x => x !== d.valor)
                            : [...p, d.valor])}
                          className="w-10 h-10 rounded-full text-[12px] font-semibold border-2 transition-all flex items-center justify-center"
                          style={on
                            ? { background: 'rgba(56,29,160,0.08)', borderColor: '#381DA0', color: '#381DA0' }
                            : { background: '#fff', borderColor: 'rgba(120,80,200,0.15)', color: '#8E87A8' }}
                        >
                          {d.corto}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">¿A qué hora?</Label>
                  <TimePicker value={hora} onChange={setHora} />
                </div>

                <div className="rounded-xl px-3.5 py-3"
                  style={listo
                    ? { background: 'rgba(56,29,160,0.06)', border: '1px solid rgba(56,29,160,0.18)' }
                    : { background: 'rgba(26,16,40,0.03)', border: '1px solid rgba(26,16,40,0.06)' }}>
                  {listo ? (
                    <>
                      <p className="text-[12.5px] font-semibold m-0" style={{ color: '#381DA0' }}>
                        {nombre.trim()} · {resumen(dias, hora)}
                      </p>
                      <p className="text-[11px] m-0 mt-0.5" style={{ color: 'rgba(56,29,160,0.75)' }}>
                        Se {dias.length === 1 ? 'crea' : 'crean'} {dias.length}{' '}
                        {dias.length === 1 ? 'clase' : 'clases'}, una por día.
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-muted-foreground m-0">
                      Ponle nombre y marca los días para ver el resumen.
                    </p>
                  )}
                </div>
              </>
            )}

            {fase === 'hecho' && (
              <>
                <div className="text-center pt-1">
                  <div className="w-13 h-13 rounded-full mx-auto mb-3 flex items-center justify-center"
                    style={{ width: 52, height: 52, background: 'rgba(6,214,160,0.12)', border: '1.5px solid rgba(6,214,160,0.30)' }}>
                    <IconCheck className="w-5 h-5" style={{ color: '#06A87D' }} />
                  </div>
                  <p className="text-[16px] font-semibold text-foreground m-0">Listo</p>
                  <p className="text-[12.5px] text-muted-foreground m-0 mt-0.5">
                    Desde ahora esa clase trae solo a su gente.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {hechos.map((h, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white"
                      style={{ border: '1px solid rgba(120,80,200,0.14)' }}>
                      <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(6,214,160,0.12)' }}>
                        <IconCheck className="w-2.5 h-2.5" style={{ color: '#06A87D' }} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-foreground m-0 truncate">{h.nombre}</p>
                        <p className="text-[10.5px] text-muted-foreground m-0 truncate">
                          {h.horario} · {h.clases} {h.clases === 1 ? 'clase' : 'clases'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Pie ────────────────────────────────────────────────────── */}
          <div className="px-5 py-4 border-t border-border/60 flex flex-col gap-2">
            {fase === 'invitacion' && (
              <>
                <Button className="w-full" onClick={() => setFase('armar')}>Armar mi horario</Button>
                <button type="button" onClick={aplazar}
                  className="w-full py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Ahora no
                </button>
              </>
            )}

            {fase === 'armar' && (
              <>
                <Button className="w-full" disabled={!listo || guardando} onClick={crear}>
                  {guardando ? 'Creando…' : 'Crear grupo'}
                </Button>
                <button type="button" onClick={hechos.length ? onCerrar : aplazar}
                  className="w-full py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {hechos.length ? 'Terminar' : 'Ahora no'}
                </button>
              </>
            )}

            {fase === 'hecho' && (
              <>
                <Button className="w-full" onClick={onCerrar}>Terminar</Button>
                <button
                  type="button"
                  onClick={() => { setError(''); setFase('armar'); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-semibold transition-colors"
                  style={{ color: '#381DA0', background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.20)' }}
                >
                  <IconMas className="w-3.5 h-3.5" /> Agregar otro grupo
                </button>
                <p className="text-[11px] text-muted-foreground text-center m-0 mt-0.5 flex items-center justify-center gap-1">
                  <IconUbicacion className="w-3 h-3 shrink-0" />
                  Los demás los agregas desde Ajustes cuando quieras
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
