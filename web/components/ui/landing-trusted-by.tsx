'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion, type Variants } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { AnimatedGroup } from '@/components/ui/animated-group';
import { Sparkles } from '@/components/ui/sparkles';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

// Entrada tipo blur-slide escalonada (estilo del diseño de 21st.dev)
const itemVariant: Variants = {
  hidden: { opacity: 0, filter: 'blur(12px)', y: 12 },
  visible: {
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: { type: 'spring', bounce: 0.3, duration: 1.5 },
  },
};

export default function LandingTrustedBy() {
  const [clubs, setClubs] = useState<TrustedClub[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      .then(r => setClubs(r.clubs))
      .catch(() => setClubs([]));
  }, []);

  if (clubs.length === 0) return null;

  return (
    <section className="relative w-full overflow-hidden pt-16 pb-4 bg-[#0D0520]">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p
          className="text-center text-2xl sm:text-3xl font-semibold text-white tracking-tight"
          style={{ fontFamily: 'Open Sans, sans-serif' }}
        >
          Clubes que ya confían en{' '}
          <span className="text-[#A78BFA]">VeloClub</span>
        </p>
      </div>

      {/* Grilla de logos con entrada blur-in escalonada */}
      <AnimatedGroup
        variants={{
          container: {
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.06, delayChildren: 0.15 },
            },
          },
          item: reducedMotion
            ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
            : itemVariant,
        }}
        className="relative z-20 mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-x-10 gap-y-10 px-6 sm:grid-cols-4 sm:gap-x-16 sm:gap-y-12"
      >
        {clubs.map(club => (
          <div key={club.id} className="flex items-center justify-center" title={club.name}>
            <Image
              src={club.logoUrl}
              alt={club.name}
              width={72}
              height={72}
              className="h-12 w-12 rounded-full object-contain sm:h-14 sm:w-14"
            />
          </div>
        ))}
      </AnimatedGroup>

      {/* Horizonte con partículas — misma técnica del ejemplo, recoloreado a marca */}
      <div className="relative -mt-20 h-80 w-full overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]">
        <div className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,#7C3AED,transparent_70%)] before:opacity-40" />
        <div className="absolute -left-1/2 top-1/2 aspect-[1/0.7] z-10 w-[200%] rounded-[100%] border-t border-white/15 bg-[#0D0520]" />
        {!reducedMotion && (
          <Sparkles
            density={900}
            color="#ffffff"
            className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
          />
        )}
      </div>
    </section>
  );
}
