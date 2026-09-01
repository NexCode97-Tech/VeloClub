'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
import { DIAS_SEMANA } from '@/lib/dias';
import { colorDeGrupo, colorDeClase, gruposDeClases } from '@/lib/colores-grupo';
import { SelectorColor } from '@/components/ui/selector-color';
import { CATEGORIAS } from '@/lib/categorias';
import { IconCheck, IconEliminar, IconMas, IconUsers } from '@/components/ui/custom-icons';

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

/**
 * El grupo es donde vive la lista de deportistas de la clase. **No es una
 * pantalla**: no se crea, no se elige y no se administra aparte. Sale del
 * nombre y la sede de la clase, y el backend lo resuelve solo. Acá llega
 * únicamente para pintar el color y decir cuánta gente trae la clase.
 */
export interface GrupoDeClase {
  id: string;
  nombre: string;
  /** "#RRGGBB", o null si nadie lo escogió: ahí manda la posición. */
  color: string | null;
  _count: { miembros: number; clases: number };
}

export interface Clase {
  id: string;
  nombre: string;
  diaSemana: number;
  hora: string;
  categoria: string | null;
  /** Pisa el color del grupo solo si alguien lo escogió a propósito. */
  color: string | null;
  locationId: string;
  location: { id: string; name: string };
  grupo: GrupoDeClase | null;
}

