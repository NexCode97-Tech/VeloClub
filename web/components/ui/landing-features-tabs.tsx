'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

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
}

export interface FeatureTab {
  key: string;
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  sub: FeatureSub[];
}

export default function LandingFeaturesTabs({ features }: { features: FeatureTab[] }) {
  const [mainKey, setMainKey] = useState(features[0].key);
  const [subKey, setSubKey] = useState(features[0].sub[0].key);
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
  const sub = main.sub.find(s => s.key === subKey) ?? main.sub[0];

  function selectMain(f: FeatureTab) {
    setMainKey(f.key);
    setSubKey(f.sub[0].key);
  }

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
      <div
        role="tablist"
        aria-label="Funcionalidades de VeloClub"
        className="relative flex items-center gap-2 rounded-t-2xl p-1.5 overflow-x-auto no-scrollbar w-full"
        style={{ background: 'rgba(124,58,237,0.06)' }}
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
              onClick={() => selectMain(f)}
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

      {/* Tarjeta blanca continua: sub-pestañas + panel de contenido, pegada
          sin espacio a las pestañas principales de arriba. */}
      <div className="relative overflow-hidden rounded-b-2xl bg-white border border-[rgba(120,80,200,0.10)]" style={{ minHeight: 150 }}>
        <div role="tablist" aria-label={`Aspectos de ${main.label}`} className="flex flex-wrap gap-1 px-6 sm:px-7 pt-4 pb-3 border-b border-[rgba(120,80,200,0.10)]">
          <AnimatePresence mode="popLayout" initial={false}>
            {main.sub.map(s => {
              const isActive = s.key === subKey;
              return (
                <motion.button
                  key={`${main.key}-${s.key}`}
                  layout
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSubKey(s.key)}
                  className={`relative inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer overflow-hidden transition-colors duration-200 ${
                    isActive ? '' : 'hover:bg-[rgba(124,58,237,0.05)]'
                  }`}
                  style={{ color: isActive ? '#1A1028' : '#9B95AC' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="feature-subtab-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'rgba(124,58,237,0.08)', zIndex: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
                    />
                  )}
                  <span className="relative z-10">{s.label}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${main.key}-${sub.key}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="px-6 sm:px-7 pt-3 pb-6 sm:pb-7 flex items-start gap-4"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: main.bg }}
            >
              <main.icon className="w-5 h-5" style={{ color: main.color }} />
            </div>
            <div>
              <p className="font-semibold text-[#1A1028] text-[15.5px] mb-1" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                {sub.label}
              </p>
              <p className="text-[13px] text-[#6B6580] leading-relaxed max-w-md">
                {sub.desc}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
