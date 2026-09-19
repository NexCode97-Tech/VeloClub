import { useCallback, useSyncExternalStore } from 'react';

/**
 * Una preferencia de si o no guardada en el navegador.
 *
 * El problema que resuelve: `localStorage` no existe en el servidor. Leerlo
 * durante el render rompe la hidratacion, porque el servidor pintaria una cosa
 * y el navegador otra. La salida de siempre era arrancar en falso y corregir en
 * un efecto, que obliga a pintar dos veces y deja ver un parpadeo.
 *
 * `useSyncExternalStore` esta hecho justo para esto: da una respuesta para el
 * servidor y otra para el navegador, y React sabe reconciliarlas.
 *
 * Se avisa a mano al guardar, con un evento propio, porque `storage` solo salta
 * en las otras pestañas y no en la que escribio.
 */

const EVENTO = 'velo:bandera-local';

function suscribirse(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener('storage', avisar);
  };
}

/** Guarda la preferencia y avisa a quien la este mirando. */
export function guardarBanderaLocal(clave: string, valor: boolean) {
  try {
    localStorage.setItem(clave, valor ? '1' : '0');
  } catch { /* modo privado o almacenamiento bloqueado: no es motivo de error */ }
  window.dispatchEvent(new Event(EVENTO));
}

export function useBanderaLocal(clave: string, encendidoEs = '1'): boolean {
  const leer = useCallback(() => {
    try {
      return localStorage.getItem(clave) === encendidoEs;
    } catch {
      return false;
    }
  }, [clave, encendidoEs]);

  return useSyncExternalStore(suscribirse, leer, () => false);
}
