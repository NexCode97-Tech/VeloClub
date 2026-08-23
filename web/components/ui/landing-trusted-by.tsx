'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api-client';
import { MarqueeLogos } from '@/components/ui/marquee-logos';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

export default function LandingTrustedBy() {
  const [clubs, setClubs] = React.useState<TrustedClub[]>([]);

  React.useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      // La API ya excluye los que no tienen logo, pero un logoUrl vacío pasaría
      // el filtro y dejaría un hueco en la tira.
      .then(r => setClubs(r.clubs.filter(c => c.logoUrl && c.logoUrl.trim() !== '')))
      .catch(() => setClubs([]));
  }, []);

  if (clubs.length === 0) return null;

  return (
    /* Último tramo del amanecer: recibe el color donde termina Funcionalidades
       y llega al claro de la página. Antes esta franja era casi negra y
       aparecía como un rectángulo pegado en la mitad del scroll.
       De paso resuelve los logos: casi todos vienen con fondo blanco, que sobre
       oscuro obligaba a un círculo claro detrás y sobre claro entra solo. */
    <section
      className="relative w-full overflow-hidden py-16"
      style={{ background: 'linear-gradient(180deg, #E9E6F2 0%, #F2F0F8 55%, #F7F7FB 100%)' }}
    >
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
