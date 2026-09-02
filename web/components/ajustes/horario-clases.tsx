'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { colorDeClase, nombresDeClase } from '@/lib/colores-clase';
import { SelectorColor } from '@/components/ui/selector-color';
import { CATEGORIAS } from '@/lib/categorias';
import { IconCheck, IconEliminar, IconMas } from '@/components/ui/custom-icons';

interface Sede { id: string; name: string }

export interface Clase {
  id: string;
  nombre: string;
  diaSemana: number;
  hora: string;
  /** Quiénes entran a la planilla: esto cruzado con la sede. Vacío = todas. */
  categorias: string[];
  /** "#RRGGBB", o null si nadie lo escogió: ahí manda la posición del nombre. */
  color: string | null;
  locationId: string;
  location: { id: string; name: string };
}

/**
 * Lo que se edita en el modal.
 *
 * No es una `Clase`: una clase, para quien arma el horario, es una cosa que
 * ocurre VARIOS dias —«la de la mañana» es lunes, miercoles y viernes a las 6—
 * y en la base cada dia es una fila propia porque la asistencia se toma por
 * dia. Aca se junta lo que el modal escribe una sola vez con la lista de dias.
 *
 * `ids` son las filas que hoy forman esta clase. Va vacio cuando es nueva.
 */
interface EnEdicion {
  ids: string[];
  nombre: string;
  dias: number[];
  hora: string;
  categorias: string[];
  color: string | null;
  locationId: string;
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
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState('');

