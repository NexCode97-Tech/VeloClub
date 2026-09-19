import { useSyncExternalStore } from 'react';

// Nada a lo que suscribirse: la respuesta no cambia durante la vida de la
// pagina. Se declara afuera para que sea la misma funcion en cada render.
const sinCambios = () => () => {};
const enElNavegador = () => true;
const enElServidor = () => false;

/**
 * `true` solo cuando la pagina ya vive en el navegador.
 *
 * Es lo que hace falta para pintar un portal: el hueco donde va no existe
 * mientras el servidor arma el HTML, y preguntarle al `document` durante el
 * render rompe la hidratacion, porque el servidor y el navegador dirian cosas
 * distintas.
 *
 * Antes cada componente llevaba su `const [montado, setMontado] = useState(false)`
 * con un efecto que lo encendia. Funcionaba, pero obliga a pintar dos veces y
 * las reglas del compilador de React lo marcan. `useSyncExternalStore` es la
 * pieza que React trae justo para esto: da una respuesta para el servidor y
 * otra para el navegador, sin efecto de por medio.
 */
export function useEsCliente(): boolean {
  return useSyncExternalStore(sinCambios, enElNavegador, enElServidor);
}
