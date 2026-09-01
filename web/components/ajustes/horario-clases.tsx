'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import {
  X, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
import { DIAS_SEMANA } from '@/lib/dias';
import { CATEGORIAS } from '@/lib/categorias';
import {
  IconEditar, IconEliminar, IconMas, IconUbicacion,
} from '@/components/ui/custom-icons';

interface Sede { id: string; name: string }

export interface Clase {
  id: string;
  nombre: string;
  diaSemana: number;
  hora: string;
  categoria: string | null;
  locationId: string;
  location: { id: string; name: string };
}

/** "06:00" → "6:00 a. m." — el horario se lee, no se calcula. */
export function horaLegible(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

export default function HorarioClases() {
  const { getToken } = useAuth();
  const [clases, setClases]   = useState<Clase[]>([]);
  const [sedes, setSedes]     = useState<Sede[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');

  // Clase en edición. `null` = cerrado; sin `id` = una nueva.
  const [editando, setEditando] = useState<Partial<Clase> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Clase | null>(null);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const [resClases, resSedes] = await Promise.all([
        apiFetch<{ clases: Clase[] }>('/clases', { token }),
        apiFetch<{ locations: Sede[] }>('/locations', { token }),
      ]);
      setClases(resClases.clases);
      setSedes(resSedes.locations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el horario');
    } finally { setCargando(false); }
  }, [getToken]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirNueva() {
    setError('');
    setEditando({
      nombre: '', diaSemana: 1, hora: '06:00',
      categoria: '', locationId: sedes[0]?.id ?? '',
    });
  }

  async function guardar() {
    if (!editando || guardando) return;
    const { id, nombre, diaSemana, hora, categoria, locationId } = editando;
    if (!nombre?.trim() || !locationId || diaSemana === undefined || !hora) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      const cuerpo = JSON.stringify({
        nombre: nombre.trim(), diaSemana, hora,
        categoria: categoria?.trim() || null, locationId,
      });
      if (id) await apiFetch(`/clases/${id}`, { token, method: 'PATCH', body: cuerpo });
      else    await apiFetch('/clases',       { token, method: 'POST',  body: cuerpo });
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clase');
    } finally { setGuardando(false); }
  }

  async function borrar() {
    if (!porBorrar) return;
    try {
      const token = await getToken();
      await apiFetch(`/clases/${porBorrar.id}`, { token, method: 'DELETE' });
      setPorBorrar(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la clase');
    }
  }

  const porDia = DIAS_SEMANA
    .map(d => ({ ...d, clases: clases.filter(c => c.diaSemana === d.valor) }))
    .filter(d => d.clases.length > 0);

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground m-0">Horario de clases</h3>
        <p className="text-[11px] text-muted-foreground">
          Las clases que dicta el club cada semana. La asistencia se toma sobre estas, y así
          una misma persona puede entrenar en la mañana y en la tarde sin que se pisen.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.20)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#EF476F' }} />
          <p className="text-[11.5px]" style={{ color: '#B02A47' }}>{error}</p>
        </div>
      )}

      {sedes.length === 0 && !cargando ? (
        <div className="rounded-xl px-4 py-5 text-center"
          style={{ background: 'rgba(56,29,160,0.03)', border: '1px solid rgba(56,29,160,0.10)' }}>
          <p className="text-[12.5px] font-semibold text-foreground mb-1">Primero registra una sede</p>
          <p className="text-[11px] text-muted-foreground">
            Cada clase se dicta en una sede. Agrégalas desde el módulo Sedes.
          </p>
        </div>
      ) : (
        <>
          {porDia.length === 0 && !cargando && (
            <div className="rounded-xl px-4 py-5 text-center"
              style={{ background: 'rgba(56,29,160,0.03)', border: '1px solid rgba(56,29,160,0.10)' }}>
              <p className="text-[12.5px] font-semibold text-foreground mb-1">Sin horario todavía</p>
              <p className="text-[11px] text-muted-foreground">
                Mientras no agregues clases, la asistencia se sigue tomando una vez por día, como hasta ahora.
              </p>
            </div>
          )}

          {porDia.map(d => (
            <div key={d.valor} className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <p className="text-[10.5px] font-bold text-foreground">{d.nombre}</p>
                <div className="flex-1 h-px" style={{ background: 'rgba(120,80,200,0.14)' }} />
              </div>
              {d.clases.map(c => (
                <div key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white"
                  style={{ border: '1px solid rgba(120,80,200,0.14)' }}>
                  <span className="text-[12px] font-bold shrink-0 w-[68px]"
                    style={{ color: '#381DA0', fontVariantNumeric: 'tabular-nums' }}>
                    {horaLegible(c.hora)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-foreground truncate">{c.nombre}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(67,97,238,0.10)', color: '#2F4BC7' }}>
                        <IconUbicacion className="w-2.5 h-2.5" /> {c.location.name}
                      </span>
                      {c.categoria && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(56,29,160,0.10)', color: '#6D28D9' }}>
                          {c.categoria}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setError(''); setEditando(c); }} aria-label="Editar clase"
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-secondary"
                    style={{ color: '#8E87A8' }}>
                    <IconEditar className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPorBorrar(c)} aria-label="Quitar clase"
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-red-50"
                    style={{ color: '#EF476F' }}>
                    <IconEliminar className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={abrirNueva}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11.5px] font-bold transition-colors"
            style={{
              color: '#381DA0',
              background: 'rgba(56,29,160,0.06)',
              border: '1.5px dashed rgba(56,29,160,0.30)',
            }}
          >
            <IconMas className="w-3.5 h-3.5" /> Agregar clase
          </button>
        </>
      )}

      {/* ── Alta y edición ───────────────────────────────────────────────────
          En portal a document.body: dentro de la pagina el modal queda
          atrapado en el contexto de apilamiento de <main> y el menu flotante
          se le monta encima por mas z-index que se le ponga. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {editando && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setEditando(null)}
            className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
            style={{ background: 'rgba(20,12,36,0.55)', zIndex: 70 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col"
              style={{ maxHeight: '90dvh' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <p className="text-[15px] font-semibold text-foreground">
                  {editando.id ? 'Editar clase' : 'Nueva clase'}
                </p>
                <button onClick={() => setEditando(null)} aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nombre</Label>
                  <Input
                    value={editando.nombre ?? ''}
                    onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                    placeholder="Formativa, Competitiva, Iniciación…"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Día</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Mismo circulo que "Dias sin entrenamiento": 40px, borde
                        de 2 y la misma abreviatura. Solo cambia el color, y a
                        proposito — el rojo de alla significa "no se entrena". */}
                    {DIAS_SEMANA.map(d => (
                      <button
                        key={d.valor}
                        type="button"
                        aria-label={d.nombre}
                        onClick={() => setEditando({ ...editando, diaSemana: d.valor })}
                        className="w-10 h-10 rounded-full text-[12px] font-semibold border-2 transition-all flex items-center justify-center"
                        style={editando.diaSemana === d.valor
                          ? { background: 'rgba(56,29,160,0.08)', borderColor: '#381DA0', color: '#381DA0' }
                          : { background: '#fff', borderColor: 'rgba(120,80,200,0.15)', color: '#8E87A8' }}
                      >
                        {d.corto}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Hora de inicio</Label>
                  <TimePicker
                    className="max-w-[180px]"
                    value={editando.hora ?? '06:00'}
                    onChange={hora => setEditando({ ...editando, hora })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Sede</Label>
                  <div className="flex flex-col gap-1.5">
                    {sedes.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditando({ ...editando, locationId: s.id })}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={editando.locationId === s.id
                          ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                          : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                      >
                        <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                          style={{ border: `1.5px solid ${editando.locationId === s.id ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                          {editando.locationId === s.id && (
                            <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />
                          )}
                        </span>
                        <span className="text-[12.5px] font-medium text-foreground">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Categoría (opcional)</Label>
                  {/* Desplegable y no texto libre: la categoria se compara letra
                      por letra contra la del deportista. Escribir "Menores"
                      donde el miembro dice "Menores 3-10 años" no da error, da
                      una planilla vacia. */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditando({ ...editando, categoria: '' })}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                      style={!editando.categoria
                        ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                        : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                    >
                      <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                        style={{ border: `1.5px solid ${!editando.categoria ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                        {!editando.categoria && (
                          <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />
                        )}
                      </span>
                      <span className="text-[12.5px] font-medium text-foreground">Todas las categorías</span>
                    </button>
                    {CATEGORIAS.map(c => {
                      const puesta = editando.categoria === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditando({ ...editando, categoria: c })}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                          style={puesta
                            ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                            : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                        >
                          <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                            style={{ border: `1.5px solid ${puesta ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                            {puesta && <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />}
                          </span>
                          <span className="text-[12.5px] font-medium text-foreground">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Con una categoría, la planilla solo trae a los deportistas de esa categoría.
                  </p>
                </div>
              </div>

              {/* El boton por defecto mide 32px de alto, que en una hoja a pantalla
                  completa se ve aplastado. Y el relleno de abajo era 1rem: en
                  iPhone la barra de gestos se le montaba encima, porque el area
                  segura se suma al relleno, no lo reemplaza. */}
              <div className="px-5 pt-4 border-t border-border/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                <Button
                  onClick={guardar}
                  disabled={guardando || !editando.nombre?.trim() || !editando.locationId}
                  className="w-full h-12 text-[14px]"
                >
                  {guardando ? 'Guardando…' : editando.id ? 'Guardar cambios' : 'Agregar clase'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Confirmar quitar ───────────────────────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {porBorrar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setPorBorrar(null)}
            className="fixed inset-0 flex items-center justify-center p-6"
            style={{ background: 'rgba(20,12,36,0.55)', zIndex: 71 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-xs p-5"
            >
              <p className="text-[14.5px] font-semibold text-foreground mb-1.5">
                ¿Quitar «{porBorrar.nombre}» del horario?
              </p>
              <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">
                Deja de aparecer de hoy en adelante. La asistencia que ya se tomó en esta clase
                no se borra y sigue contando en los reportes.
              </p>
              <div className="flex gap-2">
                <button onClick={borrar}
                  className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-white"
                  style={{ background: '#EF476F' }}>
                  Quitar
                </button>
                <button onClick={() => setPorBorrar(null)}
                  className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold"
                  style={{ background: 'rgba(26,16,40,0.05)', color: '#5B5470' }}>
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
}
