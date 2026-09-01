'use client';

import { useEffect, useRef, useState } from 'react';
import AroCarga, { ARO_CSS } from '@/components/ui/aro-carga';

// El mismo aro de la pantalla de apertura, adaptado al interior de la app: más
// compacto, sobre fondo claro y sin mensajes de texto, porque acá la espera es
// corta y repetir el logo a pantalla completa se sentiría como si la
// aplicación se reiniciara en cada cambio de módulo.
//
// La animación es la misma a propósito, y no una más elaborada: este indicador
// se ve decenas de veces al día, mientras que la apertura se ve una vez por
// sesión. Lo que en la apertura sería un momento, acá cansaría.

// El 48 % de la apertura: el mismo dibujo a menos de la mitad.
const ARO_D  = 96;
const LOGO_W = 46;

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

// Alto del aro, para centrarlo sobre el punto fijo de cada dispositivo
const ALTO_CONTENIDO = ARO_D;

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
        ${ARO_CSS}
        .vcml { animation: vcml-in .22s cubic-bezier(.23,1,.32,1) both; }
        @keyframes vcml-in { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .vcml { animation: none } }
      `}</style>

      <div className="vcml flex flex-col items-center">
        {/* El logo va en el morado de marca, plano: sobre el fondo claro su
            degradado original y la «C» negra desentonaban con el aro. */}
        <AroCarga diametro={ARO_D} logo={LOGO_W} tinta="#381DA0" />
      </div>
    </div>
  );
}
