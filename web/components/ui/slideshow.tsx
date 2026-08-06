'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone } from 'lucide-react';

export interface SlideshowSlide {
  img: string;
  label?: string;
  title: string;
  description?: string;
  /** Destino del botón de contacto. Sin url (o con '#') el botón no se muestra. */
  url?: string;
  /** Texto del botón. Por defecto "Contactar". */
  cta?: string;
}

// El tamaño no se recibe por props: el alto es el mismo en móvil, tablet y
// escritorio, y el ancho lo reparte la rejilla de cada corte. Antes había un
// className que el componente ignoraba, y hacía creer que el alto se
// controlaba desde afuera.
interface SlideshowProps {
  slides: SlideshowSlide[];
  autoPlayMs?: number;
}

// Umbrales del gesto táctil: píxeles arrastrados o velocidad del impulso.
const SWIPE_DISTANCIA = 60;
const SWIPE_VELOCIDAD = 400;

// Altura del anuncio, igual en los tres cortes. La proporcion 4:3 hacia que
// creciera con la pantalla: en un portatil de 1440 se comia 434px antes de la
// primera publicacion, y en un monitor grande todavia mas. Con un alto fijo el
// ancho lo reparte la rejilla y la imagen se recorta con `cover`; si se deja la
// proporcion puesta, el navegador la conserva encogiendo tambien el ancho.
const ALTO_MAX = 200;

/**
 * Botón de contacto del anuncio.
 *
 * Acabado de vidrio, el mismo lenguaje que la etiqueta de la esquina superior:
 * así la tarjeta se lee como una sola pieza y se tapa lo mínimo de la imagen del
 * anunciante, que es lo que él paga por mostrar.
 *
 * Solo aparece cuando el anuncio tiene un destino real; los de muestra siguen sin
 * botón en lugar de ofrecer un enlace que no lleva a ninguna parte.
 */
function BotonContacto({ slide }: { slide: SlideshowSlide }) {
  if (!slide.url || slide.url === '#') return null;
  return (
    <a
      href={slide.url}
      target="_blank"
      rel="noopener noreferrer"
      // Evita que el toque se interprete como interacción con el carrusel
      onClick={e => e.stopPropagation()}
      onPointerDownCapture={e => e.stopPropagation()}
      // Mismo tamaño que la etiqueta de la esquina superior, para que las dos
      // piezas de la tarjeta se lean como una sola familia.
      className="inline-flex items-center gap-1.5 rounded-full text-white font-semibold transition-colors"
      style={{
        padding: '4px 10px',
        fontSize: 10,
        lineHeight: 1,
        background: 'rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.28)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Phone className="w-3 h-3" aria-hidden />
      {slide.cta ?? 'Contactar'}
    </a>
  );
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
      {/* Velo corto y solo abajo: sin título ni descripción, únicamente tiene que
          sostener el botón y los puntos sobre piezas de fondo claro. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '32%', background: 'linear-gradient(to top, rgba(10,5,20,0.62) 0%, transparent 100%)' }}
      />
      {slide.label && (
        <div
          className="absolute top-3 left-3 flex items-center"
          style={{
            background: 'rgba(10,8,20,0.75)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '4px 10px',
          }}
        >
          <span className="text-[10px] font-semibold text-white/90 tracking-wide leading-none">
            {slide.label}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        <BotonContacto slide={slide} />
      </div>
    </div>
  );
}

export function Slideshow({ slides, autoPlayMs = 5000 }: SlideshowProps) {
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

  // Escritorio: tres anuncios a la vez. El paso lo lleva `page`, que avanza de
  // uno en uno, y no `startIndex`, que salta de dos en dos para las parejas de
  // tablet; con ese salto el trio cambiaba de forma irregular.
  const gruposEscritorio: SlideshowSlide[][] = [];
  for (let i = 0; i < slides.length; i += 3) {
    gruposEscritorio.push([0, 1, 2].map(d => slides[(i + d) % slides.length]));
  }
  const grupoActivo = gruposEscritorio.length > 0
    ? ((page % gruposEscritorio.length) + gruposEscritorio.length) % gruposEscritorio.length
    : 0;

  return (
    <>
      {/* ── Móvil: carrusel con swipe ────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl md:hidden"
        style={{ height: ALTO_MAX, boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)' }}
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
            className="absolute inset-0 touch-pan-y"
            // Deslizar con el dedo para adelantar o retroceder. El avance
            // automático sigue corriendo, pero se pausa unos segundos tras cada
            // gesto para no arrebatarle el control a quien está mirando.
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragStart={handleInteraction}
            onDragEnd={(_, info) => {
              // Basta con un desplazamiento claro o un gesto rápido: exigir ambos
              // haría que los deslizamientos cortos no respondieran.
              const recorrido = info.offset.x;
              const impulso = info.velocity.x;
              if (recorrido < -SWIPE_DISTANCIA || impulso < -SWIPE_VELOCIDAD) paginate(1);
              else if (recorrido > SWIPE_DISTANCIA || impulso > SWIPE_VELOCIDAD) paginate(-1);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileSlide.img} alt={mobileSlide.title} className="w-full h-full object-cover" loading="eager" />
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ height: '32%', background: 'linear-gradient(to top, rgba(10,5,20,0.62) 0%, transparent 100%)' }}
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
                <span className="text-[10px] font-semibold text-white/90 tracking-wide leading-none">
                  {mobileSlide.label}
                </span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
              <BotonContacto slide={mobileSlide} />
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
          <div style={{ height: ALTO_MAX }} />
          <div style={{ height: ALTO_MAX }} />
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
              <div style={{ height: ALTO_MAX, boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s0} priority={idx === 0} />
              </div>
              <div style={{ height: ALTO_MAX, boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                <SlideCard slide={s1} priority={idx === 0} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Escritorio: cross-fade suave — todas las capas montadas ─ */}
      <div className="hidden lg:block w-full rounded-2xl" style={{ position: 'relative' }}>
        <div className="grid grid-cols-3 gap-3" style={{ visibility: 'hidden', pointerEvents: 'none' }} aria-hidden>
          <div style={{ height: ALTO_MAX }} />
          <div style={{ height: ALTO_MAX }} />
          <div style={{ height: ALTO_MAX }} />
        </div>
        {/* Grupos de tres. Se arman con el resto para que un numero de
            anuncios que no sea multiplo de tres no deje huecos: el ultimo
            grupo se completa dando la vuelta al principio. */}
        {gruposEscritorio.map((grupo, idxGrupo) => {
          const isActive = idxGrupo === grupoActivo;
          return (
            <div
              key={idxGrupo}
              className="absolute inset-0 grid grid-cols-3 gap-3"
              style={{
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.55s cubic-bezier(0.23,1,0.32,1)',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              {grupo.map((s, i) => (
                <div key={i} style={{ height: ALTO_MAX, boxShadow: '0 4px 16px rgba(0,0,0,0.13), inset 0 0 0 1px rgba(0,0,0,0.08)', borderRadius: '1rem', overflow: 'hidden' }}>
                  <SlideCard slide={s} priority={idxGrupo === 0} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
