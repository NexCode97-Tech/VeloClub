'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Hoja que sube desde abajo en movil y se centra en escritorio.
 *
 * Existe para que no haya que volver a decidir esto en cada pantalla. Lo que
 * resuelve de una vez:
 *
 * 1. Va en portal a `document.body`. El dashboard vive dentro de un <main> con
 *    scroll propio, que abre su contexto de apilamiento: ahi dentro ningun
 *    z-index compite contra la barra flotante, que esta afuera. Subir el numero
 *    no sirve — el problema no es el valor, es el contexto. Ya nos paso cuatro
 *    veces antes de extraer esto.
 *
 * 2. El relleno de abajo SUMA el area segura en vez de usar `max()`. En iPhone
 *    el area segura no reemplaza al relleno de diseno: se le agrega. Con max()
 *    el boton queda pegado al borde y la barra de gestos se le monta encima.
 *
 * 3. Escape cierra y el fondo no se desplaza mientras esta abierta.
 */
export function HojaInferior({
  abierta, onCerrar, titulo, ayuda, children, pie, ancho = 'sm', zIndex = 70,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo?: string;
  ayuda?: string;
  children: React.ReactNode;
  /** Barra fija al pie, para el boton principal */
  pie?: React.ReactNode;
  ancho?: 'sm' | 'md';
  /** Solo si hay que quedar por encima de otra hoja ya abierta */
  zIndex?: number;
}) {
  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPresionar);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = previo;
    };
  }, [abierta, onCerrar]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onCerrar}
          className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{ background: 'rgba(20,12,36,0.55)', zIndex }}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            onClick={e => e.stopPropagation()}
            className={`bg-white w-full rounded-t-2xl sm:rounded-2xl flex flex-col ${
              ancho === 'md' ? 'sm:max-w-md' : 'sm:max-w-sm'}`}
            style={{ maxHeight: '90dvh' }}
          >
            {titulo && (
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border/60">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">{titulo}</p>
                  {ayuda && <p className="text-[11px] text-muted-foreground mt-0.5">{ayuda}</p>}
                </div>
                <button
                  type="button"
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div
              className="px-5 py-4 overflow-y-auto"
              // Sin pie, el relleno de abajo lo lleva el contenido
              style={pie ? undefined : { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
            >
              {children}
            </div>

            {pie && (
              <div
                className="px-5 pt-3 border-t border-border/60 shrink-0"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
              >
                {pie}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Fila de opción única, el patrón que repiten todas las hojas de selección. */
export function OpcionHoja({ activa, onClick, children, extra }: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Contador o etiqueta a la derecha */
  extra?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors"
      style={activa
        ? { background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.35)' }
        : { background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}
    >
      <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
        style={{ border: `1.5px solid ${activa ? '#7C3AED' : 'rgba(26,16,40,0.20)'}` }}>
        {activa && <span className="w-2 h-2 rounded-full" style={{ background: '#7C3AED' }} />}
      </span>
      <span className="flex-1 min-w-0 text-[12.5px] font-medium text-foreground truncate">{children}</span>
      {extra && <span className="text-[9.5px] shrink-0" style={{ color: '#8E87A8', fontVariantNumeric: 'tabular-nums' }}>{extra}</span>}
    </button>
  );
}
