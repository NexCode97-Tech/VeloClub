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
    <section className="relative w-full overflow-hidden pt-16 pb-4">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p className="text-center text-2xl sm:text-3xl font-semibold text-[#1A1028] tracking-tight" style={{ fontFamily: 'Open Sans, sans-serif' }}>
          Clubes que ya confían en{' '}
          <span className="text-[#7C3AED]">VeloClub</span>
        </p>

        <motion.div
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mt-12 grid gap-x-6 gap-y-8"
          style={{ gridTemplateColumns: `repeat(${Math.min(clubs.length, 5)}, minmax(0, 1fr))` }}
        >
          {clubs.map((c, i) => (
            <motion.div
              key={c.id}
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: reducedMotion ? 0 : i * 0.05 }}
              className="flex items-center justify-center grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-200"
              title={c.name}
            >
              <Image
                src={c.logoUrl}
                alt={c.name}
                width={64}
                height={64}
                className="object-contain w-10 h-10 sm:w-12 sm:h-12 rounded-full"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

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
