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
import { colorDeGrupo } from '@/lib/colores-grupo';
import { CATEGORIAS } from '@/lib/categorias';
import {
  IconCheck, IconEditar, IconEliminar, IconMas, IconUbicacion,
} from '@/components/ui/custom-icons';

interface Sede { id: string; name: string }

interface Candidato {
  id: string;
  fullName: string;
  category?: string | null;
  role: string;
  active?: boolean;
  locations: { location: { id: string } }[];
  grupos?: { grupoId: string }[];
}

export interface Grupo {
  id: string;
  nombre: string;
  activo: boolean;
  location: { id: string; name: string };
  clases: { id: string; diaSemana: number; hora: string; activa: boolean }[];
  _count: { miembros: number };
}

export interface Clase {
  id: string;
  nombre: string;
  diaSemana: number;
  hora: string;
  categoria: string | null;
  grupoId: string | null;
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

/**
 * @param sinEntrenamiento Dias que el club marco como «no se entrena» (0 = domingo).
 *   La cuadricula no los pinta: una columna donde nunca va a haber clase solo
 *   ocupa ancho, y el «+» de ese dia ofreceria algo que el club ya dijo que no.
 */
export default function HorarioClases({ sinEntrenamiento = [] }: { sinEntrenamiento?: number[] }) {
  const { getToken } = useAuth();
  const [clases, setClases]   = useState<Clase[]>([]);
  const [sedes, setSedes]     = useState<Sede[]>([]);
  const [grupos, setGrupos]   = useState<Grupo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');

  // Clase en edición. `null` = cerrado; sin `id` = una nueva.
  const [editando, setEditando] = useState<Partial<Clase> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Clase | null>(null);

  // Grupo en edición. `null` = cerrado; sin `id` = uno nuevo.
  const [grupoEdit, setGrupoEdit] = useState<Partial<Grupo> & { locationId?: string } | null>(null);
  const [grupoPorBorrar, setGrupoPorBorrar] = useState<Grupo | null>(null);

  // Asignación de deportistas. `null` = cerrado.
  const [asignando, setAsignando] = useState<Grupo | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [cargandoCand, setCargandoCand] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const token = await getToken();
      const [resClases, resSedes, resGrupos] = await Promise.all([
        apiFetch<{ clases: Clase[] }>('/clases', { token }),
        apiFetch<{ locations: Sede[] }>('/locations', { token }),
        apiFetch<{ grupos: Grupo[] }>('/grupos', { token }),
      ]);
      setClases(resClases.clases);
      setSedes(resSedes.locations);
      setGrupos(resGrupos.grupos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el horario');
    } finally { setCargando(false); }
  }, [getToken]);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * @param dia El dia de la celda donde se toco «Agregar». Ya viene elegido y
   *            por eso el modal no lo vuelve a preguntar: la cuadricula lo dijo.
   */
  function abrirNueva(dia = 1) {
    setError('');
    // Con un solo grupo se propone ese: es lo que va a querer el 100 % de los
    // clubes que apenas tienen uno, y ahorra un toque.
    const unico = grupos.filter(g => g.activo).length === 1
      ? grupos.filter(g => g.activo)[0]
      : null;
    setEditando({
      nombre: unico?.nombre ?? '',
      diaSemana: dia,
      hora: '06:00',
      categoria: '',
      locationId: unico?.location.id ?? sedes[0]?.id ?? '',
      grupoId: unico?.id ?? null,
    });
  }

  /**
   * Al elegir grupo se arrastran su sede y su nombre.
   *
   * El nombre se copia y NO se ata: una clase puede llamarse «Técnica» dentro
   * del grupo «Mañana». Se propone porque es lo que casi siempre se quiere, y
   * queda editable porque a veces no.
   */
  function elegirGrupo(g: Grupo | null) {
    if (!editando) return;
    setEditando({
      ...editando,
      grupoId: g?.id ?? null,
      ...(g ? { locationId: g.location.id } : {}),
      // Solo pisa el nombre si estaba vacio o si era el del grupo anterior:
      // uno escrito a mano no se borra por cambiar de grupo.
      ...(g && (!editando.nombre?.trim()
                || grupos.some(x => x.nombre === editando.nombre))
            ? { nombre: g.nombre } : {}),
    });
  }

  async function guardar() {
    if (!editando || guardando) return;
    const { id, nombre, diaSemana, hora, categoria, locationId, grupoId } = editando;
    if (!nombre?.trim() || !locationId || diaSemana === undefined || !hora) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      const cuerpo = JSON.stringify({
        nombre: nombre.trim(), diaSemana, hora,
        categoria: categoria?.trim() || null, locationId,
        grupoId: grupoId ?? null,
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

  function abrirGrupoNuevo() {
    setError('');
    setGrupoEdit({ nombre: '', locationId: sedes[0]?.id ?? '' });
  }

  async function guardarGrupo() {
    if (!grupoEdit || guardando) return;
    const nombre = grupoEdit.nombre?.trim();
    const locationId = grupoEdit.locationId;
    if (!nombre || !locationId) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      const cuerpo = JSON.stringify({ nombre, locationId });
      if (grupoEdit.id) await apiFetch(`/grupos/${grupoEdit.id}`, { token, method: 'PATCH', body: cuerpo });
      else              await apiFetch('/grupos',                 { token, method: 'POST',  body: cuerpo });
      setGrupoEdit(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el grupo');
    } finally { setGuardando(false); }
  }

  // Los candidatos son los deportistas de la sede del grupo. No los de todo el
  // club: un grupo vive en una sede, y ofrecer gente de otra invita a armar un
  // grupo que ninguna clase va a poder usar.
  async function abrirAsignar(g: Grupo) {
    setError(''); setAsignando(g); setCargandoCand(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ members: Candidato[] }>('/members', { token });
      const deLaSede = res.members.filter(m =>
        m.role === 'DEPORTISTA' && m.active !== false &&
        m.locations.some(l => l.location.id === g.location.id));
      setCandidatos(deLaSede);
      setElegidos(new Set(deLaSede.filter(m =>
        (m.grupos ?? []).some(x => x.grupoId === g.id)).map(m => m.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los deportistas');
      setAsignando(null);
    } finally { setCargandoCand(false); }
  }

  async function guardarAsignacion() {
    if (!asignando || guardando) return;
    setGuardando(true); setError('');
    try {
      const token = await getToken();
      await apiFetch(`/grupos/${asignando.id}/miembros`, {
        token, method: 'PUT',
        body: JSON.stringify({ memberIds: [...elegidos] }),
      });
      setAsignando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asignación');
    } finally { setGuardando(false); }
  }

  async function borrarGrupo() {
    if (!grupoPorBorrar) return;
    try {
      const token = await getToken();
      await apiFetch(`/grupos/${grupoPorBorrar.id}`, { token, method: 'DELETE' });
      setGrupoPorBorrar(null);
      await cargar();
    } catch (err) {
      // El backend rechaza borrar un grupo con clases y explica por que. Ese
      // mensaje se muestra tal cual: es mas util que uno generico.
      setError(err instanceof Error ? err.message : 'No se pudo quitar el grupo');
      setGrupoPorBorrar(null);
    }
  }

  // La semana completa, incluidos los dias vacios: la cuadricula los necesita
  // para que el «+» de cada dia tenga donde ir.
  const semana = DIAS_SEMANA
    .filter(d => !sinEntrenamiento.includes(d.valor))
    .map(d => ({
      ...d,
      clases: clases.filter(c => c.diaSemana === d.valor)
                    .sort((a, b) => a.hora.localeCompare(b.hora)),
    }));
  const hayClases = clases.length > 0;
  const idsGrupo = grupos.map(g => g.id);

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

      {sedes.length > 0 && !cargando && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <p className="text-[10.5px] font-bold text-foreground">Grupos</p>
            <div className="flex-1 h-px" style={{ background: 'rgba(120,80,200,0.14)' }} />
          </div>
          {grupos.length === 0 ? (
            <p className="text-[11px] text-muted-foreground m-0">
              Sin grupos, la lista de una clase sale de la sede y la categoría, y dos clases
              iguales traen la misma gente.
            </p>
          ) : grupos.map(g => (
            <div key={g.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white"
              style={{ border: '1px solid rgba(120,80,200,0.14)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground truncate">{g.nombre}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(67,97,238,0.10)', color: '#2F4BC7' }}>
                    <IconUbicacion className="w-2.5 h-2.5" /> {g.location.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirAsignar(g)}
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-opacity hover:opacity-75"
                    style={{ background: 'rgba(56,29,160,0.10)', color: '#6D28D9' }}>
                    {g._count.miembros} {g._count.miembros === 1 ? 'deportista' : 'deportistas'} ·
                    {' '}{g._count.miembros === 0 ? 'asignar' : 'cambiar'}
                  </button>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(6,214,160,0.12)', color: '#0A7A5C' }}>
                    {g.clases.length} {g.clases.length === 1 ? 'clase' : 'clases'}
                  </span>
                </div>
              </div>
              <button onClick={() => { setError(''); setGrupoEdit({ ...g, locationId: g.location.id }); }}
                aria-label="Editar grupo"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-secondary"
                style={{ color: '#8E87A8' }}>
                <IconEditar className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setGrupoPorBorrar(g)} aria-label="Quitar grupo"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-red-50"
                style={{ color: '#EF476F' }}>
                <IconEliminar className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={abrirGrupoNuevo}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11.5px] font-bold transition-colors"
            style={{
              color: '#381DA0',
              background: 'rgba(56,29,160,0.06)',
              border: '1.5px dashed rgba(56,29,160,0.30)',
            }}
          >
            <IconMas className="w-3.5 h-3.5" /> Agregar grupo
          </button>
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
          {clases.some(c => sinEntrenamiento.includes(c.diaSemana)) && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,183,3,0.10)', border: '1px solid rgba(255,183,3,0.28)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#854F0B' }} />
              <p className="text-[11.5px] m-0" style={{ color: '#854F0B' }}>
                Hay clases en días que marcaste como sin entrenamiento. No se ven acá y no se
                les toma asistencia. Quita el día de la lista de abajo para volver a verlas.
              </p>
            </div>
          )}

          {!hayClases && !cargando && (
            <div className="rounded-xl px-4 py-5 text-center"
              style={{ background: 'rgba(56,29,160,0.03)', border: '1px solid rgba(56,29,160,0.10)' }}>
              <p className="text-[12.5px] font-semibold text-foreground mb-1">Sin horario todavía</p>
              <p className="text-[11px] text-muted-foreground">
                Mientras no agregues clases, la asistencia se sigue tomando una vez por día, como hasta ahora.
              </p>
            </div>
          )}

          {/* La semana en siete columnas. Se desplaza a lo ancho en vez de
              apilarse: una semana partida en siete filas deja de ser una semana,
              que es justo lo que esta vista existe para mostrar. */}
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${semana.length}, minmax(112px, 1fr))`,
                minWidth: semana.length * 118,
              }}
            >
              {semana.map(d => (
                <p
                  key={'cab' + d.valor}
                  className="text-[10px] font-bold text-center m-0 py-1"
                  style={{ color: '#8E87A8', letterSpacing: '0.04em' }}
                >
                  {d.nombre.slice(0, 3)}
                </p>
              ))}
              {semana.map(d => (
                <div
                  key={d.valor}
                  className="group flex flex-col gap-2 rounded-xl p-2"
                  style={{ background: '#FAF9FE', border: '1px solid rgba(120,80,200,0.14)', minHeight: 128 }}
                >
                  {d.clases.length === 0 && (
                    <span
                      className="flex-1 grid place-items-center text-[10px]"
                      style={{ color: '#8E87A8', opacity: 0.55 }}
                    >
                      Sin clases
                    </span>
                  )}
                  {d.clases.map(c => {
                    const color = c.grupoId ? colorDeGrupo(c.grupoId, idsGrupo) : '#8E87A8';
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setError(''); setEditando(c); }}
                        aria-label={'Editar ' + c.nombre + ', ' + d.nombre + ' ' + horaLegible(c.hora)}
                        className="block w-full text-left pl-2.5 py-0.5 transition-opacity hover:opacity-70"
                        style={{ borderLeft: '2.5px solid ' + color }}
                      >
                        <span className="block text-[10.5px] font-bold" style={{ color }}>
                          {horaLegible(c.hora)}
                        </span>
                        <span className="block text-[11px] font-semibold text-foreground leading-tight mt-px truncate">
                          {c.nombre}
                        </span>
                        <span className="block text-[9.5px] truncate" style={{ color: '#8E87A8' }}>
                          {c.location.name}
                        </span>
                      </button>
                    );
                  })}
                  {/* El «+» solo al pasar por encima. Siete botones fijos compiten
                      con las clases, que son lo que hay que ver. En pantalla tactil
                      no existe el «encima», asi que ahi se queda visible. */}
                  <button
                    type="button"
                    onClick={() => abrirNueva(d.valor)}
                    aria-label={'Agregar clase el ' + d.nombre.toLowerCase()}
                    className="mt-auto w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10.5px] font-bold opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                    style={{ border: '1.5px dashed rgba(120,80,200,0.26)', color: '#8E87A8' }}
                  >
                    <IconMas className="w-2.5 h-2.5" /> Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Que color es cada grupo. Sin esto la cuadricula son rayas de colores
              sin significado: el nombre del grupo no siempre cabe en el bloque. */}
          {hayClases && grupos.length > 0 && (
            <div
              className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2.5"
              style={{ borderTop: '1px solid rgba(120,80,200,0.14)' }}
            >
              {grupos.map(g => (
                <span key={g.id} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#5B5470' }}>
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: colorDeGrupo(g.id, idsGrupo) }}
                  />
                  {g.nombre}
                </span>
              ))}
            </div>
          )}
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
                {/* El grupo va primero porque de el salen la sede y el nombre
                    propuesto: preguntarlo despues obliga a devolverse. */}
                {grupos.filter(g => g.activo).length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">¿De qué grupo?</Label>
                    <div className="flex flex-col gap-1.5">
                      {[null, ...grupos.filter(g => g.activo)].map(g => {
                        const puesto = (editando.grupoId ?? null) === (g?.id ?? null);
                        return (
                          <button
                            key={g?.id ?? 'ninguno'}
                            type="button"
                            onClick={() => elegirGrupo(g)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                            style={puesto
                              ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                              : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                          >
                            <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                              style={{ border: `1.5px solid ${puesto ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                              {puesto && <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />}
                            </span>
                            {g && (
                              <span className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: colorDeGrupo(g.id, idsGrupo) }} />
                            )}
                            <span className="text-[12.5px] font-medium text-foreground flex-1 min-w-0 truncate">
                              {g ? g.nombre : 'Sin grupo'}
                            </span>
                            {g && (
                              <span className="text-[10.5px] shrink-0" style={{ color: '#8E87A8' }}>
                                {g.location.name}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nombre de la clase</Label>
                  <Input
                    value={editando.nombre ?? ''}
                    onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                    placeholder="Formativa, Técnica, Iniciación…"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Viene del grupo, pero lo puedes cambiar: una clase puede llamarse distinto.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Día</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Mismo circulo que "Dias sin entrenamiento": 40px, borde
                        de 2 y la misma abreviatura. Solo cambia el color, y a
                        proposito — el rojo de alla significa "no se entrena".
                        Los dias cerrados no se ofrecen. */}
                    {DIAS_SEMANA.filter(d => !sinEntrenamiento.includes(d.valor)).map(d => (
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

                {/* El grupo va despues de la sede porque se filtra por ella:
                    un grupo es un nombre Y una sede, asi que ofrecer los de
                    otra sede es ofrecer algo que no existe. */}
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Grupo</Label>
                  <div className="flex flex-col gap-1.5">
                    {[{ id: '', nombre: 'Sin grupo' },
                      ...grupos.filter(g => g.activo && g.location.id === editando.locationId)
                    ].map(g => {
                      const puesto = (editando.grupoId ?? '') === g.id;
                      return (
                        <button
                          key={g.id || 'ninguno'}
                          type="button"
                          onClick={() => setEditando({ ...editando, grupoId: g.id || null })}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                          style={puesto
                            ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                            : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                        >
                          <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                            style={{ border: `1.5px solid ${puesto ? '#381DA0' : 'rgba(26,16,40,0.20)'}` }}>
                            {puesto && <span className="w-2 h-2 rounded-full" style={{ background: '#381DA0' }} />}
                          </span>
                          <span className="text-[12.5px] font-medium text-foreground">{g.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sin grupo, la lista sale de la sede y la categoría, y dos clases iguales traen la misma gente.
                  </p>
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

      {/* ── Alta y edición de grupo ──────────────────────────────────────────
          En portal por la misma razón que el de clase: dentro de la página
          queda atrapado en el contexto de apilamiento de <main>. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {grupoEdit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setGrupoEdit(null)}
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
                  {grupoEdit.id ? 'Editar grupo' : 'Nuevo grupo'}
                </p>
                <button onClick={() => setGrupoEdit(null)} aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nombre</Label>
                  <Input
                    value={grupoEdit.nombre ?? ''}
                    onChange={e => setGrupoEdit({ ...grupoEdit, nombre: e.target.value })}
                    placeholder="Mañana, Tarde, Competitivo…"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Sede</Label>
                  <div className="flex flex-col gap-1.5">
                    {sedes.map(s => {
                      const puesta = grupoEdit.locationId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setGrupoEdit({ ...grupoEdit, locationId: s.id })}
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
              </div>

              <div className="px-5 py-4 border-t border-border/60">
                <Button
                  onClick={guardarGrupo}
                  disabled={guardando || !grupoEdit.nombre?.trim() || !grupoEdit.locationId}
                  className="w-full"
                >
                  {guardando ? 'Guardando…' : grupoEdit.id ? 'Guardar cambios' : 'Agregar grupo'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Asignar deportistas al grupo ────────────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {asignando && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setAsignando(null)}
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
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground truncate">{asignando.nombre}</p>
                  <p className="text-[11px] text-muted-foreground m-0 truncate">
                    {asignando.location.name} · {elegidos.size} elegidos
                  </p>
                </div>
                <button onClick={() => setAsignando(null)} aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto flex flex-col gap-1.5">
                {cargandoCand ? (
                  <p className="text-[12px] text-muted-foreground m-0">Cargando deportistas…</p>
                ) : candidatos.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground m-0">
                    Esta sede todavía no tiene deportistas.
                  </p>
                ) : candidatos.map(m => {
                  const puesto = elegidos.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setElegidos(prev => {
                        const n = new Set(prev);
                        if (n.has(m.id)) n.delete(m.id); else n.add(m.id);
                        return n;
                      })}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                      style={puesto
                        ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                        : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                    >
                      {/* Cuadrado y no circulo: aca se eligen varios, y el
                          circulo en el resto de la plataforma significa que
                          solo se puede uno. */}
                      <span className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center"
                        style={{ border: `1.5px solid ${puesto ? '#381DA0' : 'rgba(26,16,40,0.20)'}`,
                                 background: puesto ? '#381DA0' : '#fff' }}>
                        {puesto && <IconCheck className="w-2.5 h-2.5" style={{ color: '#fff' }} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium text-foreground truncate">{m.fullName}</span>
                        {m.category && (
                          <span className="block text-[10px] text-muted-foreground truncate">{m.category}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-4 border-t border-border/60">
                <Button onClick={guardarAsignacion} disabled={guardando || cargandoCand} className="w-full">
                  {guardando ? 'Guardando…' : `Guardar ${elegidos.size}`}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Confirmar quitar grupo ───────────────────────────────────────────── */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {grupoPorBorrar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setGrupoPorBorrar(null)}
            className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
            style={{ background: 'rgba(20,12,36,0.55)', zIndex: 70 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl p-5"
            >
              <p className="text-[14px] font-semibold text-foreground mb-1">
                ¿Quitar «{grupoPorBorrar.nombre}»?
              </p>
              <p className="text-[12px] text-muted-foreground mb-4">
                Sus {grupoPorBorrar._count.miembros} deportistas dejan de estar agrupados. No se borra nadie.
              </p>
              <div className="flex gap-2">
                <button onClick={borrarGrupo}
                  className="flex-1 py-2.5 rounded-xl text-[12.5px] font-semibold text-white"
                  style={{ background: '#EF476F' }}>
                  Quitar
                </button>
                <button onClick={() => setGrupoPorBorrar(null)}
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
