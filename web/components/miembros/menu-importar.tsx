'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSpreadsheet, Link2 } from 'lucide-react';

/**
 * Las dos formas de traer una lista completa de deportistas.
 *
 * Van juntas detrás de «Importar» porque resuelven lo mismo: cargar a todo el
 * club de una. El club abre este menú buscando el Excel, que es lo que conoce, y
 * se encuentra con el formulario justo en el momento en que iba a usar el otro.
 *
 * En portal, para que el menú flotante de la app no se le monte encima.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Dónde se abrió, para colgar el menú del botón. */
  anclaje: { top: number; right: number } | null;
  onFormulario: () => void;
  onExcel: () => void;
}

export function MenuImportar({ abierto, onCerrar, anclaje, onFormulario, onExcel }: Props) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, onCerrar]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {abierto && anclaje && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 118 }} onClick={onCerrar} />
          <motion.div
            ref={caja}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bg-white rounded-2xl border border-border p-1.5"
            style={{
              zIndex: 119,
              top: anclaje.top,
              right: anclaje.right,
              width: 282,
              boxShadow: '0 10px 30px rgba(20,10,40,0.16)',
            }}
          >
            <p className="text-[9.5px] font-mono uppercase tracking-[0.11em] text-muted-foreground/70 px-2.5 pt-1.5 pb-1 m-0">
              Traer varios deportistas
            </p>

            <Opcion
              icono={<Link2 className="w-4 h-4" />}
              titulo="Con un formulario"
              detalle="Compartes un enlace y cada familia llena sus datos"
              onClick={() => { onCerrar(); onFormulario(); }}
            />
            <Opcion
              icono={<FileSpreadsheet className="w-4 h-4" />}
              titulo="Con la plantilla de Excel"
              detalle="Subes un archivo con la lista que ya tienes"
              onClick={() => { onCerrar(); onExcel(); }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Opcion({ icono, titulo, detalle, onClick }: {
  icono: React.ReactNode; titulo: string; detalle: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 items-start text-left px-2.5 py-2.5 rounded-xl hover:bg-secondary transition-colors"
    >
      <span className="text-primary shrink-0 mt-0.5">{icono}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-foreground">{titulo}</span>
        <span className="block text-[11px] text-muted-foreground leading-snug">{detalle}</span>
      </span>
    </button>
  );
}
