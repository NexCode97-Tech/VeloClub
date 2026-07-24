'use client';

import * as React from 'react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api-client';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

export default function LandingTrustedBy() {
  const [clubs, setClubs] = React.useState<TrustedClub[]>([]);

  React.useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      .then(r => setClubs(r.clubs))
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

      {/* Logos fijos y nítidos, cada uno con su nombre */}
      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-start justify-center gap-6 px-5 sm:gap-8 md:gap-10">
        {clubs.map(club => (
          <div
            key={club.id}
            className="flex w-20 shrink-0 flex-col items-center gap-2 sm:w-24"
            title={club.name}
          >
            <span className="flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14">
              <Image
                src={club.logoUrl}
                alt={club.name}
                width={72}
                height={72}
                className="h-full w-full rounded-full object-contain"
              />
            </span>
            <span className="w-full select-none text-center text-[10px] font-medium leading-tight tracking-wide text-white/60 sm:text-[11px] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
              {club.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
