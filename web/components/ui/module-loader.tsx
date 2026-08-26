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
  // Arranca visible siempre, aunque los datos ya estén en caché: al cambiar de
  // módulo el indicador debe aparecer igual, si no la transición se siente
  // brusca unas veces sí y otras no.
  const [visible, setVisible] = useState(true);
  const inicioRef = useRef(Date.now());

  useEffect(() => {
    // Mientras siga cargando de verdad, el indicador se mantiene
    if (loading) return;
    const falta = minMs - (Date.now() - inicioRef.current);
    if (falta <= 0) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(false), falta);
    return () => clearTimeout(t);
  }, [loading, minMs]);

  return visible;
}

/**
 * Indicador de carga de módulo. Por defecto ocupa el alto disponible de la
 * pantalla para quedar centrado de verdad; los casos donde vive dentro de una
 * tarjeta pasan un `minHeight` fijo y pequeño.
 */
// Altura a la que queremos el logo, medida desde el borde superior de la
// pantalla. La línea que separa el título del módulo está a unos 58px, así que
// esto lo deja bien debajo de ella y siempre a la vista, sin necesidad de
// desplazarse. Es un punto fijo: no depende del contenido de cada módulo.
// Se ajusta por dispositivo porque en móvil hay bastante menos alto disponible
// (y encima le quita espacio la barra de navegación inferior).
const Y_LOGO_MOVIL      = 400;
const Y_LOGO_TABLET     = 320;
const Y_LOGO_ESCRITORIO = 320;

function yLogo(ancho: number): number {
  if (ancho < 768)  return Y_LOGO_MOVIL;
  if (ancho < 1024) return Y_LOGO_TABLET;
  return Y_LOGO_ESCRITORIO;
}

// Alto aproximado del conjunto logo + barra, para centrarlo sobre ese punto
const ALTO_CONTENIDO = 62;

export default function ModuleLoader({ minHeight }: { minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [padTop, setPadTop] = useState<number>(0);

  // Mide dónde arranca el cargador dentro de la pantalla y compensa con espacio
  // arriba, para que el logo caiga siempre en el mismo punto en todos los
  // módulos, sin importar cuánto contenido tengan encima.
  useEffect(() => {
    if (minHeight !== undefined) return;
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      // El borde superior del elemento no se mueve al aplicarle espacio interno,
      // así que esta medida es estable y se puede recalcular sin acumular error.
      const top = el.getBoundingClientRect().top;
      setPadTop(Math.max(0, yLogo(window.innerWidth) - top - ALTO_CONTENIDO / 2));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [minHeight]);

  return (
    <div ref={ref} className="flex flex-col items-center w-full"
      style={
        minHeight !== undefined
          ? { minHeight, justifyContent: 'center' }
          : { paddingTop: padTop, paddingBottom: 40, minHeight: Y_LOGO_MOVIL }
      }>
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
          background: #381DA0;
          animation: vcml-sweep 1.5s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes vcml-sweep {
          from { transform: translateX(-16%) }
          to   { transform: translateX(16%) }
        }

        .vcml-track {
          width: 96px; height: 2.5px; border-radius: 99px; overflow: hidden;
          background: rgba(56,29,160,.13); margin-top: 16px;
        }
        .vcml-fill {
          display: block; width: 100%; height: 100%; border-radius: 99px;
          background: #381DA0;
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
