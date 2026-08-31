'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { colorDeDeporte, iconoDeDeporte, IconMas } from '@/components/ui/custom-icons';
import { DEPORTES, mismoDeporte } from '@/lib/deportes';

export interface Carpeta {
  id: string;
  nombre: string;
  activo: boolean;
}

interface CarpetaConCifras extends Carpeta {
  deportistas: number;
  sedes: number;
}

interface Props {
  deportes: Carpeta[];
  activo: string | null;
  /** Cambiar de deporte y abrir uno nuevo: los administradores. */
  puedeCambiar: boolean;
  colapsado: boolean;
  onCambiar: (id: string) => void;
  /** Trae los conteos. Se llama al abrir, no en cada carga del panel. */
  cargarCifras: () => Promise<CarpetaConCifras[]>;
  onAgregar: (nombre: string) => Promise<void>;
}

const MORADO = '#381DA0';
const MUDO   = '#8E87A8';
const BORDE  = 'rgba(120,80,200,0.10)';

/**
 * La insignia del deporte.
 *
 * Con ícono propio cuando lo hay y, si no, con la inicial del nombre. La
 * inicial no es un parche: un ícono genérico para todos los deportes sin arte
 * dejaría tres carpetas con el mismo dibujo, que es justo lo contrario de para
 * lo que está el ícono.
 */
function Insignia({ nombre, tam = 28 }: { nombre: string; tam?: number }) {
  const Icono = iconoDeDeporte(nombre);
  const glifo = Math.round(tam * 0.57);
  const { color, sombra, brillo, tinta } = colorDeDeporte(nombre);
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{
        width: tam, height: tam, borderRadius: '50%',
        // El relieve son tres capas y cada una hace algo distinto: el degradado
        // da el volumen, la línea blanca de adentro es el brillo del borde
        // superior, y la sombra de abajo despega la insignia del fondo. Con una
        // sola de las tres se ve plana con un degradado encima.
        background: `linear-gradient(160deg, ${brillo} 0%, ${color} 58%, ${sombra} 100%)`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(0,0,0,0.14), ' +
          '0 1px 2px rgba(26,16,40,0.22), 0 3px 7px -2px rgba(26,16,40,0.24)',
        color: tinta,
      }}
    >
      {Icono
        ? <Icono style={{ width: glifo, height: glifo }} />
        : <span className="font-semibold leading-none" style={{ fontSize: Math.round(tam * 0.44) }}>
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
      }
    </span>
  );
}

/**
 * El selector de deporte, arriba del menú.
 *
 * Va arriba y con su propia línea divisoria porque no es una opción más de la
 * navegación: es lo que decide qué navegación estás mirando. Puesto entre
 * Inicio y Miembros se leería como un módulo más.
 *
 * A quien no puede cambiar no se le esconde: se le deja como rótulo, sin flecha
 * y sin abrir. Un entrenador que no sabe en qué deporte está es un entrenador
 * que marca asistencia en el lugar equivocado.
 *
 * Se muestra siempre, también en un club de un solo deporte: lo que confirma no
 * es cuál de varios, es que estás parado donde crees.
 */
