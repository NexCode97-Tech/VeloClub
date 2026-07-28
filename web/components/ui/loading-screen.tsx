'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

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

// Cuánto se sostiene cada mensaje. Es la única perilla para alargar o acortar
// toda la experiencia de carga: 3 mensajes × este valor + la cortina (~1s).
// En 950ms el total ronda los 4 segundos.
export const STAGE_DWELL_MS = 950;

// La pantalla se sostiene hasta que la secuencia termina de reproducirse
export const MIN_VISIBLE_MS = STAGE_DWELL_MS * SEQUENCE.length;

// Espera lo que falte para que la secuencia alcance a mostrarse completa
export async function esperarPantallaCarga(mountedAt: number): Promise<void> {
  const falta = MIN_VISIBLE_MS - (Date.now() - mountedAt);
  if (falta > 0) await new Promise(r => setTimeout(r, falta));
}

// Duración total de la cortina de salida (120ms de arranque + 900ms de recorrido,
// con margen). El layout la usa para saber cuándo quitarla del árbol.
export const CURTAIN_MS = 1100;

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

// Dimensiones del logo respetando su relación real (1296x868)
const LOGO_W = 130;
const LOGO_H = 87;

// Degradado de marca, el mismo del onboarding
const BRAND = 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)';

// Estilos compartidos por la pantalla de carga y la cortina de salida, para que
// el relevo entre una y otra sea visualmente idéntico.
const SHARED_CSS = `
  .vcls-logo { position: relative; }
  /* El logo es morado y negro: en fondo de marca se pasa a blanco puro */
  .vcls-logo img { filter: brightness(0) invert(1); opacity: .45; }
  .vcls-shine {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none;
    -webkit-mask: url('/logo.png') center / contain no-repeat;
            mask: url('/logo.png') center / contain no-repeat;
  }
  .vcls-band {
    position: absolute; top: 0; bottom: 0; left: -100%; width: 300%;
    background: linear-gradient(100deg,
      transparent 42%, #fff 48%, #fff 52%, transparent 58%);
    animation: vcls-sweep 1.9s cubic-bezier(.4,0,.2,1) infinite;
  }
  @keyframes vcls-sweep {
    from { transform: translateX(-16%) }
    to   { transform: translateX(16%) }
  }
`;

function BrandLogo({ shimmer }: { shimmer: boolean }) {
  return (
    <div className="vcls-logo" style={{ width: LOGO_W, height: LOGO_H }}>
      <Image src="/logo.png" alt="VeloClub" width={LOGO_W} height={LOGO_H} priority className="object-contain" />
      {shimmer && (
        <span className="vcls-shine" aria-hidden="true">
          <span className="vcls-band" />
        </span>
      )}
    </div>
  );
}

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
        ${SHARED_CSS}
        .vcls-root { animation: vcls-fade .28s cubic-bezier(.23,1,.32,1) both; }
        @keyframes vcls-fade { from { opacity: 0 } to { opacity: 1 } }

        .vcls-track {
          width: 140px; height: 3px; border-radius: 99px; overflow: hidden;
          background: rgba(255,255,255,.22);
        }
        .vcls-fill {
          display: block; width: 100%; height: 100%; border-radius: 99px; background: #fff;
          animation: vcls-bar 1.4s cubic-bezier(.65,0,.35,1) infinite;
        }
        @keyframes vcls-bar {
          0%   { transform: translateX(-100%) scaleX(.6) }
          50%  { transform: translateX(0%)    scaleX(1)  }
          100% { transform: translateX(100%)  scaleX(.6) }
        }

        /* Con "reducir movimiento" activo: logo íntegro y sin barridos */
        @media (prefers-reduced-motion: reduce) {
          .vcls-root { animation: none }
          .vcls-logo img { opacity: 1 }
          .vcls-shine { display: none }
          .vcls-fill { animation: none; opacity: .6 }
        }
      `}</style>

      <BrandLogo shimmer />

      <div className="vcls-track" style={{ marginTop: 26 }}>
        <span className="vcls-fill" />
      </div>

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
        ${SHARED_CSS}
        .vcls-curtain {
          animation: vcls-slide .9s cubic-bezier(.32,.72,0,1) .12s both;
        }
        @keyframes vcls-slide {
          from { transform: translateX(0) }
          to   { transform: translateX(100%) }
        }
        /* El logo se apaga primero para que la cortina salga limpia */
        .vcls-curtain .vcls-logo {
          animation: vcls-logo-out .24s ease-out both;
        }
        @keyframes vcls-logo-out { from { opacity: 1 } to { opacity: 0 } }

        @media (prefers-reduced-motion: reduce) {
          .vcls-curtain { animation: vcls-curtain-fade .3s ease-out both }
          @keyframes vcls-curtain-fade { from { opacity: 1 } to { opacity: 0 } }
        }
      `}</style>
      <BrandLogo shimmer={false} />
    </div>
  );
}
