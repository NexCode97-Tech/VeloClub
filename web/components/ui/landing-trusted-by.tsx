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
    <section className="relative w-full overflow-hidden py-16 bg-[#0D0520]">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p
          className="text-center text-2xl sm:text-3xl font-semibold text-white tracking-tight"
          style={{ fontFamily: 'Open Sans, sans-serif' }}
        >
          Clubes que ya confían en{' '}
          <span className="text-[#A78BFA]">VeloClub</span>
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
