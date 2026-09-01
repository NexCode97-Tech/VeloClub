'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import AroCarga, { ARO_CSS } from '@/components/ui/aro-carga';

// Etapas reales del arranque — cada layout va avisando en cuál va, para que el
// texto diga lo que de verdad está pasando en vez de rotar mensajes al azar.
export type LoadStage = 'init' | 'data' | 'sync' | 'retry';

const STAGE_TEXT: Record<LoadStage, string> = {
  init:  'Alistando tu club',
  data:  'Cargando tus datos',
  sync:  'Ya casi está listo',
  retry: 'Reintentando, un momento',
};

// Secuencia fija que siempre se muestra completa al abrir la app, sin depender
// de qué tan rápido responda el servidor.
const SEQUENCE: LoadStage[] = ['init', 'data', 'sync'];

// Cuánto dura la secuencia de mensajes. La cortina NO cuenta acá: entra después
// de estos 4 segundos, así que la experiencia completa ronda los 5s.
// Esta es la única perilla para alargar o acortar la carga.
export const SEQUENCE_TOTAL_MS = 4000;

// Reparto del tiempo entre los mensajes de la secuencia
export const STAGE_DWELL_MS = Math.round(SEQUENCE_TOTAL_MS / SEQUENCE.length);

// La pantalla se sostiene hasta que la secuencia termina de reproducirse
export const MIN_VISIBLE_MS = SEQUENCE_TOTAL_MS;

// Espera lo que falte para que la secuencia alcance a mostrarse completa
export async function esperarPantallaCarga(mountedAt: number): Promise<void> {
  const falta = MIN_VISIBLE_MS - (Date.now() - mountedAt);
  if (falta > 0) await new Promise(r => setTimeout(r, falta));
}

// Duración total de la cortina de salida (120ms de arranque + 900ms de recorrido,
// con margen). El layout la usa para saber cuándo quitarla del árbol.
export const CURTAIN_MS = 1100;

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

// Medidas del aro en la apertura. El logo conserva el ancho que ya tenía; el
// diámetro sale de rodearlo sin apretarlo.
const ARO_D    = 200;
const ARO_GRUESO = 5;
const LOGO_W   = 130;

// El morado de marca, plano
const BRAND = '#381DA0';

// ── Pantalla de carga ───────────────────────────────────────────────────────
export default function LoadingScreen({ retrying = false }: { retrying?: boolean }) {
  const reducedMotion = useReducedMotion();

  // La secuencia se reproduce siempre completa, con su propio ritmo. No depende
  // de qué tan rápido responda el servidor: el layout espera a que termine.
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= SEQUENCE.length - 1) return;
    const t = setTimeout(() => setIdx(i => i + 1), STAGE_DWELL_MS);
    return () => clearTimeout(t);
  }, [idx]);

  // El aviso de servidor saturado se impone sobre la secuencia mientras dure
  const shown: LoadStage = retrying ? 'retry' : SEQUENCE[idx];

  return (
    <div
      className="vcls-root fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: BRAND }}
    >
      <style>{`
        ${ARO_CSS}
        .vcls-root { animation: vcls-fade .28s cubic-bezier(.23,1,.32,1) both; }
        @keyframes vcls-fade { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .vcls-root { animation: none } }
      `}</style>

      {/* Sin barra de progreso: el aro ya dice que algo está cargando, y las dos
          juntas repiten el mismo mensaje. */}
      <AroCarga diametro={ARO_D} grosor={ARO_GRUESO} logo={LOGO_W} tinta="#fff" />

      {/* Texto de etapa: el que sale se va hacia arriba, el que entra sube desde abajo */}
      <div style={{ position: 'relative', height: 20, width: 280, marginTop: 22 }}>
        <AnimatePresence initial={false}>
          <motion.p
            key={shown}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.2, ease: EASE_OUT }}
            className="absolute inset-0 m-0 flex items-center justify-center text-[13px]"
            style={{ color: 'rgba(255,255,255,.78)' }}
          >
            {STAGE_TEXT[shown]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Cortina de salida ───────────────────────────────────────────────────────
// Toma el relevo de la pantalla de carga (idéntica en el primer fotograma) y se
// corre hacia la derecha, dejando ver el contenido desde la izquierda.
export function LoadingCurtain() {
  return (
    <div
      className="vcls-curtain fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: BRAND, pointerEvents: 'none', willChange: 'transform' }}
      aria-hidden="true"
    >
      <style>{`
        ${ARO_CSS}
        .vcls-curtain {
          animation: vcls-slide .9s cubic-bezier(.32,.72,0,1) .12s both;
        }
        @keyframes vcls-slide {
          from { transform: translateX(0) }
          to   { transform: translateX(100%) }
        }
        /* El aro se apaga primero para que la cortina salga limpia */
        .vcls-curtain .vc-aro {
          animation: vcls-aro-out .24s ease-out both;
        }
        @keyframes vcls-aro-out { from { opacity: 1 } to { opacity: 0 } }

        @media (prefers-reduced-motion: reduce) {
          .vcls-curtain { animation: vcls-curtain-fade .3s ease-out both }
          @keyframes vcls-curtain-fade { from { opacity: 1 } to { opacity: 0 } }
        }
      `}</style>
      <AroCarga diametro={ARO_D} grosor={ARO_GRUESO} logo={LOGO_W} tinta="#fff" />
    </div>
  );
}
