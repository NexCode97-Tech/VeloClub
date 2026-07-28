'use client';

// Estado de guardado para los botones con texto. En vez del anillo girando,
// que ya usamos en los botones de solo icono y compite visualmente con el
// texto, acá van tres puntos en onda: se ven tranquilos al lado de una
// palabra y no obligan a reservar un espacio cuadrado.
//
// El recorrido es Guardar, Guardando, Guardado. El tercer estado importa
// porque cierra el ciclo: sin el, el boton vuelve a su texto original y la
// persona queda sin saber si el cambio entro.

export type EstadoGuardado = 'idle' | 'guardando' | 'guardado';

const DURACION_ONDA_MS = 900;

export function PuntosOnda({ color = 'currentColor' }: { color?: string }) {
  return (
    <span className="vcpo" aria-hidden="true">
      <style>{`
        .vcpo { display: inline-flex; align-items: center; gap: 3px }
        .vcpo i {
          width: 4px; height: 4px; border-radius: 99px; display: block;
          background: ${color};
          animation: vcpo-onda ${DURACION_ONDA_MS}ms cubic-bezier(.4,0,.6,1) infinite;
        }
        .vcpo i:nth-child(2) { animation-delay: ${Math.round(DURACION_ONDA_MS / 6)}ms }
        .vcpo i:nth-child(3) { animation-delay: ${Math.round(DURACION_ONDA_MS / 3)}ms }
        @keyframes vcpo-onda {
          0%, 60%, 100% { transform: translateY(0);    opacity: .45 }
          30%           { transform: translateY(-3px); opacity: 1 }
        }
        @media (prefers-reduced-motion: reduce) {
          .vcpo i { animation: vcpo-latido ${DURACION_ONDA_MS}ms ease-in-out infinite }
          @keyframes vcpo-latido {
            0%, 60%, 100% { opacity: .45 }
            30%           { opacity: 1 }
          }
        }
      `}</style>
      <i /><i /><i />
    </span>
  );
}

/**
 * Contenido del boton segun el estado. `textoIdle` es lo que dice en reposo,
 * por ejemplo Guardar o Publicar, y de ahi salen los otros dos tiempos.
 */
export function ContenidoGuardado({
  estado, textoIdle, textoGuardando, textoGuardado, color,
}: {
  estado: EstadoGuardado;
  textoIdle: React.ReactNode;
  textoGuardando: string;
  textoGuardado: string;
  color?: string;
}) {
  if (estado === 'guardando') {
    return (
      <span className="flex items-center gap-2">
        {textoGuardando}
        <PuntosOnda color={color} />
      </span>
    );
  }
  if (estado === 'guardado') {
    return (
      <span className="flex items-center gap-1.5">
        <Palomita color={color} />
        {textoGuardado}
      </span>
    );
  }
  return <>{textoIdle}</>;
}

// La palomita se dibuja sola en vez de aparecer de golpe: el trazo confirma
// el guardado con el mismo gesto de escribir una marca a mano.
function Palomita({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <style>{`
        .vcpo-check {
          stroke-dasharray: 24; stroke-dashoffset: 24;
          animation: vcpo-trazo .32s cubic-bezier(.23,1,.32,1) forwards;
        }
        @keyframes vcpo-trazo { to { stroke-dashoffset: 0 } }
        @media (prefers-reduced-motion: reduce) {
          .vcpo-check { animation: none; stroke-dashoffset: 0 }
        }
      `}</style>
      <path className="vcpo-check" d="M20 6L9 17l-5-5"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Cuanto se queda visible el "Guardado" antes de volver a reposo o cerrar. */
export const MS_GUARDADO = 900;
