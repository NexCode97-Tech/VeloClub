'use client';

/**
 * El globo que sale al pasar por una gráfica.
 *
 * Existe para que no vuelva a haber dos estilos. El de la tarjeta de recaudo
 * del panel es negro, de una sola línea y con puntita abajo; el de la gráfica
 * de Uso salía blanco, en tres renglones y repitiendo el nombre de la serie,
 * porque era el de fábrica de recharts. Dos globos distintos en dos gráficas
 * que por lo demás se ven iguales.
 *
 * El contenido lo pone quien lo usa: acá vive la caja, no el texto. Finanzas
 * arma el suyo a mano con la misma pinta; el de Uso pasa por este componente.
 */

import { ReactNode } from 'react';

interface PuntoDeGrafica {
  value?: number | string;
  payload?: Record<string, unknown>;
}

interface Props {
  /** Los mete recharts al clonar el elemento; no se pasan a mano. */
  active?: boolean;
  payload?: PuntoDeGrafica[];
  /** La `x` es la del punto señalado; la `y`, la del cursor. */
  coordinate?: { x?: number; y?: number };
  /**
   * A qué altura, en píxeles de la gráfica, se apoya el globo.
   *
   * Sin esto el globo sigue al mouse y termina flotando a media altura, lejos
   * del punto que está describiendo. Recharts no entrega la `y` del punto, solo
   * la del cursor, así que quien usa el componente la calcula con su propia
   * escala y acá se corrige la diferencia.
   */
  ancla?: (punto: Record<string, unknown>, valor: number) => number;
  /** Qué dice el globo. Recibe el punto sobre el que está el cursor. */
  texto: (punto: Record<string, unknown>, valor: number) => ReactNode;
}

export function GloboGrafica({ active, payload, coordinate, ancla, texto }: Props) {
  if (!active || !payload?.length) return null;

  const punto = payload[0];
  const valor = Number(punto.value ?? 0);

  // Lo que hay que subir o bajar para pasar de la altura del cursor a la del
  // punto. Sin ancla se queda donde recharts lo puso.
  const desvio = ancla && coordinate?.y != null
    ? ancla(punto.payload ?? {}, valor) - coordinate.y
    : null;

  return (
    <div className="relative text-white text-[11.5px] leading-relaxed rounded-lg whitespace-nowrap"
      style={{
        background: '#1A1028', padding: '7px 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
        // Centrado sobre el punto y apoyado encima de él, con la puntita
        // señalándolo. Nunca debajo: abajo tapa la línea que se está leyendo.
        ...(desvio === null ? {} : { transform: `translate(-50%, calc(-100% - 10px + ${desvio}px))` }),
      }}>
      {texto(punto.payload ?? {}, valor)}
      {/* La puntita. Es un cuadrado girado y no un borde, para que herede el
          mismo negro sin tener que repetirlo. */}
      <span
        style={{
          position: 'absolute', bottom: -4, left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 8, height: 8, background: '#1A1028',
        }}
      />
    </div>
  );
}
