'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

// Precarga todas las imágenes al montar — evita jank en las transiciones
function usePreloadImages(slides: SlideshowSlide[]) {
  useEffect(() => {
    slides.forEach(slide => {
      const img = new window.Image();
      img.src = slide.img;
    });
  }, [slides]);
}

function SlideCard({ slide, priority }: { slide: SlideshowSlide; priority?: boolean }) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.img}
        alt={slide.title}
        className="w-full h-full object-cover"
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(10,5,20,0.88) 0%, rgba(10,5,20,0.35) 55%, transparent 100%)' }}
      />
      {slide.label && (
        <div
          className="absolute top-3 left-3 flex items-center"
          style={{
            background: 'rgba(15,15,15,0.70)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase leading-none">
            {slide.label}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-10">
        <h2
          className="text-white font-bold leading-tight mb-1.5"
          style={{ fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
        >
          {slide.title}
        </h2>
        {slide.description && (
          <p className="text-white/65 leading-relaxed line-clamp-3" style={{ fontSize: 11, fontWeight: 400 }}>
            {slide.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function Slideshow({ slides, autoPlayMs = 5000, className = '' }: SlideshowProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [startIndex, setStartIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Precarga todas las imágenes inmediatamente
  usePreloadImages(slides);

  const mobileIndex = ((page % slides.length) + slides.length) % slides.length;

  const paginate = useCallback((dir: number) => {
    setPage(([p]) => [p + dir, dir]);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      paginate(1);
      setStartIndex(i => (i + 2) % slides.length);
    }, autoPlayMs);
    return () => clearInterval(t);
  }, [paused, autoPlayMs, paginate, slides.length]);

  function handleInteraction() {
    setPaused(true);
    setTimeout(() => setPaused(false), 6000);
  }

  const mobileSlide = slides[mobileIndex];
  const getSlide = (offset: number) => slides[(startIndex + offset) % slides.length];

  return (
    <>
      {/* ── Móvil: carrusel con swipe ────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl md:hidden h-[400px]"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)' }}
        onClick={handleInteraction}
      >
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileSlide.img} alt={mobileSlide.title} className="w-full h-full object-cover" loading="eager" />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(10,5,20,0.88) 0%, rgba(10,5,20,0.35) 55%, transparent 100%)' }}
            />
            {mobileSlide.label && (
              <div
                className="absolute top-3 left-3 flex items-center"
                style={{
                  background: 'rgba(15,15,15,0.70)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 20,
                  padding: '4px 10px',
                }}
              >
                <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase leading-none">
                  {mobileSlide.label}
                </span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-10">
              <h2
                className="text-white font-bold leading-tight mb-1.5"
                style={{ fontSize: 16, textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}
              >
                {mobileSlide.title}
              </h2>
              {mobileSlide.description && (
                <p className="text-white/65 leading-relaxed line-clamp-3" style={{ fontSize: 11, fontWeight: 400 }}>
                  {mobileSlide.description}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction();
                setPage([i, i > mobileIndex ? 1 : -1]);
              }}
              style={{
                width: i === mobileIndex ? 16 : 5,
                height: 5,
                borderRadius: 3,
                background: i === mobileIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.3s ease',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Tablet: cross-fade suave (sin slide translate) ──────── */}
      <div className="hidden md:block lg:hidden w-full rounded-2xl" style={{ position: 'relative' }}>
        <div className="grid grid-cols-2 gap-3" style={{ visibility: 'hidden', pointerEvents: 'none' }} aria-hidden>
          <div className="aspect-[3/2]" />
          <div className="aspect-[3/2]" />
        </div>
        {slides.map((_, idx) => {
          if (idx % 2 !== 0) return null;
          // Normalizar startIndex al par más cercano — evita pantalla en blanco con nº impar de slides
          const normalizedStart = startIndex % slides.length;
          const activePairStart = Math.floor(normalizedStart / 2) * 2;
          const isActive = activePairStart === idx;
          const s0 = slides[idx];
          const s1 = slides[(idx + 1) % slides.length];
          return (
            <div
              key={idx}
              className="absolute inset-0 grid grid-cols-2 gap-3"
              style={{
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.55s cubic-bezier(0.23,1,0.32,1)',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="aspect-[3/2]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s0} priority={idx === 0} />
              </div>
              <div className="aspect-[3/2]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s1} priority={idx === 0} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Escritorio: cross-fade suave — todas las capas montadas ─ */}
      <div className="hidden lg:block w-full rounded-2xl" style={{ position: 'relative' }}>
        <div className="grid grid-cols-2 gap-3" style={{ visibility: 'hidden', pointerEvents: 'none' }} aria-hidden>
          <div className="h-[420px]" />
          <div className="h-[420px]" />
        </div>
        {slides.map((_, idx) => {
          if (idx % 2 !== 0) return null;
          // Normalizar al par más cercano — cubre slides.length impar
          const normalizedStart = startIndex % slides.length;
          const activePairStart = Math.floor(normalizedStart / 2) * 2;
          const isActive = activePairStart === idx;
          const s0 = slides[idx];
          const s1 = slides[(idx + 1) % slides.length];
          return (
            <div
              key={idx}
              className="absolute inset-0 grid grid-cols-2 gap-3"
              style={{
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.55s cubic-bezier(0.23,1,0.32,1)',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="h-[420px]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s0} priority={idx === 0} />
              </div>
              <div className="h-[420px]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s1} priority={idx === 0} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
