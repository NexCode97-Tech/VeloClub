'use client';

import { useEffect, useRef, useState } from 'react';
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

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    apiFetch<{ clubs: TrustedClub[] }>('/clubs/trusted')
      .then(r => setClubs(r.clubs))
      .catch(() => setClubs([]));
  }, []);

  // Solo tiene sentido animar el deslizante si los logos exceden el ancho
  // del contenedor. Si caben todos, se muestran centrados y estáticos
  // (ej. escritorio con pocos clubes) en vez de arrancar pegados a la izquierda.
  useEffect(() => {
    if (clubs.length === 0) return;
    const measure = () => {
      if (!containerRef.current || !trackRef.current) return;
      setOverflows(trackRef.current.scrollWidth > containerRef.current.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [clubs]);

  if (clubs.length === 0) return null;

  const shouldAnimate = !reducedMotion && overflows;

  // Duración proporcional a la cantidad de logos para que la velocidad
  // de desplazamiento se sienta constante sin importar cuántos clubes haya.
  const duration = Math.max(clubs.length * 3, 18);

  return (
    <section className="relative w-full overflow-hidden pt-16 pb-4">
      <div className="mx-auto w-full max-w-2xl px-5">
        <p className="text-center text-2xl sm:text-3xl font-semibold text-[#1A1028] tracking-tight" style={{ fontFamily: 'Open Sans, sans-serif' }}>
          Clubes que ya confían en{' '}
          <span className="text-[#7C3AED]">VeloClub</span>
        </p>
      </div>

      <motion.div
        ref={containerRef}
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="mt-12 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_12%,white_88%,transparent)]"
      >
        {shouldAnimate ? (
          <motion.div
            className="flex items-center gap-10 sm:gap-14 w-max"
            initial={{ x: '0%' }}
            whileInView={{ x: ['0%', '-50%'] }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration, ease: 'linear', repeat: Infinity }}
          >
            {[...clubs, ...clubs].map((c, i) => (
              <ClubLogo key={`${c.id}-${i}`} club={c} />
            ))}
          </motion.div>
        ) : (
          <div ref={trackRef} className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 px-5 w-max mx-auto">
            {clubs.map(c => (
              <ClubLogo key={c.id} club={c} />
            ))}
          </div>
        )}
        {/* Pista invisible solo para medir el ancho real del contenido sin duplicar */}
        {shouldAnimate && (
          <div ref={trackRef} className="absolute -z-10 opacity-0 pointer-events-none flex items-center gap-10 sm:gap-14 w-max">
            {clubs.map(c => (
              <ClubLogo key={`measure-${c.id}`} club={c} />
            ))}
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
