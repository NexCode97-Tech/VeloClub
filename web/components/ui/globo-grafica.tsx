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
 * Una línea y no una lista: estas gráficas llevan **una sola serie**, así que
 * el renglón con el nombre de la serie no agrega nada y el título de la
 * gráfica ya dice qué se está midiendo.
 */

interface PuntoDeGrafica {
  value?: number | string;
  payload?: Record<string, unknown>;
}

interface Props {
  /** Los mete recharts al clonar el elemento; no se pasan a mano. */
  active?: boolean;
  payload?: PuntoDeGrafica[];
  /** Qué dice el globo. Recibe el punto sobre el que está el cursor. */
  texto: (punto: Record<string, unknown>, valor: number) => string;
}

export function GloboGrafica({ active, payload, texto }: Props) {
  if (!active || !payload?.length) return null;

  const punto = payload[0];
  const valor = Number(punto.value ?? 0);

  return (
    <div className="relative text-white text-[12px] font-semibold rounded-lg whitespace-nowrap"
      style={{ background: '#1A1028', padding: '6px 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.22)' }}>
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
