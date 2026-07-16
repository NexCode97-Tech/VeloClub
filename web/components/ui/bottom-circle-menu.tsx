'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
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
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

// Arco hacia arriba — todos los ítems parten y regresan desde (0,0)
function pointOnArc(i: number, n: number, r: number) {
  // Ángulos más cerrados en la base para que los extremos no rocen el bar.
  // Con 5+ ítems se abre el arco para que no se solapen entre sí.
  const startDeg = n <= 1 ? -90 : n === 2 ? -115 : n >= 5 ? -150 : -140;
  const endDeg   = n <= 1 ? -90 : n === 2 ?  -65 : n >= 5 ?  -30 :  -40;
  const deg = n <= 1 ? -90 : startDeg + (endDeg - startDeg) * (i / (n - 1));
  const theta = deg * (Math.PI / 180);
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

// El radio crece con la cantidad de ítems para mantener separación uniforme
function radiusForCount(n: number) {
  return n >= 5 ? 150 : 130;
}

export function BottomCircleMenu({ items, pathname, isOpen, onToggle, onClose }: BottomCircleMenuProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => { onCloseRef.current(); }, [pathname]);

  function handleItemClick(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <>
      <div
        className="relative flex items-center justify-center"
        style={{ width: 56, height: 56, zIndex: 41 }}
      >
        {/* Ítems del arco */}
        <AnimatePresence>
          {isOpen && items.map((item, i) => {
            const { x, y } = pointOnArc(i, items.length, radiusForCount(items.length));
            const Icon = item.icon;
            return (
              <motion.button
                key={item.href}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x, y, opacity: 1, scale: 1 }}
                exit={{
                  x: 0, y: 0, opacity: 0, scale: 0.4,
                  transition: {
                    delay: (items.length - 1 - i) * 0.04,
                    type: 'spring',
                    stiffness: 340,
                    damping: 28,
                  },
                }}
                transition={{
                  delay: i * 0.04,
                  type: 'spring',
                  stiffness: 340,
                  damping: 28,
                }}
                onClick={() => handleItemClick(item.href)}
                className="absolute flex flex-col items-center cursor-pointer"
                style={{ willChange: 'transform', zIndex: 42 }}
              >
                <motion.div
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                  className="flex items-center justify-center"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 6px 22px ${item.color}70, 0 2px 8px rgba(0,0,0,0.12)`,
                  }}
                >
                  <Icon style={{ color: '#FFFFFF', width: 22, height: 22 }} strokeWidth={2.2} />
                </motion.div>

                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
                  transition={{ delay: i * 0.04 + 0.07, duration: 0.16, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                  className="mt-1.5 whitespace-nowrap font-semibold"
                  style={{
                    fontSize: 10,
                    color: '#FFFFFF',
                    letterSpacing: '-0.01em',
                    textShadow: '0 1px 6px rgba(0,0,0,0.45)',
                  }}
                >
                  {item.label}
                </motion.span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Botón central + / × */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
          onClick={onToggle}
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="relative flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: 56,
            height: 56,
            background: isOpen
              ? '#EF476F'
              : 'linear-gradient(135deg, #7C3AED 0%, #4361EE 100%)',
            boxShadow: isOpen
              ? '0 6px 24px rgba(239,71,111,0.48), 0 2px 8px rgba(0,0,0,0.10)'
              : '0 6px 24px rgba(124,58,237,0.48), 0 2px 8px rgba(0,0,0,0.10)',
            transition: 'background 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s cubic-bezier(0.23,1,0.32,1)',
            willChange: 'transform',
            zIndex: 43,
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              >
                <X className="w-5 h-5 text-white" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
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
