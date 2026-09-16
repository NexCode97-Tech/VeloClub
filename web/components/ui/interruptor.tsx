'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * El interruptor deslizante de la plataforma.
 *
 * Vivía dentro de la tarjeta de suscripción, que era el único sitio que lo
 * necesitaba. Al salir el segundo —la marca de agua del carnet— se sacó acá:
 * dos interruptores dibujados aparte terminan con distinto tamaño y distinto
 * verde, que es el error que más veces ha aparecido en este proyecto con los
 * íconos.
 *
 * El verde del encendido no es decorativo. Es el mismo `#06D6A0` del acento de
 * entrenador y el que la plataforma usa para «esto está activo».
 */

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Obligatorio: un interruptor sin nombre no se puede leer en voz alta. */
  etiqueta: string;
}

export function Interruptor({ checked, onChange, disabled, etiqueta }: Props) {
  const reduce = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 flex items-center"
      style={{
        width: 46, height: 26, borderRadius: 999, padding: 3,
        justifyContent: checked ? 'flex-end' : 'flex-start',
        background: checked ? '#06D6A0' : 'rgba(120,80,200,0.22)',
        transition: 'background 0.22s cubic-bezier(0.23,1,0.32,1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.span
        layout
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
        style={{
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.28)', display: 'block',
        }}
      />
    </button>
  );
}
