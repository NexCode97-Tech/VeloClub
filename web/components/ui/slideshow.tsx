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
        style={{ background: 'linear-gradient(to top, rgba(10,5,20,0.85) 0%, rgba(10,5,20,0.30) 50%, transparent 100%)' }}
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
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
        <h2
          className="text-white font-bold leading-tight mb-1"
          style={{ fontSize: 16, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          {slide.title}
        </h2>
        {slide.description && (
          <p className="text-white/60 leading-relaxed line-clamp-2" style={{ fontSize: 11, fontWeight: 400 }}>
            {slide.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function Slideshow({ slides, autoPlayMs = 5000, className = '' }: SlideshowProps) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [paused, setPaused] = useState(false);

  const index = ((page % slides.length) + slides.length) % slides.length;

  const paginate = useCallback((dir: number) => {
    setPage(([p]) => [p + dir, dir]);
  }, []);

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
    <>
      {/* ── Móvil: carrusel ─────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl md:hidden h-[400px]"
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
            <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(10,5,20,0.85) 0%, rgba(10,5,20,0.30) 50%, transparent 100%)' }}
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
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
              <h2
                className="text-white font-bold leading-tight mb-1"
                style={{ fontSize: 16, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
              >
                {slide.title}
              </h2>
              {slide.description && (
                <p className="text-white/60 leading-relaxed line-clamp-2" style={{ fontSize: 11, fontWeight: 400 }}>
                  {slide.description}
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
                setPage([i, i > index ? 1 : -1]);
              }}
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

      {/* ── Tablet: grid 2 columnas ──────────────────────────────── */}
      <div className="hidden md:grid lg:hidden grid-cols-2 gap-3">
        {slides.slice(0, 2).map((s, i) => (
          <div key={i} className="aspect-[16/9]">
            <SlideCard slide={s} />
          </div>
        ))}
      </div>

      {/* ── Escritorio: grid 3 columnas ──────────────────────────── */}
      <div className="hidden lg:grid grid-cols-3 gap-3">
        {slides.slice(0, 3).map((s, i) => (
          <div key={i} className="aspect-[16/9]">
            <SlideCard slide={s} />
          </div>
        ))}
      </div>
    </>
  );
}