export default function SelectorDeporte({
  deportes, activo, puedeCambiar, colapsado, onCambiar, cargarCifras, onAgregar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cifras, setCifras] = useState<CarpetaConCifras[] | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number } | null>(null);
  const botonRef = useRef<HTMLDivElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  const actual = deportes.find(d => d.id === activo) ?? deportes[0] ?? null;

  // Los conteos se piden al abrir y no en cada carga del panel: solo se ven
  // aquí adentro, y pedirlos siempre sería una consulta por entrada al panel
  // para un número que casi nunca se mira.
  useEffect(() => {
    if (!abierto || cifras) return;
    let vivo = true;
    cargarCifras()
      .then(c => { if (vivo) setCifras(c); })
      .catch(() => { /* sin cifras el selector igual funciona */ });
    return () => { vivo = false; };
  }, [abierto, cifras, cargarCifras]);

  // Cerrar al tocar fuera. Cuenta como «dentro» tanto el botón como el menú:
  // el menú vive en un portal y cuelga del body, así que sin comprobarlo
  // también, tocar cualquier opción se leía como un clic de afuera y cerraba
  // el menú en el mismo gesto con el que se estaba eligiendo.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (botonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setAbierto(false);
    };
    const conEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', conEsc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', conEsc);
    };
  }, [abierto]);

  // Al cerrarlo vuelve a la lista de deportes: reabrirlo y encontrarse a mitad
  // de «agregar» es desconcertante, porque no es donde se dejó.
  useEffect(() => {
    if (!abierto) { setEligiendo(false); setError(null); }
  }, [abierto]);

  // El menú se dibuja en un portal para que no lo recorte el sidebar, que tiene
  // scroll propio. Al vivir fuera, su posición hay que calcularla.
  useEffect(() => {
    if (!abierto) { setCaja(null); return; }
    const medir = () => {
      const r = botonRef.current?.getBoundingClientRect();
      if (r) setCaja({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 248) });
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [abierto]);

  if (!actual) return null;

  const cifrasDe = (id: string) => cifras?.find(c => c.id === id) ?? null;
  const disponibles = DEPORTES.filter(d => !deportes.some(x => mismoDeporte(x.nombre, d)));

  async function crear(nombre: string) {
    setCreando(nombre);
    setError(null);
    try {
      await onAgregar(nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar');
      setCreando(null);
    }
  }

  const cuerpo = (
    <>
      <Insignia nombre={actual.nombre} />
      {!colapsado && (
        <>
          <span className="flex flex-col flex-1 min-w-0 text-left">
            <span className="text-[10.5px] font-semibold" style={{ color: MUDO }}>
              Deporte
            </span>
            <span
              className="text-[13.5px] font-semibold truncate"
              style={{ letterSpacing: '-0.01em', color: '#1A1028' }}
            >
              {actual.nombre}
            </span>
          </span>
          {puedeCambiar && (
            <ChevronDown
              className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
              style={{ color: MUDO, transform: abierto ? 'rotate(180deg)' : 'none' }}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <div
      className="shrink-0"
      style={{ padding: 10, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div ref={botonRef}>
        {puedeCambiar ? (
          <button
            type="button"
            onClick={() => setAbierto(v => !v)}
            aria-haspopup="listbox"
            aria-expanded={abierto}
            title={colapsado ? actual.nombre : undefined}
            // El fondo cambia con la medida porque el selector cambia de sitio:
            // en escritorio vive en el sidebar, que es blanco, y ahi el gris lo
            // recorta; en movil vive sobre el fondo de la pagina, que es ese
            // mismo gris, y se disolvia. Blanco con la sombra de las fichas de
            // Inicio, para que se lea como una tarjeta mas de esa columna.
            //
            // El corte va en `md` porque es el mismo con el que cada copia
            // aparece y desaparece: el sidebar es `hidden md:flex` y la de
            // movil, `md:hidden`.
            className="w-full flex items-center gap-[9px] rounded-[11px] cursor-pointer transition-colors bg-white shadow-[0_1px_6px_rgba(0,0,0,0.05)] md:bg-[#F7F7FB] md:shadow-none hover:bg-[#F1EFF9]"
            style={{ padding: colapsado ? 5 : '9px 10px', border: `1px solid ${BORDE}` }}
          >
            {cuerpo}
          </button>
        ) : (
          // Rótulo, no control: fondo blanco y borde punteado para que se lea
          // como «estás aquí» y no como algo que se puede tocar.
          <div
            title={colapsado ? actual.nombre : undefined}
            className="w-full flex items-center gap-[9px] rounded-[11px]"
            style={{ padding: colapsado ? 5 : '9px 10px', background: '#fff', border: `1px dashed ${BORDE}` }}
          >
            {cuerpo}
          </div>
        )}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && caja && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              role="listbox"
              aria-label="Deportes del club"
              className="fixed z-[80]"
              style={{
                top: caja.top, left: caja.left, width: caja.width,
                background: '#fff', border: `1px solid ${BORDE}`, borderRadius: 12, padding: 5,
                boxShadow: '0 12px 32px -8px rgba(26,16,40,0.22), 0 2px 6px rgba(26,16,40,0.06)',
                maxHeight: '70dvh', overflowY: 'auto',
              }}
            >
              {eligiendo ? (
                <>
                  <p className="px-[9px] pt-1.5 pb-2 text-[11px] leading-snug" style={{ color: MUDO }}>
                    Nace vacío: no se copia nada del otro deporte, ni deportistas,
                    ni sedes, ni horarios.
                  </p>
                  {error && (
                    <p className="px-[9px] pb-2 text-[11.5px] leading-snug" style={{ color: '#DC2626' }}>{error}</p>
                  )}
                  {disponibles.length === 0 ? (
                    <p className="px-[9px] py-2 text-[12px]" style={{ color: MUDO }}>
                      Ya tienes todos los deportes de la lista.
                    </p>
                  ) : disponibles.map(nombre => (
                    <button
                      key={nombre}
                      type="button"
                      disabled={creando !== null}
                      onClick={() => crear(nombre)}
                      className="w-full flex items-center gap-[9px] px-[9px] py-2 rounded-[9px] text-left transition-colors hover:bg-[#F7F7FB] cursor-pointer disabled:opacity-50"
                    >
                      <Insignia nombre={nombre} tam={24} />
                      <span className="flex-1 text-[13px] font-semibold" style={{ letterSpacing: '-0.01em', color: '#1A1028' }}>
                        {nombre}
                      </span>
                      {creando === nombre && (
                        <span className="text-[11px]" style={{ color: MUDO }}>Creando…</span>
                      )}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '5px 3px' }} />
                  <button
                    type="button"
                    onClick={() => { setEligiendo(false); setError(null); }}
                    className="w-full text-left px-[9px] py-2 rounded-[9px] text-[12.5px] font-semibold transition-colors hover:bg-[#F7F7FB] cursor-pointer"
                    style={{ color: MUDO }}
                  >
                    Volver
                  </button>
                </>
              ) : (
                <>
                  {deportes.map(d => {
                    const c = cifrasDe(d.id);
                    const esActual = d.id === actual.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        role="option"
                        aria-selected={esActual}
                        onClick={() => { setAbierto(false); if (!esActual) onCambiar(d.id); }}
                        className="w-full flex items-center gap-[9px] px-[9px] py-2 rounded-[9px] text-left transition-colors hover:bg-[#F7F7FB] cursor-pointer"
                      >
                        <Insignia nombre={d.nombre} tam={24} />
                        <span className="flex flex-col flex-1 min-w-0">
                          <span className="text-[13px] font-semibold truncate" style={{ letterSpacing: '-0.01em', color: '#1A1028' }}>
                            {d.nombre}
                          </span>
                          {c && (
                            <span className="text-[11px]" style={{ color: MUDO }}>
                              {c.deportistas} {c.deportistas === 1 ? 'deportista' : 'deportistas'}
                              {' · '}
                              {c.sedes} {c.sedes === 1 ? 'sede' : 'sedes'}
                            </span>
                          )}
                        </span>
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          strokeWidth={2.6}
                          style={{ color: MORADO, opacity: esActual ? 1 : 0 }}
                        />
                      </button>
                    );
                  })}

                  {puedeCambiar && (
                    <>
                      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '5px 3px' }} />
                      <button
                        type="button"
                        onClick={() => setEligiendo(true)}
                        className="w-full flex items-center gap-[9px] px-[9px] py-2 rounded-[9px] text-left transition-colors hover:bg-[#F7F7FB] cursor-pointer"
                      >
                        <span className="w-6 h-6 shrink-0 flex items-center justify-center" style={{ color: MORADO }}>
                          <IconMas style={{ width: 13, height: 13 }} />
                        </span>
                        <span className="text-[12.5px] font-semibold" style={{ color: MORADO }}>Agregar deporte</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
