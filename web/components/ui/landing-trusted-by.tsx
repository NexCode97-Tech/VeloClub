'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Sparkles } from '@/components/ui/sparkles';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

const WIPE_DURATION = 0.92;
const WIPE_TIMES = [0, 0.4, 1];

function ClubLogoItem({
  club,
  index,
  isWaving,
  stagger,
  totalCount,
  onDone,
}: {
  club: TrustedClub;
  index: number;
  isWaving: boolean;
  stagger: number;
  totalCount: number;
  onDone: () => void;
}) {
  return (
    <motion.div
      aria-label={club.name}
      animate={
        isWaving
          ? {
              clipPath: ['inset(0 0% 0 0)', 'inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
              filter: ['blur(0px)', 'blur(8px)', 'blur(0px)'],
              opacity: [1, 0.2, 1],
            }
          : { clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)', opacity: 1 }
      }
      transition={
        isWaving
          ? {
              clipPath: {
                duration: WIPE_DURATION,
                times: WIPE_TIMES,
                ease: ['easeIn', [0.16, 1, 0.3, 1]],
                delay: index * stagger,
              },
              filter: {
                duration: WIPE_DURATION * 0.9,
                times: WIPE_TIMES,
                ease: 'easeInOut' as const,
                delay: index * stagger,
              },
              opacity: {
                duration: WIPE_DURATION * 0.85,
                times: WIPE_TIMES,
                ease: 'easeInOut' as const,
                delay: index * stagger,
              },
            }
          : { duration: 0.3, ease: 'easeOut' }
      }
      onAnimationComplete={() => {
        if (isWaving && index === totalCount - 1) onDone();
      }}
      whileHover={{
        scale: 1.07,
        transition: { type: 'spring', stiffness: 340, damping: 24 },
      }}
      className="flex w-20 shrink-0 cursor-default flex-col items-center gap-2 sm:w-24"
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
      <span className="w-full select-none truncate text-center text-[10px] font-medium tracking-wide text-white/60 sm:text-[11px]">
        {club.name}
      </span>
    </motion.div>
  );
}

export default function LandingTrustedBy() {
  const [clubs, setClubs] = React.useState<TrustedClub[]>([]);
  const [waving, setWaving] = React.useState(false);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      .then(r => setClubs(r.clubs))
      .catch(() => setClubs([]));
  }, []);

  // Dispara el barrido en intervalo (desactivado si el usuario prefiere menos movimiento)
  React.useEffect(() => {
    if (reducedMotion || clubs.length === 0) return;
    const id = setInterval(() => setWaving(true), 3200);
    return () => clearInterval(id);
  }, [reducedMotion, clubs.length]);

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

      {/* Fila de logos con nombre y barrido/blur en intervalo */}
      <div className="relative z-20 mx-auto mt-12 flex max-w-5xl flex-wrap items-start justify-center gap-6 px-5 sm:gap-8 md:gap-10">
        {clubs.map((club, i) => (
          <ClubLogoItem
            key={club.id}
            club={club}
            index={i}
            isWaving={waving}
            stagger={0.11}
            totalCount={clubs.length}
            onDone={() => setWaving(false)}
          />
        ))}
      </div>

      {/* Horizonte con partículas — misma técnica del ejemplo, recoloreado a marca */}
      <div className="relative -mt-16 h-80 w-full overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]">
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
