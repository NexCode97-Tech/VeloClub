'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// Easing/timing por la skill emilkowal-animations: ease-out fuerte para UI,
// duraciones cortas (<300ms). El contenido usa fade+slide corto al cambiar
// de pestaña principal o sub-pestaña.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_OUT_CSS = `cubic-bezier(${EASE_OUT.join(',')})`;
const TAB_ACTIVE_FLEX_MOBILE = 2.4;

export interface FeatureSub {
  key: string;
  label: string;
  desc: string;
  icon: React.ElementType;
}

export interface FeatureTab {
  key: string;
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  sub: FeatureSub[];
}

export default function LandingFeaturesTabs({ features }: { features: FeatureTab[] }) {
  const [mainKey, setMainKey] = useState(features[0].key);
  const reducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  // La compresión (solo ícono, se expande al seleccionar) es un patrón
  // pensado para el poco espacio horizontal del móvil. En pantallas más
  // grandes las pestañas se muestran siempre expandidas con su texto.
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    setIsMobile(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const main = features.find(f => f.key === mainKey) ?? features[0];

  const activeIndex = features.findIndex(f => f.key === mainKey);
  const flexOf = (i: number) => (isMobile ? (i === activeIndex ? TAB_ACTIVE_FLEX_MOBILE : 1) : 1);

  return (
    <div>
      {/* Pestañas principales — una sola fila, todas comprimidas (solo ícono);
          la activa se expande mostrando el texto, las demás quedan en ícono.
          El fondo activo usa shared layout animation (layoutId) entre
          botones: puede saltar en vez de deslizar en móvil porque compite
          con el resize del ancho vía flex-grow (transition-[flex]) — ya
          probado y confirmado por el usuario, se deja así a propósito.
          Esquinas de abajo planas para que toque sin espacio la tarjeta
          blanca de sub-pestañas + contenido de más abajo. */}
      {/* Toda la pieza es gris sobre el blanco de la página, al revés que
          antes: con el fondo en blanco puro, una tarjeta blanca no se separa.
          La tira va un punto más oscura que el panel, para que se lea como la
          pestaña de una carpeta y no como parte de la tarjeta. */}
      <div
        role="tablist"
        aria-label="Funcionalidades de VeloClub"
        className="relative flex items-center gap-2 rounded-t-2xl p-1.5 overflow-x-auto no-scrollbar w-full"
        style={{ background: '#ECEAF3' }}
      >
        {features.map((f, i) => {
          const isActive = f.key === mainKey;
          const showLabel = isActive || !isMobile;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={isActive}
              aria-label={f.label}
              onClick={() => setMainKey(f.key)}
              className={`relative z-10 flex items-center justify-center gap-1.5 h-9 rounded-full text-[13px] font-semibold cursor-pointer overflow-hidden min-w-0 transition-[flex,background-color] duration-700 ${
                isActive ? '' : 'hover:bg-[rgba(26,16,40,0.06)]'
              }`}
              style={{
                transitionTimingFunction: EASE_OUT_CSS,
                flex: `${flexOf(i)} 1 0%`,
                paddingLeft: isMobile ? 8 : 14,
                paddingRight: isMobile ? 8 : 14,
                color: isActive ? '#fff' : '#6B6580',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="feature-tab-pill"
                  className="absolute inset-0 rounded-full bg-[#1A1028]"
                  style={{ zIndex: -1 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease: EASE_OUT }}
                />
              )}
              <f.icon className="w-4 h-4 shrink-0" />
              <AnimatePresence initial={false}>
                {showLabel && (
                  <motion.span
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    className="whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {f.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* El panel del modulo. Todas sus entradas se ven a la vez, en dos
          columnas. La linea que las separa se dibuja con el selector de hermano
          adyacente y no con un borde fijo: Asistencia tiene una sola entrada y
          si no arrastraria una divisoria suelta contra el aire. */}
      <div className="relative overflow-hidden rounded-b-2xl bg-[#F4F3F8] border border-[rgba(26,16,40,0.05)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={main.key}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="grid grid-cols-1 sm:grid-cols-2"
          >
            {main.sub.map((s, i) => (
              <article
                key={s.key}
                className={`flex items-start gap-4 px-6 py-6 sm:px-7 ${
                  i === 0 ? '' : 'border-t sm:border-t-0 sm:border-l'
                } border-[rgba(26,16,40,0.07)]`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: main.bg }}
                >
                  <s.icon className="w-5 h-5" style={{ color: main.color }} />
                </div>
                <div>
                  <p className="font-semibold text-[#1A1028] text-[15.5px] mb-1">{s.label}</p>
                  <p className="text-[13px] text-[#6B6580] leading-relaxed">{s.desc}</p>
                </div>
              </article>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
