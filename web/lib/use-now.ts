'use client';

import { useEffect, useState } from 'react';

/**
 * Devuelve la hora actual y re-renderiza el componente cada `intervalMs`.
 * Útil para contadores derivados de una fecha (ej: días restantes de un trial)
 * que deben actualizarse en tiempo real sin que el usuario refresque la página.
 *
 * Para un contador de días, 30s es más que suficiente: el valor cambia como
 * máximo una vez al día y se refleja a los pocos segundos de cruzar el límite.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
