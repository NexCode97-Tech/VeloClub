'use client';

import { useEffect, useState } from 'react';
import { restantePromo, desglosarRestante } from '@/lib/promo';

/**
 * Cuenta regresiva de la promoción de lanzamiento en el hero.
 *
 * El cronómetro es el instrumento del deporte del cliente, así que la campaña
 * se anuncia con la forma que ellos ya leen todos los fines de semana.
 *
 * Se apaga sola: cuando la fecha de corte pasa no devuelve nada, así que el
 * 1 de noviembre el hero deja de prometer algo que el backend ya no da, sin
 * necesidad de desplegar. El titular sigue teniendo sentido sin esta línea.
 */
export function CronometroPromo() {
  // Se calcula también en el servidor para que el bloque ocupe su lugar desde
  // el primer pintado y el titular no salte al hidratar. Servidor y navegador
  // no comparten reloj, así que los dígitos pueden diferir por un minuto en ese
  // primer render: de ahí el suppressHydrationWarning, que silencia solo eso.
  const [restante, setRestante] = useState(() => restantePromo());

  useEffect(() => {
    // Basta con un tic por minuto: es la unidad más fina que se muestra.
    const tic = () => setRestante(restantePromo());
    tic();
    const id = setInterval(tic, 60_000);
    return () => clearInterval(id);
  }, []);

  if (restante <= 0) return null;

  const { dias, horas, minutos } = desglosarRestante(restante);
  const dosDigitos = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="flex items-end gap-3">
      {/* El conteo cambia solo; leerlo en voz alta cada minuto sería ruido.
          El lector de pantalla recibe la frase completa una vez. */}
      <span className="sr-only">
        Quedan {dias} días para que cierre la promoción de dos meses gratis.
      </span>

      {/* Sin monoespaciada: la del sistema no combina con la tipografía del
          titular y el bloque se leía como pegado de otra página. `tabular-nums`
          basta para que los dígitos no cambien de ancho al bajar el conteo. */}
      <span
        aria-hidden="true"
        suppressHydrationWarning
        className="font-semibold text-[1.6rem] sm:text-[1.75rem] leading-[0.9] tracking-tight text-white tabular-nums"
      >
        {dias}<span className="text-[0.95rem] font-medium text-zinc-500 mx-px">d</span>
        {' '}{dosDigitos(horas)}<span className="text-[0.95rem] font-medium text-zinc-500 mx-px">h</span>
        {' '}{dosDigitos(minutos)}<span className="text-[0.95rem] font-medium text-zinc-500 mx-px">m</span>
      </span>

      <span aria-hidden="true" className="pb-[3px] text-[12px] text-zinc-400">
        para que cierre
      </span>
    </div>
  );
}
