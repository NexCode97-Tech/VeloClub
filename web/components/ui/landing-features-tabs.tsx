'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, type LucideIcon } from 'lucide-react';

// Easing/timing por la skill emilkowal-animations: ease-out fuerte para UI,
// duraciones cortas (<300ms). El indicador de tab usa layoutId para el
// deslizamiento tipo "pill" (spring), el panel de contenido usa fade+slide.
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export interface FeatureTab {
  icon: LucideIcon;
  label: string;
  desc: string;
  points: string[];
  color: string;
  bg: string;
}

export default function LandingFeaturesTabs({ features }: { features: FeatureTab[] }) {
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();
  const current = features[active];

  return (
    <div>
      {/* Tab bar — pill con indicador deslizante */}
      <div
        role="tablist"
        aria-label="Funcionalidades de VeloClub"
        className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-2xl p-1.5 mb-5"
        style={{ background: 'rgba(124,58,237,0.06)' }}
      >
        {features.map((f, i) => {
          const isActive = i === active;
          return (
            <button
              key={f.label}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className="relative flex-1 min-w-[92px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
              style={{ color: isActive ? '#fff' : '#5A5278' }}
            >
              {isActive && (
                <motion.div
                  layoutId="landing-feature-tab-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' }}
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <f.icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel de contenido — fade + slide sutil, ease-out corto */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[rgba(120,80,200,0.10)] shadow-sm" style={{ minHeight: 220 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="p-6 sm:p-7"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ background: current.bg }}
            >
              <current.icon className="w-5 h-5" style={{ color: current.color }} />
            </div>
            <p className="font-semibold text-[#1A1028] text-[17px] mb-1.5" style={{ fontFamily: 'Open Sans, sans-serif' }}>
              {current.label}
            </p>
            <p className="text-[13.5px] text-[#6B6580] leading-relaxed mb-5 max-w-md">
              {current.desc}
            </p>
            <ul className="space-y-2.5">
              {current.points.map(point => (
                <li key={point} className="flex items-center gap-2.5 text-[13px] text-[#3D3752]">
                  <span
                    className="w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 18, height: 18, background: current.bg }}
                  >
                    <Check className="w-2.5 h-2.5" style={{ color: current.color }} strokeWidth={3} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
