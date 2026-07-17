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
      {/* Pestañas principales — compactas, ancho según contenido */}
      <div role="tablist" aria-label="Funcionalidades de VeloClub" className="flex flex-wrap gap-2 mb-2.5">
        {features.map(f => {
          const isActive = f.key === mainKey;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => selectMain(f)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold cursor-pointer transition-colors"
              style={{
                background: isActive ? '#1A1028' : 'transparent',
                color: isActive ? '#fff' : '#6B6580',
                border: isActive ? '1px solid transparent' : '1px solid rgba(120,80,200,0.16)',
              }}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
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
