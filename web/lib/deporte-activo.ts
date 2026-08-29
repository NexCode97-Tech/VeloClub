/**
 * En qué carpeta de deporte está parado el dashboard.
 *
 * Vive en una variable de módulo y no en un contexto de React porque quien la
 * necesita es `apiFetch`, y a `apiFetch` la llaman también desde fuera de un
 * componente. Un contexto obligaría a pasar el valor a mano en cada llamada, y
 * la llamada que se olvidara pediría los datos de la carpeta equivocada.
 *
 * Se guarda además en el navegador para que volver mañana devuelva al deporte
 * donde estabas, y no al primero de la lista.
 *
 * El valor es una PREFERENCIA, no un permiso. El backend lo toma como una
 * sugerencia: si no corresponde, entra igual pero a la carpeta que sí le toca a
 * quien pregunta. Por eso un valor viejo aquí no rompe nada.
 */

const CLAVE = 'veloclub:deporte';

let enMemoria: string | null = null;
let leido = false;

export function deporteActivo(): string | null {
  if (typeof window === 'undefined') return null;
  if (!leido) {
    try {
      enMemoria = window.localStorage.getItem(CLAVE);
    } catch {
      // Navegador con el almacenamiento bloqueado: se trabaja solo en memoria.
    }
    leido = true;
  }
  return enMemoria;
}

export function fijarDeporteActivo(id: string | null): void {
  enMemoria = id;
  leido = true;
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(CLAVE, id);
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba: sin almacenamiento la elección dura lo que la pestaña.
  }
}