/** Lo que se edita en el modal. `memberIds` solo existe si tocaron la lista. */
type EnEdicion = Partial<Clase> & { memberIds?: string[] };

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
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');

  // Clase en edición. `null` = cerrado; sin `id` = una nueva.
  const [editando, setEditando] = useState<EnEdicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Clase | null>(null);

  // La hoja de deportistas, que se abre encima del modal de la clase.
  const [eligiendo, setEligiendo] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [cargandoCand, setCargandoCand] = useState(false);

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

  /**
   * @param dia El dia de la celda donde se toco «Agregar». Ya viene elegido y
   *            por eso el modal no lo vuelve a preguntar: la cuadricula lo dijo.
   */
  function abrirNueva(dia = 1) {
    setError('');
    setEditando({
      nombre: '',
      diaSemana: dia,
      hora: '06:00',
      categoria: '',
      locationId: sedes[0]?.id ?? '',
      color: null,
    });
  }

  /**
   * La clase con la que esta comparte lista: la del mismo nombre en la misma
   * sede. Es la regla que usa el backend para resolver el grupo, y acá se
   * repite para poder decir de antemano cuánta gente va a traer una clase nueva
   * que se llama igual que una que ya existe.
   */
  function grupoEnEdicion(): GrupoDeClase | null {
    if (!editando) return null;
    const nombre = editando.nombre?.trim() ?? '';
    const gemela = clases.find(c =>
      c.id !== editando.id &&
      c.locationId === editando.locationId &&
      c.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (gemela?.grupo) return gemela.grupo;
    // Sin gemela, una clase que se está editando conserva el suyo: renombrarla
    // renombra el grupo y la lista no se pierde.
    return clases.find(c => c.id === editando.id)?.grupo ?? null;
  }

  /** Cuántos deportistas va a traer la clase tal como está el modal ahora. */
  function cuantos(): number {
    if (editando?.memberIds) return editando.memberIds.length;
    return grupoEnEdicion()?._count.miembros ?? 0;
  }

  // Los candidatos son los deportistas de la sede de la clase. No los de todo
  // el club: ofrecer gente de otra sede invita a armar una planilla que nadie
  // de esa sede va a poder firmar.
  async function abrirDeportistas() {
    if (!editando) return;
    setError(''); setEligiendo(true); setCargandoCand(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ members: Candidato[] }>('/members', { token });
      const deLaSede = res.members.filter(m =>
        m.role === 'DEPORTISTA' && m.active !== false &&
        m.locations.some(l => l.location.id === editando.locationId));
      setCandidatos(deLaSede);
      const grupoId = grupoEnEdicion()?.id;
      setElegidos(new Set(
        editando.memberIds
        ?? (grupoId
              ? deLaSede.filter(m => (m.grupos ?? []).some(x => x.grupoId === grupoId)).map(m => m.id)
              : []),
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los deportistas');
      setEligiendo(false);
    } finally { setCargandoCand(false); }
  }

  async function guardar() {
    if (!editando || guardando) return;
    const { id, nombre, diaSemana, hora, categoria, locationId, color, memberIds } = editando;
    if (!nombre?.trim() || !locationId || diaSemana === undefined || !hora) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      const cuerpo = JSON.stringify({
        nombre: nombre.trim(), diaSemana, hora,
        categoria: categoria?.trim() || null, locationId,
        color: color ?? null,
        // Solo si tocaron la lista. Mandarla siempre borraría la gente de una
        // clase que se abrió únicamente para corregirle la hora.
        ...(memberIds ? { memberIds } : {}),
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
  const grupos = gruposDeClases(clases);
  const idsGrupo = grupos.map(g => g.id);

  const grupoActual = editando ? grupoEnEdicion() : null;
  // Cuántas OTRAS clases comparten la lista. Si hay, hay que decirlo: tocar la
  // lista acá también las cambia, y eso no se puede descubrir después.
  const clasesQueComparten = grupoActual
    ? grupoActual._count.clases - (editando?.id && clases.find(c => c.id === editando.id)?.grupo?.id === grupoActual.id ? 1 : 0)
    : 0;

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

          {/* La semana en columnas. Se desplaza a lo ancho en vez de apilarse:
              una semana partida en filas deja de ser una semana, que es justo
              lo que esta vista existe para mostrar. */}
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
                    const color = colorDeClase(c, grupos);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setError(''); setEditando(c); }}
                        aria-label={'Editar ' + c.nombre + ', ' + d.nombre + ' ' + horaLegible(c.hora)}
                        className="block w-full text-left pl-2.5 py-0.5 transition-opacity hover:opacity-70"
                        style={{ border: 0, borderLeft: '2.5px solid ' + color }}
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
                  {/* El «+» solo al pasar por encima. Un boton fijo por dia
                      compite con las clases, que son lo que hay que ver. En
                      pantalla tactil no existe el «encima», asi que ahi se
                      queda visible. */}
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

          {/* Que color es cada clase. Sin esto la cuadricula son rayas de
              colores sin significado: el nombre no siempre cabe en el bloque. */}
          {hayClases && grupos.length > 0 && (
            <div
              className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2.5"
              style={{ borderTop: '1px solid rgba(120,80,200,0.14)' }}
            >
              {grupos.map(g => (
                <span key={g.id} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#5B5470' }}>
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: colorDeGrupo(g.id, idsGrupo, g.color) }}
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
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Nombre de la clase</Label>
                  <div className="flex items-start gap-2">
                    <Input
                      className="flex-1"
                      value={editando.nombre ?? ''}
                      onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                      placeholder="Mañana, Tarde, Formativa…"
                      autoFocus
                    />
                    <SelectorColor
                      etiqueta="Color de la clase"
                      value={colorDeClase(
                        { color: editando.color ?? null, grupoId: grupoActual?.id ?? null },
                        grupos,
                      )}
                      onChange={color => setEditando({ ...editando, color })}
                    />
                  </div>
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

                {sedes.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-[12px]">Sede</Label>
                    <div className="flex flex-col gap-1.5">
                      {sedes.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          // Cambiar de sede vacia la lista: los deportistas que
                          // se habian marcado son de la sede anterior y no
                          // entrenan en la nueva.
                          onClick={() => setEditando({ ...editando, locationId: s.id, memberIds: undefined })}
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
                )}

                {/* ── Quiénes entran ──────────────────────────────────────────
                    Es lo único que la cuadricula no puede decir: la semana
                    muestra CUANDO es cada clase, no QUIENES van. Y no se puede
                    deducir de la categoria, porque un niño de ocho años entrena
                    en la tarde si a esa hora lo pueden llevar. */}
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Deportistas</Label>
                  <button
                    type="button"
                    onClick={abrirDeportistas}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-secondary"
                    style={{ background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                  >
                    <IconUsers className="w-4 h-4 shrink-0" style={{ color: '#381DA0' }} />
                    <span className="text-[12.5px] font-medium text-foreground flex-1 min-w-0">
                      {cuantos() === 0
                        ? 'Nadie todavía'
                        : `${cuantos()} ${cuantos() === 1 ? 'deportista' : 'deportistas'}`}
                    </span>
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: '#381DA0' }}>
                      {cuantos() === 0 ? 'Elegir' : 'Cambiar'}
                    </span>
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    {clasesQueComparten > 0
                      ? `Los mismos entran en las otras ${clasesQueComparten} ${clasesQueComparten === 1 ? 'clase' : 'clases'} que se llaman así en esta sede.`
                      : 'Son los que salen en la planilla de asistencia de esta clase.'}
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
                    Recorta la lista de arriba a los de esa categoría. Sirve cuando la clase es de
                    una sola edad.
                  </p>
                </div>
              </div>

              {/* El boton por defecto mide 32px de alto, que en una hoja a pantalla
                  completa se ve aplastado. Y el relleno de abajo era 1rem: en
                  iPhone la barra de gestos se le montaba encima, porque el area
                  segura se suma al relleno, no lo reemplaza. */}
              <div className="px-5 pt-4 border-t border-border/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                {/* Borrar vive aca y no en la cuadricula. Un boton de basura
                    por bloque llenaria la semana de iconos rojos, que es lo
                    contrario de lo que la vista existe para mostrar; y sin el,
                    una clase no se podia quitar de ninguna forma. */}
                <div className="flex gap-2">
                  {editando.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const c = clases.find(x => x.id === editando.id);
                        if (c) { setEditando(null); setPorBorrar(c); }
                      }}
                      aria-label="Quitar esta clase"
                      className="h-12 px-4 rounded-xl shrink-0 flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors hover:bg-red-50"
                      style={{ color: '#EF476F', border: '1.5px solid rgba(239,71,111,0.28)' }}
                    >
                      <IconEliminar className="w-4 h-4" />
                      <span className="hidden sm:inline">Quitar</span>
                    </button>
                  )}
                  <Button
                    onClick={guardar}
                    disabled={guardando || !editando.nombre?.trim() || !editando.locationId}
                    className="flex-1 h-12 text-[14px]"
                  >
                    {guardando ? 'Guardando…' : editando.id ? 'Guardar cambios' : 'Agregar clase'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Quiénes entran en la clase ───────────────────────────────────────
          Encima del modal de la clase, no en vez de el: se elige y se vuelve.
          Nada se guarda aca — la lista viaja con la clase cuando se guarda. */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {eligiendo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setEligiendo(false)}
            className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
            style={{ background: 'rgba(20,12,36,0.55)', zIndex: 72 }}
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
                  <p className="text-[15px] font-semibold text-foreground truncate">
                    ¿Quiénes entran?
                  </p>
                  <p className="text-[11px] text-muted-foreground m-0 truncate">
                    {sedes.find(s => s.id === editando?.locationId)?.name ?? ''} · {elegidos.size} elegidos
                  </p>
                </div>
                <button onClick={() => setEligiendo(false)} aria-label="Cerrar"
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

              <div className="px-5 pt-4 border-t border-border/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
                <Button
                  onClick={() => {
                    setEditando(e => (e ? { ...e, memberIds: [...elegidos] } : e));
                    setEligiendo(false);
                  }}
                  disabled={cargandoCand}
                  className="w-full h-12 text-[14px]"
                >
                  Listo, {elegidos.size}
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
