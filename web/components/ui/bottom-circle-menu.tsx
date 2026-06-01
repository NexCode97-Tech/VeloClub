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

// Abanico hacia arriba — abierto y bien elevado sobre el bar
function pointOnArc(i: number, n: number, r: number) {
  const startDeg = n <= 1 ? -90 : -152;
  const endDeg   = n <= 1 ? -90 : -28;
  const deg = n <= 1 ? -90 : startDeg + (endDeg - startDeg) * (i / (n - 1));
  const theta = deg * (Math.PI / 180);
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

// Radio mayor: más separación entre ítems y más altura sobre el bar
const RADIUS = 134;

export function BottomCircleMenu({ items, pathname, isOpen, onToggle, onClose }: BottomCircleMenuProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Cierra automáticamente al navegar
  useEffect(() => { onCloseRef.current(); }, [pathname]);

  function handleItemClick(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <>

      {/* Contenedor del botón + ítems */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 56, height: 56, zIndex: 41 }}
      >
        {/* Ítems del abanico */}
        <AnimatePresence>
          {isOpen && items.map((item, i) => {
            const { x, y } = pointOnArc(i, items.length, RADIUS);
            const Icon = item.icon;
            return (
              <motion.button
                key={item.href}
                initial={reducedMotion
                  ? { opacity: 0 }
                  : { x: 0, y: 0, opacity: 0, scale: 0.5 }
                }
                animate={reducedMotion
                  ? { opacity: 1 }
                  : { x, y, opacity: 1, scale: 1 }
                }
                exit={reducedMotion
                  ? { opacity: 0 }
                  : {
                      x: 0, y: 0, opacity: 0, scale: 0.5,
                      transition: {
                        delay: (items.length - 1 - i) * 0.045,
                        type: 'spring',
                        stiffness: 300,
                        damping: 24,
                      },
                    }
                }
                transition={reducedMotion
                  ? { duration: 0.15 }
                  : {
                      delay: i * 0.045,
                      type: 'spring',
                      stiffness: 300,
                      damping: 24,
                    }
                }
                onClick={() => handleItemClick(item.href)}
                className="absolute flex flex-col items-center cursor-pointer"
                style={{ willChange: 'transform', zIndex: 42 }}
              >
                {/* Burbuja del ícono — 56px, color sólido con ícono blanco */}
                <motion.div
                  whileHover={reducedMotion ? {} : { scale: 1.1, y: -2 }}
                  whileTap={reducedMotion ? {} : { scale: 0.94 }}
                  transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                  className="flex items-center justify-center"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 6px 24px ${item.color}70, 0 2px 8px rgba(0,0,0,0.12)`,
                  }}
                >
                  <Icon
                    style={{ color: '#FFFFFF', width: 22, height: 22 }}
                    strokeWidth={2.2}
                  />
                </motion.div>

                {/* Etiqueta debajo del ícono */}
                <motion.span
                  initial={reducedMotion ? {} : { opacity: 0, y: 4 }}
                  animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.045 + 0.08, duration: 0.18, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
                  className="mt-1.5 whitespace-nowrap font-bold"
                  style={{
                    fontSize: 10,
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-space-grotesk)',
                    letterSpacing: '-0.01em',
                    textShadow: '0 1px 6px rgba(0,0,0,0.40)',
                  }}
                >
                  {item.label}
                </motion.span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Botón "+" elevado — 56px, centrado en el bump */}
        <motion.button
          whileTap={reducedMotion ? {} : { scale: 0.94 }}
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
                initial={reducedMotion ? { opacity: 0 } : { rotate: -90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { rotate: 90, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }}
              >
                <X className="w-5 h-5 text-white" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={reducedMotion ? { opacity: 0 } : { rotate: 90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { rotate: -90, opacity: 0, scale: 0.7 }}
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
