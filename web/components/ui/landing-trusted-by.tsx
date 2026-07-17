'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { Sparkles } from '@/components/ui/sparkles';

interface TrustedClub {
  id: string;
  name: string;
  logoUrl: string;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

// Cantidad mínima de logos que debe tener un set para que el carrusel
// siempre se vea lleno y fluido, sin importar cuántos clubes reales haya.
const MIN_SET_SIZE = 14;

function ClubLogo({ club }: { club: TrustedClub }) {
  return (
    <div
      className="flex items-center justify-center shrink-0 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-200"
      title={club.name}
    >
      <Image
        src={club.logoUrl}
        alt={club.name}
        width={64}
        height={64}
        className="object-contain w-10 h-10 sm:w-12 sm:h-12 rounded-full"
      />
    </div>
  );
}

export default function LandingTrustedBy() {
  const [clubs, setClubs] = useState<TrustedClub[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      .then(r => setClubs(r.clubs))
      .catch(() => setClubs([]));
  }, []);

  if (clubs.length === 0) return null;

  // Repetimos la lista de clubes las veces necesarias para armar un set
  // suficientemente ancho (se ajusta solo a medida que se agreguen más
  // clubes verificados), y lo duplicamos una vez más para el loop infinito.
  const repeatFactor = Math.max(1, Math.ceil(MIN_SET_SIZE / clubs.length));
  const set = Array.from({ length: repeatFactor }, () => clubs).flat();
  const track = [...set, ...set];
  const duration = Math.max(set.length * 2.5, 18);

  return (
    <section className="relative w-full overflow-hidden pt-16 pb-4">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p className="text-center text-2xl sm:text-3xl font-semibold text-[#1A1028] tracking-tight" style={{ fontFamily: 'Open Sans, sans-serif' }}>
          Clubes que ya confían en{' '}
          <span className="text-[#7C3AED]">VeloClub</span>
        </p>
      </div>

      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mt-12 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]"
      >
        {reducedMotion ? (
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 px-5">
            {clubs.map(c => (
              <ClubLogo key={c.id} club={c} />
            ))}
          </div>
        ) : (
          <div className="flex justify-center">
            <motion.div
              className="flex items-center gap-10 sm:gap-14 w-max"
              initial={{ x: '0%' }}
              whileInView={{ x: ['0%', '-50%'] }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration, ease: 'linear', repeat: Infinity }}
            >
              {track.map((c, i) => (
                <ClubLogo key={`${c.id}-${i}`} club={c} />
              ))}
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Horizonte con partículas — misma técnica que el ejemplo, recoloreado a marca */}
      <div className="relative -mt-24 h-80 w-full overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]">
        <div className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,#7C3AED,transparent_70%)] before:opacity-30" />
        <div className="absolute -left-1/2 top-1/2 aspect-[1/0.7] z-10 w-[200%] rounded-[100%] border-t border-[rgba(124,58,237,0.15)] bg-[#F7F7FB]" />
        {!reducedMotion && (
          <Sparkles
            density={900}
            color="#7C3AED"
            className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
          />
        )}
      </div>
    </section>
  );
}
