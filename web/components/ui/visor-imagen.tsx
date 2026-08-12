'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';

const ESCALA_MIN = 1;
const ESCALA_MAX = 5;
// Lo que amplia un doble toque. Mas de esto marea y menos no se siente.
const ESCALA_DOBLE = 2.5;
// Cuanto hay que arrastrar hacia abajo, sin zoom, para que se cierre.
const CIERRE_ARRASTRE = 110;

function acotar(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/**
 * Visor de una imagen a pantalla completa, con zoom.
 *
 * Va en portal a document.body: dentro de la pagina queda atrapado en el
 * contexto de apilamiento de <main> y el menu flotante se le monta encima por
 * mas z-index que se le ponga.
 */
export function VisorImagen({ url, alt, abierto, onCerrar }: {
  url: string;
  alt: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [escala, setEscala]   = useState(1);
  const [pos, setPos]         = useState({ x: 0, y: 0 });
  const contenedor            = useRef<HTMLDivElement>(null);

  // Punteros activos, para distinguir arrastrar de pellizcar. Van en ref y no
  // en estado: cambian en cada movimiento del dedo y redibujar en cada uno
  // haria el gesto a tirones.
  const punteros   = useRef(new Map<number, { x: number; y: number }>());
  const inicioPin  = useRef<{ dist: number; escala: number } | null>(null);
  const inicioPan  = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const arrastreY  = useRef(0);

  const reiniciar = useCallback(() => {
    setEscala(1);
    setPos({ x: 0, y: 0 });
    punteros.current.clear();
    inicioPin.current = null;
    inicioPan.current = null;
    arrastreY.current = 0;
  }, []);

  // Cada vez que se abre arranca sin zoom: reabrirla y encontrarla ampliada
  // donde la dejaste la vez pasada se siente roto.
  useEffect(() => { if (abierto) reiniciar(); }, [abierto, reiniciar]);

  // Escape cierra, y el fondo de la pagina no se desplaza mientras esta abierto
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onCerrar]);

  // Al volver a 1 la imagen se recentra sola: dejarla corrida sin zoom deja un
  // hueco negro de un lado y no hay forma de traerla de vuelta.
  function aplicarEscala(nueva: number, centrar = false) {
    const acotada = acotar(nueva, ESCALA_MIN, ESCALA_MAX);
    setEscala(acotada);
    if (acotada === 1 || centrar) setPos({ x: 0, y: 0 });
  }

  function alRodar(e: React.WheelEvent) {
    e.preventDefault();
    aplicarEscala(escala - e.deltaY * 0.0022 * escala);
  }

  function alDobleClic() {
    aplicarEscala(escala > 1 ? 1 : ESCALA_DOBLE, true);
  }

  function alBajarPuntero(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      inicioPin.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), escala };
      inicioPan.current = null;
    } else if (punteros.current.size === 1) {
      inicioPan.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      arrastreY.current = 0;
    }
  }

  function alMoverPuntero(e: React.PointerEvent) {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pellizcar
    if (punteros.current.size === 2 && inicioPin.current) {
      const [a, b] = [...punteros.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      aplicarEscala(inicioPin.current.escala * (dist / inicioPin.current.dist));
      return;
    }

    if (punteros.current.size !== 1 || !inicioPan.current) return;
    const dx = e.clientX - inicioPan.current.x;
    const dy = e.clientY - inicioPan.current.y;

    if (escala > 1) {
      // Con zoom, el dedo mueve la imagen
      setPos({ x: inicioPan.current.px + dx, y: inicioPan.current.py + dy });
    } else {
      // Sin zoom, arrastrar hacia abajo cierra. Solo hacia abajo: hacia arriba
      // el gesto choca con el desplazamiento natural de la pagina.
      arrastreY.current = Math.max(0, dy);
      setPos({ x: 0, y: arrastreY.current });
    }
  }

  function alSoltarPuntero(e: React.PointerEvent) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) inicioPin.current = null;
    if (punteros.current.size === 0) {
      inicioPan.current = null;
      if (escala === 1) {
        if (arrastreY.current > CIERRE_ARRASTRE) onCerrar();
        else setPos({ x: 0, y: 0 });
        arrastreY.current = 0;
      }
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierto && (
        <motion.div
          key="visor"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(8,5,16,0.94)', zIndex: 90 }}
          onClick={() => { if (escala === 1) onCerrar(); }}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onCerrar(); }}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(255,255,255,0.14)',
              color: '#fff',
              zIndex: 2,
              top: 'max(1rem, env(safe-area-inset-top))',
            }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Solo mientras no hay zoom: una vez ampliada, ya se entendio */}
          {escala === 1 && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full pointer-events-none"
              style={{
                bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
                background: 'rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.75)',
                zIndex: 2,
              }}>
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Pellizcá o tocá dos veces para acercar</span>
            </div>
          )}

          <div
            ref={contenedor}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onClick={e => e.stopPropagation()}
            onWheel={alRodar}
            onDoubleClick={alDobleClic}
            onPointerDown={alBajarPuntero}
            onPointerMove={alMoverPuntero}
            onPointerUp={alSoltarPuntero}
            onPointerCancel={alSoltarPuntero}
            // El navegador no debe robarse el gesto para desplazar la pagina
            style={{ touchAction: 'none' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              draggable={false}
              className="max-w-full max-h-full select-none"
              style={{
                objectFit: 'contain',
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${escala})`,
                // Sin transicion mientras el dedo esta encima: el gesto tiene
                // que ir pegado al dedo, no llegar tarde.
                transition: punteros.current.size ? 'none' : 'transform 0.18s ease-out',
                cursor: escala > 1 ? 'grab' : 'zoom-in',
                opacity: escala === 1 ? 1 - Math.min(pos.y / 320, 0.6) : 1,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
