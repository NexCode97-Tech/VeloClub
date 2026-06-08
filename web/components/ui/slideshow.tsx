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

function SlideCard({ slide }: { slide: SlideshowSlide }) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
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
      {/* ── Móvil: carrusel ─────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl md:hidden h-[400px]"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)' }}
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
            <img src={mobileSlide.img} alt={mobileSlide.title} className="w-full h-full object-cover" />
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

      {/* ── Tablet: grid 2 columnas rotativo ────────────────────── */}
      <div className="hidden md:block lg:hidden w-full overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`tablet-${startIndex}`}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="grid grid-cols-2 gap-3"
          >
            {[0, 1].map(offset => (
              <div key={offset} className="aspect-[3/2]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={getSlide(offset)} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Escritorio: grid 2 columnas rotativo ────────────────── */}
      <div className="hidden lg:block w-full overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`desktop-${startIndex}`}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="grid grid-cols-2 gap-3"
          >
            {[0, 1].map(offset => (
              <div key={offset} className="h-[420px]" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.06)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={getSlide(offset)} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
