'use client';

import type { ReactNode } from 'react';

// Entrada unica para el contenido de todos los modulos. Antes cada uno tenia su
// propia version (o ninguna): unos subian 8px, otros bajaban 10, con duraciones
// de 200 a 400ms. Acá queda un solo comportamiento para toda la plataforma.
//
// El efecto es fade up escalonado: cada bloque directo del modulo aparece con
// opacidad 0 y 10px mas abajo, y sube a su posicion. Los bloques entran uno
// detras de otro con 60ms de diferencia, hasta el sexto; de ahi en adelante
// todos comparten el mismo retraso para que la ultima seccion no se sienta
// abandonada.
//
// Se resuelve con CSS y no con framer-motion a proposito: asi funciona con
// cualquier hijo sin obligarlo a ser un componente animado, y al usar
// animation-fill-mode: backwards no queda ninguna transformacion aplicada
// cuando termina, que es lo que rompe position: fixed y los z-index de los
// menus que viven dentro del contenido.

const DURACION_MS = 260;
const PASO_MS = 60;
const MAX_ESCALONES = 6;

const retrasos = Array.from({ length: MAX_ESCALONES }, (_, i) =>
  `.vcmr > *:nth-child(${i + 1}) { animation-delay: ${i * PASO_MS}ms }`
).join('\n');

export default function ModuleReveal({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .vcmr > * {
          animation: vcmr-up ${DURACION_MS}ms cubic-bezier(.23,1,.32,1) backwards;
          animation-delay: ${(MAX_ESCALONES - 1) * PASO_MS}ms;
        }
        ${retrasos}
        @keyframes vcmr-up {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: none }
        }
        @media (prefers-reduced-motion: reduce) {
          .vcmr > * { animation-name: vcmr-fade }
          @keyframes vcmr-fade {
            from { opacity: 0 }
            to   { opacity: 1 }
          }
        }
      `}</style>
      {/* `contents` hace que este div no genere caja, asi que los hijos se
          comportan como si colgaran directamente del contenedor del modulo.
          Es a proposito: sin el, un contenedor con grid o flex (Sedes,
          Calendario) meteria todas las tarjetas en una sola celda.

          ⚠️ Por eso el contenedor del modulo debe separar con `gap`, nunca con
          `space-y-*`. `gap` es propiedad del contenedor flex/grid y si alcanza
          a los hijos promovidos; `space-y-*` es el selector `> * + *`, que solo
          ve a este div y por tanto no aplica ninguna separacion. Cuatro modulos
          quedaron con las tarjetas pegadas por esto. */}
      <div className="vcmr contents">{children}</div>
    </>
  );
}
