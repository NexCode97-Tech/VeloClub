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
/**
 * La letra de la unidad, separada de su cifra.
 *
 * Iba con 1 píxel de margen y la «d» se leía como parte del número. La
 * separación va en `em` y no en píxeles para que se mantenga proporcional
 * cuando el bloque encoge en móvil.
 */
function Unidad({ children, ultima, claro }: { children: string; ultima?: boolean; claro?: boolean }) {
  return (
    <span
      className={`text-[0.95rem] font-medium ${claro ? 'text-[#8E87A8]' : 'text-zinc-500'}`}
      style={{ marginLeft: '0.14em', marginRight: ultima ? 0 : '0.34em' }}
    >
      {children}
    </span>
  );
}

export function CronometroPromo({ claro = false }: { claro?: boolean }) {
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
    // Alineado por línea base, no por el borde inferior de las cajas. Con
    // `items-end` la etiqueta quedaba montada sobre el renglón de las cifras:
    // estas llevaban el interlineado comprimido, así que su caja terminaba más
    // abajo que la de la etiqueta y el texto salía inclinado hacia arriba.
    <div className="flex items-baseline gap-3">
      {/* El conteo cambia solo; leerlo en voz alta cada minuto sería ruido.
          El lector de pantalla recibe la frase completa una vez. */}
      <span className="sr-only">
        Quedan {dias} días para que finalice la promoción de dos meses gratis.
      </span>

      {/* En tinta y no en el amarillo de marca. Sobre claro ese amarillo da
          1,75 de contraste, y aunque un contorno fino lo hacia legible, la
          cifra quedaba gritando mas que el titular que va debajo. */}
      <span
        aria-hidden="true"
        suppressHydrationWarning
        className={`font-bold text-[1.6rem] sm:text-[1.75rem] tracking-tight tabular-nums ${
          claro ? 'text-[#1A1028]' : 'font-semibold text-white'
        }`}
      >
        {dias}<Unidad claro={claro}>d</Unidad>
        {dosDigitos(horas)}<Unidad claro={claro}>h</Unidad>
        {dosDigitos(minutos)}<Unidad claro={claro} ultima>m</Unidad>
      </span>

      <span aria-hidden="true" className={`text-[12px] ${claro ? 'text-[#8E87A8]' : 'text-zinc-400'}`}>
        para que finalice
      </span>
    </div>
  );
}
