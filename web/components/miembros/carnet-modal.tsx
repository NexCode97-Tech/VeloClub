'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSession } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client';
import { DatosCarnet } from '@/lib/carnet';
import { CarnetTarjetas, BotonesCarnet } from '@/components/miembros/carnet-tarjetas';
import { useEsCliente } from '@/hooks/use-cliente';

/**
 * El carnet de un miembro, en ventana sobre la lista.
 *
 * Va en portal porque el menú flotante de la lista lo taparía si viviera dentro
 * de la página. Las tarjetas y las descargas son las mismas de la pantalla del
 * deportista, en `carnet-tarjetas.tsx`.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface Props {
  memberId: string | null;
  onCerrar: () => void;
}

export function CarnetModal({ memberId, onCerrar }: Props) {
  const { session } = useSession();
  const reducedMotion = useReducedMotion();
  const [datos, setDatos] = useState<DatosCarnet | null>(null);
  const [error, setError] = useState('');
  const montado = useEsCliente();

  // Al cambiar de deportista se limpia lo que habia, durante el render y no en
  // un efecto. De paso arregla algo: al pasar de una ficha a otra se seguia
  // viendo el carnet del anterior hasta que llegaba el nuevo.
  const [idPrevio, setIdPrevio] = useState(memberId);
  if (idPrevio !== memberId) {
    setIdPrevio(memberId);
    setDatos(null);
    setError('');
  }

  useEffect(() => {
    if (!memberId) return;
    let vivo = true;
    (async () => {
      try {
        const token = await session?.getToken();
        const res = await apiFetch<{ carnet: DatosCarnet }>(`/members/${memberId}/carnet`, { token });
        if (vivo) setDatos(res.carnet);
      } catch {
        if (vivo) setError('No se pudo cargar el carnet.');
      }
    })();
    return () => { vivo = false; };
  }, [memberId, session]);

  useEffect(() => {
    if (!memberId) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [memberId, onCerrar]);

  if (!montado) return null;

  return createPortal(
    <AnimatePresence>
      {memberId && (
        <>
          <motion.div
            key="carnet-velo"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(15,10,30,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCerrar}
          />
          <motion.div key="carnet-caja" className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ pointerEvents: 'none' }}>
            <motion.div
              role="dialog"
              aria-label="Carnet digital"
              className="flex flex-col w-full overflow-hidden"
              style={{
                maxWidth: 700,
                borderRadius: 28,
                maxHeight: '90dvh',
                background: '#F2F1F7',
                boxShadow: '0 24px 64px rgba(56,29,160,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                pointerEvents: 'auto',
              }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -12 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white shrink-0"
                style={{ borderBottom: '1px solid rgba(120,80,200,0.10)' }}>
                <h2 className="m-0 text-[15px] font-semibold text-foreground">Carnet digital</h2>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(26,16,40,0.06)' }}
                >
                  <X className="w-4 h-4 text-[#5B5470]" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 flex-1">
                {error && (
                  <p className="text-[12.5px] m-0 mb-3 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(198,47,80,0.08)', color: '#C62F50' }}>
                    {error}
                  </p>
                )}
                {!datos && !error && (
                  <p className="text-[12.5px] text-muted-foreground m-0 py-10 text-center">Cargando el carnet…</p>
                )}
                {datos && <CarnetTarjetas datos={datos} />}
              </div>

              {datos && (
                <div className="px-5 py-4 bg-white shrink-0"
                  style={{ borderTop: '1px solid rgba(120,80,200,0.10)' }}>
                  <BotonesCarnet datos={datos} onError={setError} />
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
