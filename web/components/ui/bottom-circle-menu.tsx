'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface CircleMenuItem {
  label: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

interface BottomCircleMenuProps {
  items: CircleMenuItem[];
  pathname: string; // cierra el menú al navegar
}

// Distribuye los ítems en un abanico hacia arriba
function pointOnArc(i: number, n: number, r: number) {
  const startDeg = n <= 1 ? -90 : -155;
  const endDeg   = n <= 1 ? -90 : -25;
  const deg = n <= 1 ? -90 : startDeg + (endDeg - startDeg) * (i / (n - 1));
  const theta = deg * (Math.PI / 180);
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

const RADIUS = 96;

export function BottomCircleMenu({ items, pathname }: BottomCircleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Cierra al navegar
  useEffect(() => { setIsOpen(false); }, [pathname]);

  function handleItemClick(href: string) {
    setIsOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Overlay — cierra al tocar fuera */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[35]"
            style={{ background: 'rgba(26,16,40,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Contenedor relativo al botón */}
      <div className="relative flex items-center justify-center" style={{ width: 52, height: 52, zIndex: 41 }}>

        {/* Ítems del abanico */}
        <AnimatePresence>
          {isOpen && items.map((item, i) => {
            const { x, y } = pointOnArc(i, items.length, RADIUS);
            const Icon = item.icon;
            return (
              <motion.button
                key={item.href}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x, y, opacity: 1, scale: 1 }}
                exit={{
                  x: 0, y: 0, opacity: 0, scale: 0.4,
                  transition: {
                    delay: (items.length - 1 - i) * 0.035,
                    duration: 0.18,
                    ease: [0.23, 1, 0.32, 1],
                  },
                }}
                transition={{
                  delay: i * 0.045,
                  type: 'spring',
                  stiffness: 340,
                  damping: 26,
                }}
                onClick={() => handleItemClick(item.href)}
                className="absolute flex flex-col items-center cursor-pointer"
                style={{ willChange: 'transform' }}
              >
                {/* Burbuja del ícono */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: `${item.color}1E`,
                    border: `1.5px solid ${item.color}40`,
                    boxShadow: `0 4px 16px ${item.color}30`,
                  }}
                >
                  <Icon className="w-[18px] h-[18px]" style={{ color: item.color }} strokeWidth={2.2} />
                </motion.div>
                {/* Etiqueta */}
                <span
                  className="text-[9px] font-bold mt-1 whitespace-nowrap"
                  style={{ color: '#1A1028', fontFamily: 'var(--font-space-grotesk)', textShadow: '0 1px 4px rgba(255,255,255,0.8)' }}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Botón "+" elevado */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
          onClick={() => setIsOpen(v => !v)}
          className="relative flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: 52,
            height: 52,
            background: isOpen
              ? '#EF476F'
              : 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)',
            boxShadow: isOpen
              ? '0 6px 24px rgba(239,71,111,0.50), 0 2px 8px rgba(0,0,0,0.12)'
              : '0 6px 24px rgba(124,58,237,0.50), 0 2px 8px rgba(0,0,0,0.12)',
            transition: 'background 0.22s ease, box-shadow 0.22s ease',
            willChange: 'transform',
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                <X className="w-5 h-5 text-white" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
