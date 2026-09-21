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

/**
 * `true` cuando el SDK de Mercado Pago ya esta cargado en la pagina.
 *
 * Puede haberse cargado en una navegacion anterior, y en ese caso el `onLoad`
 * del `<Script>` no vuelve a dispararse. Por eso no basta con escuchar ese
 * evento: hay que preguntarle al `window`. Se pregunta cada 300 ms hasta que
 * aparezca, y ahi se deja de preguntar.
 *
 * Va como almacen externo y no como estado con efecto porque eso es: algo que
 * vive fuera de React y que React consulta.
 */
export function useSdkMercadoPago(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      if (typeof window === 'undefined' || window.MercadoPago) return () => {};
      const iv = setInterval(() => {
        if (window.MercadoPago) { clearInterval(iv); avisar(); }
      }, 300);
      return () => clearInterval(iv);
    },
    () => typeof window !== 'undefined' && !!window.MercadoPago,
    () => false,
  );
}
