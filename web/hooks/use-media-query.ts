import { useCallback, useSyncExternalStore } from 'react';

/**
 * Sigue una media query del navegador.
 *
 * Se lee directo de `matchMedia` en vez de copiarlo a un estado con un efecto.
 * Copiarlo obligaba a pintar dos veces —una con el valor por defecto y otra ya
 * con el de verdad—, que es lo que se ve como un salto al cargar en pantallas
 * angostas.
 *
 * En el servidor devuelve `false`: alli no hay pantalla que medir, y el valor
 * de verdad llega en cuanto el navegador toma el control.
 */
export function useMediaQuery(consulta: string): boolean {
  const suscribir = useCallback((avisar: () => void) => {
    const mql = window.matchMedia(consulta);
    mql.addEventListener('change', avisar);
    return () => mql.removeEventListener('change', avisar);
  }, [consulta]);

  const leer = useCallback(() => window.matchMedia(consulta).matches, [consulta]);

  return useSyncExternalStore(suscribir, leer, () => false);
}
