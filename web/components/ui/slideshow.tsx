'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SlideshowSlide {
  img: string;
  label?: string;
  title: string;
  description?: string;
  url?: string;
}

interface SlideshowProps {
  slides: SlideshowSlide[];
  autoPlayMs?: number;
  className?: string;
}

export function Slideshow({ slides, autoPlayMs = 5000, className = '' }: SlideshowProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [paused, setPaused] = useState(false);

  const index = ((page % slides.length) + slides.length) % slides.length;

  const paginate = useCallback((dir: number) => {
    setPage(([p]) => [p + dir, dir]);
  }, []);

  // Auto-play
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => paginate(1), autoPlayMs);
    return () => clearInterval(t);
  }, [paused, autoPlayMs, paginate]);

  function handleInteraction() {
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }

  const slide = slides[index];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      style={{ aspectRatio: '16/9', minHeight: 190 }}
      onClick={handleInteraction}
    >
      {/* Slides */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit:  (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-0"
        >
          {/* Imagen de fondo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.img}
            alt={slide.title}
            className="w-full h-full object-cover"
          />

          {/* Gradiente inferior */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(10,5,20,0.85) 0%, rgba(10,5,20,0.30) 50%, transparent 100%)',
            }}
          />

          {/* Label pill */}
          {slide.label && (
            <div
              className="absolute top-3 left-3"
              style={{
                background: 'rgba(15,15,15,0.70)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 20,
                padding: '3px 10px',
              }}
            >
              <span className="text-[10px] font-bold text-white/90 tracking-wider uppercase">
                {slide.label}
              </span>
            </div>
          )}

          {/* Contenido inferior */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
            <h2
              className="text-white font-bold leading-tight mb-1"
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 16,
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {slide.title}
            </h2>
            {slide.description && (
              <p
                className="text-white/70 leading-snug"
                style={{
                  fontFamily: 'var(--font-plus-jakarta)',
                  fontSize: 12,
                }}
              >
                {slide.description}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots indicadores */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); handleInteraction(); setPage([i, i > index ? 1 : -1]); }}
            style={{
              width: i === index ? 16 : 5,
              height: 5,
              borderRadius: 3,
              background: i === index ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.3s ease',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}
