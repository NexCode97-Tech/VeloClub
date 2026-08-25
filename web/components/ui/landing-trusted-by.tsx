'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { MarqueeLogos } from '@/components/ui/marquee-logos';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

/**
 * El logo del club, con su fondo llevado a blanco puro.
 *
 * Cada club sube el logo como quiere, y los fondos «blancos» que llegan no lo
 * son: medidos en producción dan #FEFEFE, #F7F7F7 y solo alguno #FFFFFF. Sobre
 * esta sección, que ahora es blanca, esa diferencia se ve como un disco gris
 * alrededor del logo.
 *
 * `e_make_transparent` quita el color de fondo y `b_white` lo vuelve a pintar
 * en blanco puro. Van los dos juntos: quitarlo a secas agujerea las letras
 * blancas de adentro del logo, porque borra todo el blanco y no solo el del
 * borde. Uno de los logos perdía 70.000 píxeles interiores así. Repintando, lo
 * que se quitó vuelve como blanco y lo único que cambia es el tono.
 *
 * Un logo con fondo oscuro no se toca: ese fondo es su diseño, no un descuido.
 *
 * La transformación vive en la url, así que la foto de perfil del club no se
 * entera: Cloudinary deja esta versión aparte y la cachea.
 */
function sobreBlanco(url: string): string {
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/e_make_transparent:15,b_white/f_jpg/');
}

export default function LandingTrustedBy() {
  const [clubs, setClubs] = React.useState<TrustedClub[]>([]);

  React.useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      // La API ya excluye los que no tienen logo, pero un logoUrl vacío pasaría
      // el filtro y dejaría un hueco en la tira.
      .then(r => setClubs(
        r.clubs
          .filter(c => c.logoUrl && c.logoUrl.trim() !== '')
          .map(c => ({ ...c, logoUrl: sobreBlanco(c.logoUrl) })),
      ))
      .catch(() => setClubs([]));
  }, []);

  if (clubs.length === 0) return null;

  return (
    /* En blanco, como el resto de la página. Antes era casi negra y aparecía
       como un rectángulo pegado en la mitad del scroll.
       De paso resuelve los logos: casi todos vienen con fondo blanco, que sobre
       oscuro obligaba a un círculo claro detrás y sobre blanco entra solo. */
    <section className="relative w-full overflow-hidden py-16 bg-white">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p className="text-center text-2xl sm:text-3xl font-semibold text-[#1A1028] tracking-tight">
          Clubes que ya confían en{' '}
          <span className="text-[#7C3AED]">VeloClub</span>
        </p>
      </div>

      {/* Solo el logo, en movimiento continuo. Sin el nombre debajo: la fila de
          textos cortados competía con los logos y la sección se leía como una
          lista, no como una muestra de quiénes ya están adentro. */}
      <div className="mt-12">
        <MarqueeLogos logos={clubs} velocidad="normal" />
      </div>
    </section>
  );
}
