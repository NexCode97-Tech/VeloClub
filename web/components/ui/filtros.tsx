'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconFiltros } from '@/components/ui/custom-icons';

/**
 * Los filtros de una pantalla, en un solo control.
 *
 * Antes cada filtro era un selector suelto en la barra. Con cuatro se comía la
 * fila entera y empujaba los botones de acción a un segundo renglón, y en el
 * celular no cabían.
 *
 * El reparto es: el panel sirve para elegir, y los chips de abajo para saber qué
 * hay puesto sin abrir nada. Por eso lo activo se ve siempre, aunque el panel
 * esté cerrado.
 *
 * Se aplica al tocar, sin botón de «aplicar»: la lista de atrás va cambiando y
 * el pie del panel dice cuántos quedan.
 */

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];
const CAPA = 150;
const ANGOSTO = 640;

export interface OpcionFiltro {
  valor: string;
  texto: string;
  /** Cuántos hay con esa opción. Es lo que hace útil el filtro antes de tocarlo. */
  n?: number;
}

export interface GrupoFiltro {
  id: string;
  titulo: string;
  valor: string;
  opciones: OpcionFiltro[];
  onElegir: (v: string) => void;
  /** El valor que significa «sin filtrar»: no cuenta ni sale como chip. */
  neutro: string;
  /** Botonera en vez de lista. Para grupos cortos como el orden. */
  segmentado?: boolean;
  /** Un grupo que ordena no filtra, así que no cuenta como filtro puesto. */
  noCuenta?: boolean;
  tono?: 'violeta' | 'azul' | 'gris';
}

const TONOS = {
  violeta: { fondo: 'rgba(56,29,160,0.09)', borde: 'rgba(56,29,160,0.24)', texto: '#6D28D9' },
  azul:    { fondo: 'rgba(67,97,238,0.09)',  borde: 'rgba(67,97,238,0.24)',  texto: '#2A52BE' },
  gris:    { fondo: 'rgba(142,135,168,0.12)', borde: 'rgba(142,135,168,0.28)', texto: '#5B5470' },
} as const;

/** El contador colgado de la esquina, para cuando el botón es solo ícono. */
function Globo({ n }: { n: number }) {
  return (
    <span
      className="absolute -top-1.5 -right-1.5 text-[10px] font-bold text-white rounded-full px-1 min-w-[16px] h-[16px] flex items-center justify-center"
      style={{ background: '#381DA0', border: '2px solid #fff' }}
    >
      {n}
    </span>
  );
}

/** Los grupos que están filtrando de verdad. */
function activos(grupos: GrupoFiltro[]): GrupoFiltro[] {
  return grupos.filter(g => !g.noCuenta && g.valor !== g.neutro);
}

function textoDe(g: GrupoFiltro): string {
  return g.opciones.find(o => o.valor === g.valor)?.texto ?? g.valor;
}

/**
 * El botón. Trae el número de filtros puestos, para que no haya que abrirlo
 * para saber si la lista está recortada.
 */
