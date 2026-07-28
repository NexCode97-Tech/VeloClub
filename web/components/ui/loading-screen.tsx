'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Etapas reales del arranque — cada layout va avisando en cuál va, para que el
// texto diga lo que de verdad está pasando en vez de rotar mensajes al azar.
export type LoadStage = 'init' | 'auth' | 'data' | 'sync' | 'retry';

const STAGE_TEXT: Record<LoadStage, string> = {
  init:  'Alistando tu club',
  auth:  'Verificando acceso',
  data:  'Cargando tus datos',
  sync:  'Sincronizando tu información',
  retry: 'Reintentando, un momento',
};

// Con buena conexión las etapas se suceden en pocos milisegundos: sin un mínimo
// por mensaje el texto parpadearía. Cada uno se sostiene al menos este tiempo.
const MIN_STAGE_MS = 700;

// No mostrar la pantalla de inmediato: si la carga es rápida, el usuario no ve
// nada y la app se siente instantánea, en vez de un destello molesto.
export const APPEAR_DELAY_MS = 250;

// Si la pantalla ya se mostró, se sostiene al menos este tiempo antes de dar
// paso a la cortina. Enseñarla y quitarla en un parpadeo se percibe como un
// error, peor que no haberla mostrado.
export const MIN_VISIBLE_MS = 900;

// Espera lo que falte para cumplir el tiempo mínimo en pantalla. Si nunca llegó
// a aparecer (carga muy rápida), no espera nada.
export async function esperarPantallaCarga(mountedAt: number): Promise<void> {
  const visibleMs = Date.now() - mountedAt - APPEAR_DELAY_MS;
  if (visibleMs < 0) return;
  const falta = MIN_VISIBLE_MS - visibleMs;
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
export default function LoadingScreen({ stage = 'init' }: { stage?: LoadStage }) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  // La etapa que se está mostrando, que puede ir por detrás de la real mientras
  // se cumple el tiempo mínimo del mensaje anterior.
  const [shown, setShown] = useState<LoadStage>(stage);
  const lastChangeRef = useRef<number>(Date.now());
  // La etapa real más reciente, para leerla dentro del temporizador de aparición
  const stageRef = useRef<LoadStage>(stage);
  stageRef.current = stage;

  // Al hacerse visible, mostrar la etapa real de ese momento y arrancar ahí el
  // conteo del mínimo. Antes el conteo empezaba al montar, así que el primer
  // mensaje perdía los 250ms de espera y aparecía apenas un instante.
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      setShown(stageRef.current);
      lastChangeRef.current = Date.now();
    }, APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || stage === shown) return;
    const restante = Math.max(0, MIN_STAGE_MS - (Date.now() - lastChangeRef.current));
    const t = setTimeout(() => {
      setShown(stage);
      lastChangeRef.current = Date.now();
    }, restante);
    return () => clearTimeout(t);
  }, [stage, shown, visible]);

  if (!visible) return null;

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
