'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

// Easing/timing por la skill emilkowal-animations: ease-out fuerte para UI,
// duraciones cortas (<300ms). El contenido usa fade+slide corto al cambiar
// de pestaña principal o sub-pestaña.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

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

  const main = features.find(f => f.key === mainKey) ?? features[0];
  const sub = main.sub.find(s => s.key === subKey) ?? main.sub[0];

  function selectMain(f: FeatureTab) {
    setMainKey(f.key);
    setSubKey(f.sub[0].key);
  }

  return (
    <div>
      {/* Pestañas principales — una sola fila, todas comprimidas (solo ícono);
          la activa se expande mostrando el texto, las demás quedan en ícono. */}
      <div
        role="tablist"
        aria-label="Funcionalidades de VeloClub"
        className="flex items-center gap-2 mb-2.5 rounded-full p-1.5 overflow-x-auto no-scrollbar"
        style={{ background: 'rgba(124,58,237,0.06)' }}
      >
        {features.map(f => {
          const isActive = f.key === mainKey;
          return (
            <motion.button
              key={f.key}
              layout
              role="tab"
              aria-selected={isActive}
              aria-label={f.label}
              onClick={() => selectMain(f)}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
              className="relative flex items-center justify-center gap-1.5 h-9 rounded-full text-[13px] font-semibold cursor-pointer overflow-hidden shrink-0"
              style={{
                width: isActive ? 'auto' : 36,
                paddingLeft: isActive ? 14 : 0,
                paddingRight: isActive ? 14 : 0,
                background: isActive ? '#1A1028' : 'transparent',
                color: isActive ? '#fff' : '#6B6580',
              }}
            >
              <f.icon className="w-4 h-4 shrink-0" />
              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.span
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                    transition={{ duration: 0.16, ease: EASE_OUT }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {f.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Sub-pestañas — más discretas, cambian con la pestaña principal */}
      <div role="tablist" aria-label={`Aspectos de ${main.label}`} className="flex flex-wrap gap-1 mb-4">
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
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-colors"
                style={{
                  background: isActive ? 'rgba(124,58,237,0.08)' : 'transparent',
                  color: isActive ? '#1A1028' : '#9B95AC',
                }}
              >
                {s.label}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Panel de contenido */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[rgba(120,80,200,0.10)]" style={{ minHeight: 150 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${main.key}-${sub.key}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="p-6 sm:p-7 flex items-start gap-4"
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
