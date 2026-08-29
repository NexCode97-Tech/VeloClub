'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { iconoDeDeporte, IconUbicacion, IconUsers } from '@/components/ui/custom-icons';

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
  /** Solo el dueño del club cruza entre deportes. */
  puedeCambiar: boolean;
  /** El club ofrece más de uno. Decide si al resto del equipo se le muestra dónde está. */
  varios: boolean;
  colapsado: boolean;
  onCambiar: (id: string) => void;
  /** Trae los conteos. Se llama al abrir, no en cada carga del panel. */
  cargarCifras: () => Promise<CarpetaConCifras[]>;
  onAgregar: (nombre: string) => Promise<void>;
}

/**
 * La insignia del deporte.
 *
 * Con ícono propio cuando lo hay y, si no, con la inicial del nombre. La
 * inicial no es un parche: un club abre la carpeta que quiera y le pone el
 * nombre que quiera, así que un ícono genérico para todos los deportes sin arte
 * dejaría tres carpetas con el mismo dibujo — que es justo lo contrario de para
 * lo que está el ícono. La letra al menos distingue, y se ve como lo que es:
 * un lugar esperando su dibujo.
 */
function Insignia({ nombre, tam = 26 }: { nombre: string; tam?: number }) {
  const Icono = iconoDeDeporte(nombre);
  const glifo = Math.round(tam * 0.58);
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{
        width: tam, height: tam, borderRadius: Math.round(tam * 0.31),
        background: 'rgba(56,29,160,0.08)', color: '#381DA0',
      }}
    >
      {Icono
        ? <Icono style={{ width: glifo, height: glifo }} />
        : <span
            className="font-semibold leading-none"
            style={{ fontSize: Math.round(tam * 0.46) }}
          >
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
 * A quien no puede cambiar no se le esconde: se le deja como rótulo, sin
 * flecha y sin abrir. Un entrenador que no sabe en qué deporte está es un
 * entrenador que marca asistencia en el lugar equivocado. Eso sí, solo aparece
 * si el club tiene más de uno — en un club de un solo deporte sería un letrero
 * que no informa nada.
 */
export default function SelectorDeporte({
  deportes, activo, puedeCambiar, varios, colapsado, onCambiar, cargarCifras, onAgregar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cifras, setCifras] = useState<CarpetaConCifras[] | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number } | null>(null);
  const botonRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!botonRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    const conEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    // En captura: el menú vive en un portal, así que un clic dentro de él no
    // pasa por el botón y cerraría el menú justo al elegir.
    document.addEventListener('keydown', conEsc);
    const t = setTimeout(() => document.addEventListener('mousedown', cerrar), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', conEsc);
    };
  }, [abierto]);

  // El menú se dibuja en un portal para que no lo recorte el sidebar, que tiene
  // scroll propio. Al vivir fuera, su posición hay que calcularla.
  useEffect(() => {
    if (!abierto) { setCaja(null); return; }
    const medir = () => {
      const r = botonRef.current?.getBoundingClientRect();
      if (r) setCaja({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 244) });
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
  if (!puedeCambiar && !varios) return null;

  const cifrasDe = (id: string) => cifras?.find(c => c.id === id) ?? null;

  async function crear() {
    const nombre = nombreNuevo.trim();
    if (nombre.length < 2) { setError('Escribe el nombre del deporte'); return; }
    setGuardando(true);
    setError(null);
    try {
      await onAgregar(nombre);
      setNombreNuevo('');
      setAgregando(false);
      setAbierto(false);
      setCifras(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setGuardando(false);
    }
  }

  const cuerpo = (
    <div
      className="flex items-center gap-2.5 w-full"
      style={{ minWidth: 0 }}
    >
      <Insignia nombre={actual.nombre} />
      {!colapsado && (
        <>
          <span className="flex flex-col min-w-0 text-left">
            <span className="text-[9.5px] font-semibold tracking-[0.07em] text-[#8E87A8] leading-none mb-[3px]">
              DEPORTE
            </span>
            <span className="text-[13px] font-semibold text-[#1A1028] truncate leading-none">
              {actual.nombre}
            </span>
          </span>
          {puedeCambiar && (
            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 ml-auto text-[#8E87A8]" />
          )}
        </>
      )}
    </div>
  );

  return (
    <div
      className="shrink-0"
      style={{ padding: colapsado ? '8px 8px' : '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div ref={botonRef}>
        {puedeCambiar ? (
          <button
            type="button"
            onClick={() => setAbierto(v => !v)}
            aria-haspopup="listbox"
            aria-expanded={abierto}
            title={colapsado ? actual.nombre : undefined}
            className="w-full flex items-center rounded-[10px] transition-colors hover:bg-[rgba(56,29,160,0.05)] cursor-pointer"
            style={{ padding: colapsado ? 4 : '7px 8px', border: '1px solid rgba(120,80,200,0.14)' }}
          >
            {cuerpo}
          </button>
        ) : (
          // Rótulo, no control: borde punteado para que se lea como «estás
          // aquí» y no como algo que se puede tocar.
          <div
            title={colapsado ? actual.nombre : undefined}
            className="w-full flex items-center rounded-[10px]"
            style={{ padding: colapsado ? 4 : '7px 8px', border: '1px dashed rgba(120,80,200,0.28)' }}
          >
            {cuerpo}
          </div>
        )}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && caja && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
              role="listbox"
              className="fixed z-[80] rounded-[14px] overflow-hidden"
              style={{
                top: caja.top, left: caja.left, width: caja.width,
                background: '#fff',
                border: '1px solid rgba(120,80,200,0.14)',
                boxShadow: '0 12px 32px -8px rgba(26,16,40,0.18), 0 2px 6px rgba(26,16,40,0.06)',
              }}
            >
              <div className="py-1.5">
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
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(56,29,160,0.05)] cursor-pointer"
                    >
                      <Insignia nombre={d.nombre} tam={24} />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-[#1A1028] truncate leading-tight">
                          {d.nombre}
                        </span>
                        {c && (
                          <span className="flex items-center gap-2.5 mt-[3px] text-[11px] text-[#8E87A8] leading-none">
                            <span className="inline-flex items-center gap-1">
                              <IconUsers className="w-3 h-3" />
                              {c.deportistas}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <IconUbicacion className="w-3 h-3" />
                              {c.sedes}
                            </span>
                          </span>
                        )}
                      </span>
                      {esActual && <Check className="w-3.5 h-3.5 shrink-0 text-[#381DA0]" strokeWidth={2.6} />}
                    </button>
                  );
                })}
              </div>

              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {agregando ? (
                  <div className="p-3 flex flex-col gap-2">
                    <input
                      autoFocus
                      value={nombreNuevo}
                      onChange={e => { setNombreNuevo(e.target.value); setError(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') crear(); }}
                      placeholder="Natación, fútbol, atletismo…"
                      maxLength={40}
                      className="w-full text-[13px] rounded-[9px] px-2.5 py-2 outline-none focus:border-[#381DA0]"
                      style={{ border: '1px solid rgba(120,80,200,0.18)', color: '#1A1028' }}
                    />
                    <p className="text-[11px] text-[#8E87A8] leading-snug">
                      Nace vacío. No se copia nada del otro deporte: ni deportistas,
                      ni sedes, ni horarios.
                    </p>
                    {error && <p className="text-[11.5px] text-[#DC2626] leading-snug">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={crear}
                        disabled={guardando}
                        className="flex-1 text-[12.5px] font-semibold text-white rounded-full py-2 transition-all disabled:opacity-60 cursor-pointer"
                        style={{ background: '#381DA0' }}
                      >
                        {guardando ? 'Creando…' : 'Crear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAgregando(false); setError(null); setNombreNuevo(''); }}
                        className="text-[12.5px] font-semibold text-[#8E87A8] rounded-full px-3.5 py-2 transition-colors hover:bg-[rgba(26,16,40,0.05)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAgregando(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-semibold text-[#381DA0] transition-colors hover:bg-[rgba(56,29,160,0.05)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
                    Agregar deporte
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
