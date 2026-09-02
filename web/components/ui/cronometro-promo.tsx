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
  // El primer render no sabe qué hora es.
  //
  // Antes se calculaba también en el servidor, para que el bloque ocupara su
  // lugar desde el primer pintado. Pero la landing es estática: su HTML se
  // cocina al desplegar y ahí se queda, así que el conteo que lleva dentro
  // envejece un minuto por minuto. El visitante que llegaba tres días después
  // recibía «60d» en el HTML y su navegador calculaba «57d», y React reportaba
  // la diferencia como error de hidratación en cada visita.
  //
  // Ahora el primer render es idéntico en los dos lados: el bloque se dibuja
  // con su forma pero oculto, así reserva su alto y el titular no salta, y las
  // cifras entran al montar, ya con el reloj del visitante.
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    // Basta con un tic por minuto: es la unidad más fina que se muestra.
    const tic = () => setRestante(restantePromo());
    tic();
    const id = setInterval(tic, 60_000);
    return () => clearInterval(id);
  }, []);

  // Solo se apaga cuando ya se sabe la hora. Con `restante` todavía en null la
  // promoción no ha vencido: es que aún no se ha mirado el reloj.
  if (restante !== null && restante <= 0) return null;

  const sinReloj = restante === null;
  const { dias, horas, minutos } = desglosarRestante(restante ?? 0);
  const dosDigitos = (n: number) => String(n).padStart(2, '0');

  return (
    // Alineado por línea base, no por el borde inferior de las cajas. Con
    // `items-end` la etiqueta quedaba montada sobre el renglón de las cifras:
    // estas llevaban el interlineado comprimido, así que su caja terminaba más
    // abajo que la de la etiqueta y el texto salía inclinado hacia arriba.
    //
    // `invisible` y no `hidden`: oculta el bloque pero le deja su caja, que es
    // justo lo que se necesita mientras no se sabe la hora. El lector de
    // pantalla tampoco lo anuncia, así que no llega a leer un conteo en cero.
    <div className={`flex items-baseline gap-3 ${sinReloj ? 'invisible' : ''}`}>
      {/* El conteo cambia solo; leerlo en voz alta cada minuto sería ruido.
          El lector de pantalla recibe la frase completa una vez. */}
      <span className="sr-only">
        Quedan {dias} días para que finalice la promoción de dos meses gratis.
      </span>

      {/* El amarillo de marca, plano. Llevaba un contorno fino por contraste,
          pero a este tamaño ensuciaba el trazo de la cifra mas de lo que
          ayudaba a leerla. */}
      <span
        aria-hidden="true"
        className={`font-bold text-[1.6rem] sm:text-[1.75rem] tracking-tight tabular-nums ${
          claro ? 'text-[#FFB703]' : 'font-semibold text-white'
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
