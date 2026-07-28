'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Mismo barrido de luz de la pantalla de apertura, adaptado al interior de la
// app: más compacto, sobre fondo claro y sin mensajes de texto, porque acá la
// espera es corta y repetir el logo a pantalla completa se sentiría como si la
// aplicación se reiniciara en cada cambio de módulo.

// El logo respeta su relación real (1296x868)
const LOGO_W = 62;
const LOGO_H = 41;

/**
 * Sostiene el indicador de carga un mínimo de tiempo. Si el módulo responde al
 * instante, igual se ve ese mínimo y se evita el parpadeo; si tarda más, el
 * indicador dura lo que dure la carga real, sin espera artificial.
 */
export function useCargaMinima(loading: boolean, minMs = 400): boolean {
  const [visible, setVisible] = useState(loading);
  const inicioRef = useRef<number | null>(loading ? Date.now() : null);

  useEffect(() => {
    if (loading) {
      if (inicioRef.current === null) inicioRef.current = Date.now();
      setVisible(true);
      return;
    }
    if (inicioRef.current === null) { setVisible(false); return; }
    const falta = minMs - (Date.now() - inicioRef.current);
    if (falta <= 0) {
      inicioRef.current = null;
      setVisible(false);
      return;
    }
    const t = setTimeout(() => {
      inicioRef.current = null;
      setVisible(false);
    }, falta);
    return () => clearTimeout(t);
  }, [loading, minMs]);

  return visible;
}

export default function ModuleLoader({ minHeight = 220 }: { minHeight?: number }) {
  return (
    <div className="flex flex-col items-center justify-center w-full"
      style={{ minHeight }}>
      <style>{`
        .vcml { animation: vcml-in .22s cubic-bezier(.23,1,.32,1) both; }
        @keyframes vcml-in { from { opacity: 0 } to { opacity: 1 } }

        /* Barrido de luz: el logo se ve tenue y una franja con los colores de
           marca lo recorre. La franja se mueve con transform (compositor). */
        .vcml-logo { position: relative; }
        .vcml-logo img { filter: grayscale(1); opacity: .18; }
        .vcml-shine {
          position: absolute; inset: 0; overflow: hidden; pointer-events: none;
          -webkit-mask: url('/logo.png') center / contain no-repeat;
                  mask: url('/logo.png') center / contain no-repeat;
        }
        .vcml-band {
          position: absolute; top: 0; bottom: 0; left: -100%; width: 300%;
          background: linear-gradient(100deg,
            transparent 42%, #7C3AED 48%, #4361EE 52%, transparent 58%);
          animation: vcml-sweep 1.5s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes vcml-sweep {
          from { transform: translateX(-16%) }
          to   { transform: translateX(16%) }
        }

        .vcml-track {
          width: 96px; height: 2.5px; border-radius: 99px; overflow: hidden;
          background: rgba(124,58,237,.13); margin-top: 16px;
        }
        .vcml-fill {
          display: block; width: 100%; height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #7C3AED, #4361EE);
          animation: vcml-bar 1.3s cubic-bezier(.65,0,.35,1) infinite;
        }
        @keyframes vcml-bar {
          0%   { transform: translateX(-100%) scaleX(.6) }
          50%  { transform: translateX(0%)    scaleX(1)  }
          100% { transform: translateX(100%)  scaleX(.6) }
        }

        @media (prefers-reduced-motion: reduce) {
          .vcml { animation: none }
          .vcml-logo img { opacity: .45 }
          .vcml-shine { display: none }
          .vcml-fill { animation: none; opacity: .5 }
        }
      `}</style>

      <div className="vcml flex flex-col items-center" role="status" aria-label="Cargando">
        <div className="vcml-logo" style={{ width: LOGO_W, height: LOGO_H }}>
          <Image src="/logo.png" alt="" width={LOGO_W} height={LOGO_H} className="object-contain" />
          <span className="vcml-shine" aria-hidden="true">
            <span className="vcml-band" />
          </span>
        </div>
        <div className="vcml-track">
          <span className="vcml-fill" />
        </div>
      </div>
    </div>
  );
}
