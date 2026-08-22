'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

/**
 * El desplegable del proyecto.
 *
 * Reemplaza al `select` nativo, que se ve bien cerrado pero al abrirlo deja que
 * el navegador pinte su propia lista: fondo blanco, resaltado azul de sistema y
 * una fuente que no es la nuestra, justo en el momento en que más se mira.
 *
 * Va en portal a `document.body` con posición calculada desde el disparador, por
 * dos razones: dentro de la página lo recortaría cualquier contenedor con
 * `overflow`, y dentro de un modal quedaría atrapado en su apilamiento.
 *
 * En pantalla angosta no cuelga del campo sino que sube desde abajo: en el
 * celular una lista colgada queda tapada por el teclado o fuera del alcance del
 * pulgar.
 */

const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];
/** Por encima de los modales, que viven en 120 y 130. */
const CAPA = 200;
const ANGOSTO = 640;

export interface OpcionDesplegable {
  valor: string;
  texto: string;
  /** Aclaración al lado, para siglas que no se entienden solas: TI, RH, EPS. */
  nota?: string;
  /** Cuántos hay, cuando el desplegable filtra una lista. */
  n?: number;
}

interface Coordenadas {
  left: number; width: number; maxHeight: number;
  top?: number; bottom?: number;
}

export function Desplegable({
  valor, opciones, vacio, error, falta, deshabilitado, titulo, className, onElegir,
}: {
  valor: string;
  opciones: OpcionDesplegable[];
  /** Lo que dice cuando no hay nada elegido. */
  vacio: string;
  error?: boolean;
  /** Vacío en una ficha que se está completando. Se pinta en ámbar. */
  falta?: boolean;
  deshabilitado?: boolean;
  /** Encabezado de la hoja en el celular. Por defecto usa `vacio`. */
  titulo?: string;
  className?: string;
  onElegir: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [enHoja, setEnHoja] = useState(false);
  const [resaltada, setResaltada] = useState(-1);

  const disparador = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  const elegida = useMemo(() => opciones.find(o => o.valor === valor) ?? null, [opciones, valor]);

  const recalcular = useCallback(() => {
    const b = disparador.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const alto = window.visualViewport?.height ?? window.innerHeight;
    const ancho = window.innerWidth;

    if (ancho < ANGOSTO) { setEnHoja(true); return; }
    setEnHoja(false);

    const HUECO = 6;
    const abajo = alto - r.bottom;
    const arriba = r.top;
    // Se abre hacia arriba solo si abajo no cabe y arriba cabe más: de lo
    // contrario, un campo al final de la página abriría siempre hacia atrás.
    const haciaArriba = abajo < 220 && arriba > abajo;
    setCoords({
      left: Math.max(8, Math.min(r.left, ancho - r.width - 8)),
      width: r.width,
      maxHeight: Math.max(150, (haciaArriba ? arriba : abajo) - HUECO - 10),
      top: haciaArriba ? undefined : r.bottom + HUECO,
      bottom: haciaArriba ? alto - r.top + HUECO : undefined,
    });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    recalcular();
    const alMover = () => recalcular();
    // En captura, para enterarse también del scroll de un contenedor interno.
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
      if (disparador.current?.contains(t) || menu.current?.contains(t)) return;
      setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, [abierto]);

  // La hoja del celular bloquea el fondo. La lista colgada no: cerrarla al
  // hacer scroll sería peor que dejarla seguir al campo.
  useEffect(() => {
    if (!abierto || !enHoja) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previo; };
  }, [abierto, enHoja]);

  function abrir() {
    if (deshabilitado) return;
    setResaltada(opciones.findIndex(o => o.valor === valor));
    setAbierto(true);
  }

  function elegir(v: string) {
    onElegir(v);
    setAbierto(false);
    disparador.current?.focus();
  }

  function alTeclear(e: React.KeyboardEvent) {
    if (deshabilitado) return;

    if (!abierto) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); abrir(); }
      return;
    }

    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); disparador.current?.focus(); return; }
    if (e.key === 'Tab') { setAbierto(false); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (resaltada >= 0 && opciones[resaltada]) elegir(opciones[resaltada].valor);
      return;
    }

    const salto = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (salto !== 0) {
      e.preventDefault();
      setResaltada(i => {
        const n = opciones.length;
        if (n === 0) return -1;
        return (i + salto + n) % n;
      });
      return;
    }
    if (e.key === 'Home') { e.preventDefault(); setResaltada(0); }
    if (e.key === 'End') { e.preventDefault(); setResaltada(opciones.length - 1); }
  }

  // La opción resaltada con el teclado tiene que verse: si está fuera del
  // recorte, bajar con la flecha no movería nada en pantalla.
  useEffect(() => {
    if (!abierto || resaltada < 0) return;
    menu.current
      ?.querySelector<HTMLElement>(`[data-i="${resaltada}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [abierto, resaltada]);

  const borde = error
    ? '#EF476F'
    : abierto
      ? '#7C3AED'
      : falta
        ? '#D9A227'
        : 'rgba(120,80,200,0.16)';

  const lista = (
    <div role="listbox" id={`${idMenu}-lista`} aria-labelledby={idMenu} className="py-1">
      {opciones.length === 0 && (
        <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground m-0">No hay opciones.</p>
      )}
      {opciones.map((o, i) => {
        const puesta = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="option"
            aria-selected={puesta}
            data-i={i}
            onMouseEnter={() => setResaltada(i)}
            onClick={() => elegir(o.valor)}
            className={`w-full flex items-center gap-2 text-left px-3 transition-colors ${
              enHoja ? 'py-2.5 text-[13.5px]' : 'py-2 text-[13px]'
            } ${puesta ? 'font-bold' : ''}`}
            style={{
              color: puesta ? '#6D28D9' : '#1A1028',
              background: puesta
                ? 'rgba(124,58,237,0.08)'
                : resaltada === i ? 'rgba(124,58,237,0.05)' : 'transparent',
            }}
          >
            <span className="truncate">{o.texto}</span>
            {o.nota && (
              <span className="text-[11px] truncate" style={{ color: puesta ? 'rgba(109,40,217,0.7)' : '#8E87A8' }}>
                {o.nota}
              </span>
            )}
            {o.n !== undefined && (
              <span className="ml-auto text-[11px] font-semibold tabular-nums"
                style={{ color: puesta ? '#6D28D9' : '#8E87A8' }}>
                {o.n}
              </span>
            )}
            {puesta && <Check className={`w-3.5 h-3.5 shrink-0 ${o.n === undefined ? 'ml-auto' : ''}`} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={disparador}
        type="button"
        id={idMenu}
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-controls={`${idMenu}-lista`}
        disabled={deshabilitado}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-background text-[13px] text-left outline-none transition-colors disabled:opacity-60 ${className ?? ''}`}
        style={{
          borderColor: borde,
          background: falta && !error ? '#FDF7E8' : undefined,
          boxShadow: abierto ? '0 0 0 3px rgba(124,58,237,0.12)' : undefined,
          color: elegida ? '#1A1028' : '#8E87A8',
        }}
      >
        <span className="flex-1 truncate">{elegida?.texto ?? vacio}</span>
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{ color: abierto ? '#7C3AED' : '#8E87A8', transform: abierto ? 'rotate(180deg)' : undefined }}
        />
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
                ref={menu}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ duration: 0.26, ease: EASE }}
                className="fixed left-0 right-0 bottom-0 bg-white rounded-t-2xl border-t border-border flex flex-col"
                style={{ zIndex: CAPA + 1, maxHeight: '72dvh' }}
              >
                <div className="w-[34px] h-1 rounded-full bg-border mx-auto mt-2.5 mb-1 shrink-0" />
                <div className="px-4 pb-2 shrink-0">
                  <h3 className="text-[14px] font-semibold text-foreground m-0 tracking-tight">
                    {titulo ?? vacio}
                  </h3>
                </div>
                <div className="overflow-y-auto"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
                  {lista}
                </div>
              </motion.div>
            </>
          ) : coords ? (
            <motion.div
              key="menu"
              ref={menu}
              initial={{ opacity: 0, y: -4, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.985 }}
              transition={{ duration: 0.14, ease: EASE }}
              className="fixed bg-white rounded-xl border border-border overflow-y-auto"
              style={{
                zIndex: CAPA,
                left: coords.left,
                width: coords.width,
                top: coords.top,
                bottom: coords.bottom,
                maxHeight: coords.maxHeight,
                boxShadow: '0 12px 32px -10px rgba(26,16,40,0.28), 0 2px 6px rgba(26,16,40,0.06)',
              }}
            >
              {lista}
            </motion.div>
          ) : null)}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