  // Clase en edición. `null` = cerrado; sin `ids` = una nueva.
  const [editando, setEditando] = useState<EnEdicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<EnEdicion | null>(null);

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
      ids: [],
      nombre: '',
      dias: [dia],
      hora: '06:00',
      categorias: [],
      locationId: sedes[0]?.id ?? '',
      color: null,
    });
  }

  /**
   * Abrir una clase que ya existe recoge TODOS sus dias.
   *
   * Se reconocen por nombre, sede y hora: es lo que el modal escribe una sola
   * vez, asi que dos filas que coinciden en las tres son el lunes y el
   * miercoles de la misma clase. La hora entra a proposito — «Mañana» a las 6 y
   * «Mañana» a las 8 son dos clases distintas aunque se llamen igual.
   */
  function abrirExistente(c: Clase) {
    setError('');
    const hermanas = clases.filter(x =>
      x.nombre.trim().toLowerCase() === c.nombre.trim().toLowerCase() &&
      x.locationId === c.locationId &&
      x.hora === c.hora);
    setEditando({
      ids: hermanas.map(x => x.id),
      nombre: c.nombre,
      dias: [...new Set(hermanas.map(x => x.diaSemana))],
      hora: c.hora,
      categorias: c.categorias,
      color: c.color,
      locationId: c.locationId,
    });
  }

  /** Marcar y desmarcar. El ultimo no se quita: para eso esta «Quitar». */
  function alternarDia(d: number) {
    setEditando(e => {
      if (!e) return e;
      const puesto = e.dias.includes(d);
      if (puesto && e.dias.length === 1) return e;
      return { ...e, dias: puesto ? e.dias.filter(x => x !== d) : [...e.dias, d] };
    });
  }

  /**
   * Marcar y desmarcar una categoría.
   *
   * Igual que los días, y por la misma razón: una clase de la mañana puede
   * recibir menores Y transición. Con una sola había que partirla en dos clases
   * a la misma hora en la misma sede, o dejarla abierta a todo el club.
   *
   * Quitar la última no deja la clase sin nadie: la lista vacía significa
   * «todas», que es lo que el botón de arriba dice con todas las letras.
   */
  function alternarCategoria(c: string) {
    setEditando(e => {
      if (!e) return e;
      return {
        ...e,
        categorias: e.categorias.includes(c)
          ? e.categorias.filter(x => x !== c)
          : [...e.categorias, c],
      };
    });
  }

  async function guardar() {
    if (!editando || guardando) return;
    const { ids, nombre, dias, hora, categorias, locationId, color } = editando;
    if (!nombre.trim() || !locationId || dias.length === 0 || !hora) return;

    setGuardando(true); setError('');
    try {
      const token = await getToken();
      // Una sola peticion con la clase entera. Los dias que se marcaron y los
      // que se quitaron los resuelve el servidor en una transaccion: hacerlo
      // aca con tres llamadas deja el horario a medias si una falla.
      await apiFetch('/clases/semana', {
        token, method: 'PUT',
        body: JSON.stringify({
          ids, nombre: nombre.trim(), dias, hora,
          categorias, locationId,
          color: color ?? null,
        }),
      });
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clase');
    } finally { setGuardando(false); }
  }

  // Quitarla la quita de todos sus dias: es una sola cosa, y dejarla suelta el
  // miercoles despues de haberla borrado seria un fantasma.
  async function borrar() {
    if (!porBorrar) return;
    try {
      const token = await getToken();
      for (const id of porBorrar.ids) {
        await apiFetch(`/clases/${id}`, { token, method: 'DELETE' });
      }
      setPorBorrar(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la clase');
    }
  }

  /**
   * Arrastrar una clase de un dia a otro.
   *
   * Va con eventos de puntero a mano y no con una libreria. La cuadricula se
   * desplaza a lo ancho con el dedo, asi que el mismo gesto sirve para dos
   * cosas, y hay que decidir cual es cual: con mouse el arrastre arranca de
   * una, y con el dedo hay que sostener un momento. Sin esa espera, deslizar la
   * semana movia clases sin que nadie lo pidiera.
   *
   * `movido` distingue el arrastre del toque: sin el, soltar sobre el mismo dia
   * abriria el modal, que es lo que hace un clic normal.
   */
  const arrastre = useRef<{
    clase: Clase; x: number; y: number; armado: boolean; movido: boolean;
    espera: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const [moviendo, setMoviendo] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [diaSobre, setDiaSobre] = useState<number | null>(null);
  /**
   * El dia que se muestra en movil.
   *
   * En un telefono la semana no cabe: seis columnas en 360 px dejan 108 para
   * cada dia, y ahi no entra «Clase de la mañana» ni el nombre de la sede, asi
   * que todo salia cortado con puntos suspensivos. En vez de encoger mas, se
   * muestra un dia a la vez, con los circulos de arriba —los mismos de
   * Asistencia— para cambiar. En escritorio sigue la cuadricula, que ahi si
   * tiene ancho de sobra.
   */
  const [diaSel, setDiaSel] = useState(() => {
    const hoy = new Date().getDay();
    return sinEntrenamiento.includes(hoy) ? 1 : hoy;
  });
  /** Un arrastre termina en un clic del navegador. Este lo tapa. */
  const tapaClic = useRef(false);

  /**
   * El dia de la celda que hay bajo el puntero.
   *
   * `elementsFromPoint` en plural y saltando el bloque que se mueve: el bloque
   * viaja encima del puntero, y preguntarle a el por su celda devolveria
   * siempre la de donde salio. Tampoco se le puede poner `pointer-events: none`
   * para esquivarlo, porque es el que tiene capturado el puntero y dejaria de
   * recibir el `pointerup`: el bloque se quedaria pegado al dedo.
   */
  function diaBajoElPuntero(x: number, y: number): number | null {
    for (const nodo of document.elementsFromPoint(x, y)) {
      if (nodo.closest('[data-arrastrando]')) continue;
      const celda = nodo.closest('[data-dia]');
      if (celda) {
        const dia = Number(celda.getAttribute('data-dia'));
        return Number.isNaN(dia) ? null : dia;
      }
    }
    return null;
  }

  /** Cuanto hay que mover el dedo para que cuente como deslizar y no como sostener. */
  const TOLERANCIA = 10;
  /** Cuanto hay que sostener con el dedo antes de que el bloque se despegue. */
  const ESPERA_TACTIL = 320;

  function limpiarArrastre() {
    if (arrastre.current?.espera) clearTimeout(arrastre.current.espera);
    arrastre.current = null;
    setMoviendo(null);
    setDiaSobre(null);
  }

  function alPresionar(e: React.PointerEvent, c: Clase) {
    // Solo el boton principal: con el derecho se abre el menu del navegador y
    // el bloque se quedaria pegado al puntero.
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const iniciar = () => {
      if (!arrastre.current) return;
      arrastre.current.armado = true;
      setMoviendo({ id: c.id, dx: 0, dy: 0 });
    };

    arrastre.current = {
      clase: c, x: e.clientX, y: e.clientY, armado: false, movido: false,
      espera: e.pointerType === 'mouse' ? null : setTimeout(iniciar, ESPERA_TACTIL),
    };
    if (e.pointerType === 'mouse') iniciar();
  }

  function alMover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;

    // Todavia sosteniendo: si el dedo se corre, es que esta deslizando la
    // semana. Se cancela la espera y el gesto vuelve a ser del carril.
    if (!a.armado) {
      if (Math.hypot(dx, dy) > TOLERANCIA) limpiarArrastre();
      return;
    }

    if (Math.hypot(dx, dy) > 3) a.movido = true;
    setMoviendo({ id: a.clase.id, dx, dy });

    setDiaSobre(diaBajoElPuntero(e.clientX, e.clientY));
  }

  function alSoltar(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a) return;
    const { clase, armado, movido } = a;
    // Del puntero y no de `diaSobre`: ese es estado de React y puede ir un
    // fotograma atras. Soltar tiene que mirar donde esta el dedo AHORA.
    const destino = armado && movido ? diaBajoElPuntero(e.clientX, e.clientY) : null;
    limpiarArrastre();

    // Sin arrastre no se hace nada aca: el clic que viene detras abre el modal,
    // y hacerlo tambien aca lo abriria dos veces.
    if (!armado || !movido) return;

    tapaClic.current = true;
    if (destino === null || destino === clase.diaSemana) return;
    moverClase(clase, destino);
  }

  /**
   * Mueve la clase del dia donde estaba al dia donde la soltaron.
   *
   * Va por `/clases/semana` y no por una fila suelta porque una clase son
   * varios dias: mover el bloque del lunes es cambiar el lunes por el jueves
   * dentro de su lista de dias, dejando el resto quieto.
   *
   * Se pinta antes de pedirlo. La cuadricula tiene que responder al soltar, no
   * medio segundo despues; si el servidor falla, se recarga y vuelve a su sitio
   * con el aviso al lado.
   */
  async function moverClase(c: Clase, destino: number) {
    const hermanas = clases.filter(x =>
      x.nombre.trim().toLowerCase() === c.nombre.trim().toLowerCase() &&
      x.locationId === c.locationId &&
      x.hora === c.hora);
    const dias = [...new Set(hermanas.map(x => x.diaSemana))];
    // Ya se dicta ese dia: mover el lunes al miercoles cuando ya hay miercoles
    // seria perder el lunes a cambio de nada.
    if (dias.includes(destino)) return;

    setError('');
    setClases(prev => prev.map(x => (x.id === c.id ? { ...x, diaSemana: destino } : x)));
    try {
      const token = await getToken();
      await apiFetch('/clases/semana', {
        token, method: 'PUT',
        body: JSON.stringify({
          ids: hermanas.map(x => x.id),
          nombre: c.nombre, locationId: c.locationId, hora: c.hora,
          categorias: c.categorias, color: c.color,
          dias: dias.map(d => (d === c.diaSemana ? destino : d)),
        }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover la clase');
      await cargar();
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
  const nombres = nombresDeClase(clases);
  // Si el club marca como sin entrenamiento justo el dia que se estaba viendo,
  // se cae al primero que quede. Se resuelve aca y no con un efecto que corrija
  // `diaSel`: `semana` se arma en cada render, asi que ese efecto correria
  // siempre, y entre que corre y no, la pantalla mostraria un dia que ya no
  // existe.
  const delDia = semana.find(d => d.valor === diaSel) ?? semana[0];

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground m-0">Horario de clases</h3>
        <p className="text-[11px] text-muted-foreground">
          Las clases que dicta el club cada semana. La asistencia se toma sobre estas, y cada
          una trae a los deportistas de su sede y su categoría.
          <span className="hidden md:inline"> Arrastra una clase para cambiarla de día.</span>
          <span className="md:hidden"> Arrastra una clase hasta otro día para moverla.</span>
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
              lo que esta vista existe para mostrar.

              Solo desde `md`: en un telefono estas seis columnas no caben y
              cortan todos los nombres. Ahi manda el bloque de abajo. */}
          <div className="hidden md:block overflow-x-auto pb-1">
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
                  data-dia={d.valor}
                  className="group flex flex-col gap-2 rounded-xl p-2 transition-colors"
                  style={{
                    background: diaSobre === d.valor ? 'rgba(56,29,160,0.06)' : '#FAF9FE',
                    border: `1px solid ${diaSobre === d.valor ? 'rgba(56,29,160,0.40)' : 'rgba(120,80,200,0.14)'}`,
                    minHeight: 128,
                  }}
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
                    const color = colorDeClase(c, nombres);
                    const suelto = moviendo?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onPointerDown={e => alPresionar(e, c)}
                        onPointerMove={alMover}
                        onPointerUp={alSoltar}
                        onPointerCancel={limpiarArrastre}
                        // El clic abre el modal, venga del mouse o del dedo.
                        // Despues de arrastrar el navegador manda uno igual, y
                        // ese es el que hay que tapar.
                        onClick={() => {
                          if (tapaClic.current) { tapaClic.current = false; return; }
                          abrirExistente(c);
                        }}
                        aria-label={'Editar ' + c.nombre + ', ' + d.nombre + ' ' + horaLegible(c.hora)}
                        data-arrastrando={suelto ? '' : undefined}
                        className="block w-full text-left pl-2.5 py-0.5 hover:opacity-70"
                        style={{
                          border: 0,
                          borderLeft: '2.5px solid ' + color,
                          cursor: suelto ? 'grabbing' : 'grab',
                          // Quieto deja pasar el deslizamiento del carril, que
                          // es lo que el bloque no puede robar. Ya despegado se
                          // queda con el gesto, o el navegador desplaza la
                          // semana mientras se arrastra.
                          touchAction: suelto ? 'none' : 'pan-x',
                          ...(suelto
                            ? {
                                transform: `translate(${moviendo.dx}px, ${moviendo.dy}px) scale(1.04)`,
                                background: '#fff',
                                borderRadius: 8,
                                boxShadow: '0 10px 24px rgba(26,16,40,0.18)',
                                position: 'relative' as const,
                                zIndex: 30,
                                opacity: 0.96,
                              }
                            : { transition: 'opacity .15s ease' }),
                        }}
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

          {/* ── Movil: un dia a la vez ────────────────────────────────── */}
          <div className="md:hidden">
            {/* Los circulos de los dias. Mismo control que el de Asistencia,
                para que el gesto ya se conozca. Los puntos de abajo dicen que
                dias tienen clase y de que color, asi el dia vacio se ve sin
                tener que tocarlo. */}
            <div
              className="flex gap-1.5 rounded-2xl px-2 py-2.5 mb-3"
              style={{ background: '#fff', border: '1px solid rgba(120,80,200,0.14)' }}
            >
              {semana.map(d => {
                const puesto = d.valor === diaSel;
                const marcado = diaSobre === d.valor;
                return (
                  <button
                    key={d.valor}
                    type="button"
                    data-dia={d.valor}
                    onClick={() => setDiaSel(d.valor)}
                    aria-label={d.nombre}
                    aria-pressed={puesto}
                    className="flex-1 flex flex-col items-center gap-1 py-0.5 rounded-xl transition-colors"
                    style={marcado ? { background: 'rgba(56,29,160,0.08)' } : undefined}
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 transition-all"
                      style={puesto || marcado
                        ? { background: 'rgba(56,29,160,0.08)', borderColor: '#381DA0', color: '#381DA0' }
                        : { background: '#fff', borderColor: 'rgba(120,80,200,0.15)', color: '#8E87A8' }}
                    >
                      {d.corto}
                    </span>
                    <span className="text-[9px] font-semibold" style={{ color: puesto ? '#381DA0' : '#8E87A8' }}>
                      {d.nombre.slice(0, 3)}
                    </span>
                    {/* Tres como tope: mas puntos no dicen mas, solo aprietan. */}
                    <span className="flex gap-[3px] h-1 items-center">
                      {d.clases.slice(0, 3).map(c => (
                        <span key={c.id} className="w-1 h-1 rounded-full"
                          style={{ background: colorDeClase(c, nombres) }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            {delDia && (
              <>
                <div className="flex items-baseline gap-2 mb-2 px-0.5">
                  <p className="text-[14.5px] font-semibold text-foreground m-0">{delDia.nombre}</p>
                  <p className="text-[11px] text-muted-foreground m-0">
                    {delDia.clases.length === 0 ? 'sin clases'
                      : `· ${delDia.clases.length} ${delDia.clases.length === 1 ? 'clase' : 'clases'}`}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  {delDia.clases.map(c => {
                    const color = colorDeClase(c, nombres);
                    const suelto = moviendo?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onPointerDown={e => alPresionar(e, c)}
                        onPointerMove={alMover}
                        onPointerUp={alSoltar}
                        onPointerCancel={limpiarArrastre}
                        onClick={() => {
                          if (tapaClic.current) { tapaClic.current = false; return; }
                          abrirExistente(c);
                        }}
                        data-arrastrando={suelto ? '' : undefined}
                        aria-label={'Editar ' + c.nombre + ', ' + delDia.nombre + ' ' + horaLegible(c.hora)}
                        className="w-full flex items-center gap-3 text-left rounded-xl overflow-hidden relative"
                        style={{
                          background: '#fff',
                          border: '1px solid rgba(120,80,200,0.14)',
                          padding: '10px 12px',
                          touchAction: suelto ? 'none' : 'pan-y',
                          ...(suelto
                            ? {
                                transform: `translate(${moviendo.dx}px, ${moviendo.dy}px) scale(1.02)`,
                                boxShadow: '0 10px 24px rgba(26,16,40,0.18)',
                                zIndex: 30,
                                opacity: 0.96,
                              }
                            : {}),
                        }}
                      >
                        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
                        {/* La hora en dos renglones y con ancho fijo, para que
                            los nombres arranquen todos en la misma columna.
                            «6:00 a. m.» en una sola linea pide 70 px, y esos 70
                            se los quita al nombre, que es lo que hay que leer. */}
                        <span className="text-[11.5px] font-bold shrink-0 w-[46px] leading-[1.15]" style={{ color }}>
                          {horaLegible(c.hora).split(' ')[0]}
                          <span className="block text-[9.5px] font-semibold">
                            {horaLegible(c.hora).split(' ').slice(1).join(' ')}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-semibold text-foreground leading-tight">
                            {c.nombre}
                          </span>
                          <span className="block text-[10.5px] mt-0.5 truncate" style={{ color: '#8E87A8' }}>
                            {c.location.name}
                          </span>
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => abrirNueva(delDia.valor)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11.5px] font-bold"
                    style={{ border: '1.5px dashed rgba(120,80,200,0.26)', color: '#8E87A8' }}
                  >
                    <IconMas className="w-3 h-3" /> Agregar clase el {delDia.nombre.toLowerCase()}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Que color es cada clase. Sin esto la cuadricula son rayas de
              colores sin significado: el nombre no siempre cabe en el bloque. */}
          {hayClases && (
            <div
              className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2.5"
              style={{ borderTop: '1px solid rgba(120,80,200,0.14)' }}
            >
              {nombres.map(n => (
                <span key={n} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: '#5B5470' }}>
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: colorDeClase(clases.find(c => c.nombre.trim() === n)!, nombres) }}
                  />
                  {n}
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
                  {editando.ids.length ? 'Editar clase' : 'Nueva clase'}
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
                      value={editando.nombre}
                      onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                      placeholder="Mañana, Tarde, Formativa…"
                      autoFocus
                    />
                    <SelectorColor
                      etiqueta="Color de la clase"
                      value={colorDeClase(
                        { nombre: editando.nombre, color: editando.color },
                        nombres,
                      )}
                      onChange={color => setEditando({ ...editando, color })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Días</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Mismo circulo que "Dias sin entrenamiento": 40px, borde
                        de 2 y la misma abreviatura. Solo cambia el color, y a
                        proposito — el rojo de alla significa "no se entrena".
                        Los dias cerrados no se ofrecen.

                        Se marcan varios y se desmarcan volviendo a oprimir. Con
                        uno solo, una clase de lunes, miercoles y viernes habia
                        que escribirla tres veces entera, repitiendo a mano el
                        nombre, la hora, la sede y la categoria en cada una. */}
                    {DIAS_SEMANA.filter(d => !sinEntrenamiento.includes(d.valor)).map(d => {
                      const puesto = editando.dias.includes(d.valor);
                      return (
                        <button
                          key={d.valor}
                          type="button"
                          aria-label={d.nombre}
                          aria-pressed={puesto}
                          onClick={() => alternarDia(d.valor)}
                          className="w-10 h-10 rounded-full text-[12px] font-semibold border-2 transition-all flex items-center justify-center"
                          style={puesto
                            ? { background: 'rgba(56,29,160,0.08)', borderColor: '#381DA0', color: '#381DA0' }
                            : { background: '#fff', borderColor: 'rgba(120,80,200,0.15)', color: '#8E87A8' }}
                        >
                          {d.corto}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Marca todos los días en que se dicta. Vuelve a oprimir uno para quitarlo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px]">Hora de inicio</Label>
                  <TimePicker
                    className="max-w-[180px]"
                    value={editando.hora}
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
                )}

                {/* ── Quiénes entran ──────────────────────────────────────────
                    La categoría no es un adorno de la clase: es lo que arma su
                    planilla, cruzada con la sede. Por eso la ayuda de abajo
                    dice a quién trae, no qué campo es. */}
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Categorías</Label>
                  {/* Lista cerrada y no texto libre: la categoria se compara
                      letra por letra contra la del deportista. Escribir
                      "Menores" donde el miembro dice "Menores 3-10 años" no da
                      error, da una planilla vacia.

                      Se marcan VARIAS, igual que los dias: una clase de la
                      mañana puede recibir menores y transicion, y con una sola
                      habia que partirla en dos clases a la misma hora en la
                      misma sede.

                      Cuadrado y no circulo: el circulo, en el resto de la
                      plataforma, significa que solo se puede una. */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditando({ ...editando, categorias: [] })}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                      style={editando.categorias.length === 0
                        ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                        : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                    >
                      <span className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center"
                        style={{
                          border: `1.5px solid ${editando.categorias.length === 0 ? '#381DA0' : 'rgba(26,16,40,0.20)'}`,
                          background: editando.categorias.length === 0 ? '#381DA0' : '#fff',
                        }}>
                        {editando.categorias.length === 0 && <IconCheck className="w-2.5 h-2.5" style={{ color: '#fff' }} />}
                      </span>
                      <span className="text-[12.5px] font-medium text-foreground">Todas las categorías</span>
                    </button>
                    {CATEGORIAS.map(c => {
                      const puesta = editando.categorias.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => alternarCategoria(c)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
                          style={puesta
                            ? { background: 'rgba(56,29,160,0.06)', border: '1.5px solid rgba(56,29,160,0.35)' }
                            : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
                        >
                          <span className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center"
                            style={{
                              border: `1.5px solid ${puesta ? '#381DA0' : 'rgba(26,16,40,0.20)'}`,
                              background: puesta ? '#381DA0' : '#fff',
                            }}>
                            {puesta && <IconCheck className="w-2.5 h-2.5" style={{ color: '#fff' }} />}
                          </span>
                          <span className="text-[12.5px] font-medium text-foreground">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Es quién entra a la planilla de esta clase. Puedes marcar varias; sin
                    ninguna, la sede entera.
                  </p>
                </div>
              </div>

              {/* El boton por defecto mide 32px de alto, que en una hoja a pantalla
                  completa se ve aplastado. Y el relleno de abajo se suma al
                  area segura, no la reemplaza: en iPhone la barra de gestos se
                  le montaba encima. Con 1.25rem el boton seguia quedando pegado
                  al filo de la pantalla; 2rem lo despega. */}
              <div className="px-5 pt-4 border-t border-border/60"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
                {/* Borrar vive aca y no en la cuadricula. Un boton de basura
                    por bloque llenaria la semana de iconos rojos, que es lo
                    contrario de lo que la vista existe para mostrar; y sin el,
                    una clase no se podia quitar de ninguna forma. */}
                <div className="flex gap-2">
                  {editando.ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { const c = editando; setEditando(null); setPorBorrar(c); }}
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
                    disabled={guardando || !editando.nombre.trim() || !editando.locationId || editando.dias.length === 0}
                    className="flex-1 h-12 text-[14px]"
                  >
                    {guardando ? 'Guardando…'
                      : editando.ids.length ? 'Guardar cambios'
                      : editando.dias.length > 1 ? 'Agregar en ' + editando.dias.length + ' días'
                      : 'Agregar clase'}
                  </Button>
                </div>
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
                {porBorrar.dias.length > 1
                  ? 'Se quita de los ' + porBorrar.dias.length + ' días en que se dicta. '
                  : ''}
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