export function BotonFiltros({ grupos, resultados, alto = 42, soloIcono }: {
  grupos: GrupoFiltro[];
  /** Lo que dice el pie del panel: «14 de 41 miembros». */
  resultados: { mostrados: number; total: number; sustantivo: string };
  alto?: number;
  /**
   * Cuadrado y sin la palabra «Filtros». `'movil'` lo deja así solo en pantalla
   * angosta, donde el texto le quita ancho a la búsqueda; de tablet para arriba
   * vuelve con su etiqueta.
   */
  soloIcono?: boolean | 'movil';
}) {
  const [abierto, setAbierto] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const [enHoja, setEnHoja] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const puestos = activos(grupos).length;

  const recalcular = useCallback(() => {
    const b = boton.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const altoV = window.visualViewport?.height ?? window.innerHeight;
    const anchoV = window.innerWidth;

    if (anchoV < ANGOSTO) { setEnHoja(true); return; }
    setEnHoja(false);

    const ANCHO = 300;
    setCoords({
      // Se pega a la izquierda del botón, y si se sale por el borde derecho se
      // corre hacia adentro en vez de quedar cortado.
      left: Math.max(8, Math.min(r.left, anchoV - ANCHO - 8)),
      top: r.bottom + 6,
      maxHeight: Math.max(220, altoV - r.bottom - 22),
    });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    recalcular();
    const alMover = () => recalcular();
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alMover);
    window.visualViewport?.addEventListener('resize', alMover);
    return () => {
      window.removeEventListener('scroll', alMover, true);
      window.removeEventListener('resize', alMover);
      window.visualViewport?.removeEventListener('resize', alMover);
    };
  }, [abierto, recalcular]);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (boton.current?.contains(t) || panel.current?.contains(t)) return;
      setAbierto(false);
    }
    function escape(e: KeyboardEvent) { if (e.key === 'Escape') setAbierto(false); }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
      window.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !enHoja) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [abierto, enHoja]);

  function limpiar() {
    for (const g of grupos) if (!g.noCuenta && g.valor !== g.neutro) g.onElegir(g.neutro);
  }

  const contenido = (
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <h3 className="text-[14px] font-semibold text-foreground m-0 tracking-tight">Filtros</h3>
        {puestos > 0 && (
          <button onClick={limpiar} className="ml-auto text-[11.5px] font-bold text-[#A33A4E]">
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {grupos.map(g => (
          <div key={g.id} className="px-4 py-2.5 border-b border-border last:border-b-0">
            <h4 className="text-[10.5px] font-bold tracking-[0.07em] text-muted-foreground m-0 mb-1.5">
              {g.titulo}
            </h4>

            {g.segmentado ? (
              <div className="grid grid-cols-2 gap-1 p-[3px] rounded-[10px] bg-secondary/70">
                {g.opciones.map(o => {
                  const on = o.valor === g.valor;
                  return (
                    <button key={o.valor} type="button" onClick={() => g.onElegir(o.valor)}
                      className={`py-1.5 rounded-[7px] text-[12px] transition-all ${
                        on ? 'bg-white font-bold text-[#6D28D9] shadow-sm' : 'font-semibold text-muted-foreground'
                      }`}>
                      {o.texto}
                    </button>
                  );
                })}
              </div>
            ) : (
              g.opciones.map(o => {
                const on = o.valor === g.valor;
                return (
                  <button key={o.valor} type="button" onClick={() => g.onElegir(o.valor)}
                    className={`w-full flex items-center gap-2 text-left px-1.5 rounded-lg transition-colors ${
                      enHoja ? 'py-2.5 text-[13px]' : 'py-1.5 text-[12.5px]'
                    } ${on ? 'font-bold' : ''}`}
                    style={{
                      background: on ? 'rgba(56,29,160,0.07)' : 'transparent',
                      color: on ? '#6D28D9' : '#1A1028',
                    }}>
                    <span className="w-[14px] h-[14px] rounded-full shrink-0 grid place-items-center border-[1.5px]"
                      style={{ borderColor: on ? '#381DA0' : 'rgba(120,80,200,0.3)' }}>
                      {on && <span className="w-[7px] h-[7px] rounded-full" style={{ background: '#381DA0' }} />}
                    </span>
                    <span className="truncate">{o.texto}</span>
                    {o.n !== undefined && (
                      <span className="ml-auto text-[11px] font-semibold tabular-nums"
                        style={{ color: on ? '#6D28D9' : '#8E87A8' }}>
                        {o.n}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-label={soloIcono ? 'Filtros' : undefined}
        className={`relative flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold shrink-0 transition-colors ${
          soloIcono === true
            ? 'w-[42px] px-0'
            : soloIcono === 'movil'
              ? 'w-[42px] px-0 md:w-auto md:px-3'
              : 'px-3'
        }`}
        style={{
          height: alto,
          background: puestos > 0 ? 'rgba(56,29,160,0.08)' : '#fff',
          border: `1px solid ${puestos > 0 ? 'rgba(56,29,160,0.32)' : 'rgba(120,80,200,0.12)'}`,
          color: puestos > 0 ? '#6D28D9' : '#1A1028',
        }}
      >
        <IconFiltros className="w-4 h-4 shrink-0" style={{ color: puestos > 0 ? '#6D28D9' : '#8E87A8' }} />
        {soloIcono !== true && (
          <span className={soloIcono === 'movil' ? 'hidden md:inline' : undefined}>Filtros</span>
        )}

        {/* Sin la palabra al lado, el contador se sale del botón: es lo único
            que avisa que la lista está recortada. */}
        {puestos > 0 && (
          soloIcono === true ? (
            <Globo n={puestos} />
          ) : soloIcono === 'movil' ? (
            <>
              <span className="md:hidden"><Globo n={puestos} /></span>
              <span className="hidden md:flex text-[10.5px] font-bold text-white rounded-full px-1.5 min-w-[17px] h-[17px] items-center justify-center"
                style={{ background: '#381DA0' }}>
                {puestos}
              </span>
            </>
          ) : (
            <span className="text-[10.5px] font-bold text-white rounded-full px-1.5 min-w-[17px] h-[17px] flex items-center justify-center"
              style={{ background: '#381DA0' }}>
              {puestos}
            </span>
          )
        )}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {abierto && (enHoja ? (
            <>
              <motion.div
                key="fondo"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setAbierto(false)}
                className="fixed inset-0"
                style={{ background: 'rgba(15,10,30,0.4)', zIndex: CAPA }}
              />
              <motion.div
                key="hoja"
                ref={panel}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ duration: 0.26, ease: EASE }}
                className="fixed left-0 right-0 bottom-0 bg-white rounded-t-2xl border-t border-border flex flex-col"
                style={{ zIndex: CAPA + 1, maxHeight: '80dvh' }}
              >
                <div className="w-[34px] h-1 rounded-full bg-border mx-auto mt-2.5 mb-1 shrink-0" />
                {contenido}
                <div className="px-4 pt-3 border-t border-border bg-secondary/40 shrink-0"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
                  <button onClick={() => setAbierto(false)}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-[13.5px] font-bold">
                    Ver {resultados.mostrados === resultados.total
                      ? `los ${resultados.total}`
                      : `los ${resultados.mostrados}`}
                  </button>
                </div>
              </motion.div>
            </>
          ) : coords ? (
            <motion.div
              key="panel"
              ref={panel}
              initial={{ opacity: 0, y: -4, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.985 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="fixed bg-white rounded-2xl border border-border flex flex-col overflow-hidden"
              style={{
                zIndex: CAPA,
                left: coords.left,
                top: coords.top,
                width: 300,
                maxHeight: coords.maxHeight,
                boxShadow: '0 20px 44px -14px rgba(26,16,40,0.32), 0 2px 6px rgba(26,16,40,0.06)',
              }}
            >
              {contenido}
              <div className="px-4 py-2 border-t border-border bg-secondary/40 text-[12px] font-semibold text-center text-muted-foreground shrink-0">
                <b className="text-foreground tabular-nums">{resultados.mostrados}</b> de {resultados.total} {resultados.sustantivo}
              </div>
            </motion.div>
          ) : null)}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/**
 * Lo que está puesto, cada uno con su equis.
 *
 * Va debajo de la barra y no dentro del panel: si solo se viera al abrir, la
 * lista podría estar recortada sin que nada en pantalla lo diga.
 */
export function ChipsFiltros({ grupos }: { grupos: GrupoFiltro[] }) {
  const puestos = activos(grupos);
  if (puestos.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {puestos.map(g => {
        const t = TONOS[g.tono ?? 'violeta'];
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => g.onElegir(g.neutro)}
            aria-label={`Quitar el filtro ${g.titulo}: ${textoDe(g)}`}
            className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-2 py-1 text-[11.5px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: t.fondo, border: `1px solid ${t.borde}`, color: t.texto }}
          >
            {textoDe(g)}
            <X className="w-3 h-3 opacity-60" />
          </button>
        );
      })}
      {puestos.length > 1 && (
        <button
          type="button"
          onClick={() => puestos.forEach(g => g.onElegir(g.neutro))}
          className="text-[11.5px] font-bold text-muted-foreground underline underline-offset-2 ml-0.5"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
