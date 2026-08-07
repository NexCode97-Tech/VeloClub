'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface MarqueeLogo {
  id: string;
  /** Se usa como texto alternativo. No se dibuja debajo del logo. */
  name: string;
  logoUrl: string;
}

interface MarqueeLogosProps extends React.HTMLAttributes<HTMLDivElement> {
  logos: MarqueeLogo[];
  velocidad?: 'lenta' | 'normal' | 'rapida';
}

const DURACION: Record<NonNullable<MarqueeLogosProps['velocidad']>, number> = {
  lenta: 60,
  normal: 40,
  rapida: 22,
};

// Con pocos logos la tira no alcanza a cubrir el ancho de la pantalla y se ve
// un hueco entre vuelta y vuelta. Se repite el grupo hasta tener suficientes
// piezas, y siempre un número par para que la mitad del recorrido calce exacto.
const MINIMO_PIEZAS = 12;

/**
 * Tira de logos en movimiento continuo. Se detiene al pasar el cursor y
 * queda quieta si el sistema pide menos animación.
 */
export function MarqueeLogos({ logos, velocidad = 'normal', className, ...props }: MarqueeLogosProps) {
  const visibles = React.useMemo(
    () => logos.filter(l => l.logoUrl && l.logoUrl.trim() !== ''),
    [logos],
  );

  const tira = React.useMemo(() => {
    if (visibles.length === 0) return [];
    const repeticiones = Math.max(2, Math.ceil(MINIMO_PIEZAS / visibles.length));
    const grupo = Array.from({ length: repeticiones }, () => visibles).flat();
    return [...grupo, ...grupo];
  }, [visibles]);

  if (visibles.length === 0) return null;

  // La animación recorre la mitad de la tira, que es una copia exacta de la
  // otra mitad: al terminar vuelve al inicio sin que se note el salto.
  const duracion = (DURACION[velocidad] * tira.length) / (visibles.length * 2);

  return (
    <div
      className={cn('w-full overflow-hidden', className)}
      style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}
      {...props}
    >
      <style>{`
        @keyframes veloclub-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .veloclub-marquee-pista {
          animation: veloclub-marquee var(--marquee-duracion) linear infinite;
        }
        .veloclub-marquee-pista:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .veloclub-marquee-pista { animation: none; }
        }
      `}</style>

      <div
        className="veloclub-marquee-pista flex w-max items-center gap-8 py-2 sm:gap-12"
        style={{ '--marquee-duracion': `${duracion}s` } as React.CSSProperties}
      >
        {tira.map((logo, i) => (
          <span
            key={`${logo.id}-${i}`}
            aria-hidden={i >= tira.length / 2}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-20 sm:w-20"
          >
            <span
              className="absolute inset-0 rounded-full opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.45), transparent 70%)' }}
            />
            <Image
              src={logo.logoUrl}
              alt={logo.name}
              width={96}
              height={96}
              className="relative h-full w-full rounded-full object-contain opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
