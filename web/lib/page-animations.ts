import type { Variants } from 'framer-motion';

// Curva ease-out estándar de VeloClub (emilkowal-animations: ease-out-default)
export const EASE     = [0.23, 1, 0.32, 1]  as [number, number, number, number];
export const EASE_IN  = [0.55, 0, 1, 0.45] as [number, number, number, number];

// Contenedor que escalonea sus hijos
export const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

// Cada card / ítem individual
export const cardVariant: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: EASE } },
};

// Para formularios / paneles que expanden verticalmente
export const expandY: Variants = {
  hidden: { opacity: 0, height: 0,      overflow: 'hidden' },
  show:   { opacity: 1, height: 'auto', overflow: 'hidden', transition: { duration: 0.28, ease: EASE } },
  exit:   { opacity: 0, height: 0,      overflow: 'hidden', transition: { duration: 0.18, ease: EASE_IN } },
};

// Fade simple hacia arriba (para secciones completas)
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.26, ease: EASE } },
};
