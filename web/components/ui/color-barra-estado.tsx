'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Color de la barra de estado según la pantalla. La clave es el inicio de la
// ruta; gana la coincidencia más larga, así /dashboard exacto puede ser violeta
// mientras el resto del panel queda gris claro.
const COLOR_POR_RUTA: Array<{ ruta: string; color: string; exacta?: boolean }> = [
  // Inicio: el encabezado es #381DA0 sólido, así que la barra lleva el mismo
  // color y las dos se leen como una sola pieza.
  { ruta: '/dashboard', color: '#381DA0', exacta: true },
  { ruta: '/dashboard', color: '#F7F7FB' },
  { ruta: '/superadmin', color: '#F7F7FB' },
  { ruta: '/sign-in', color: '#F7F7FB' },
  { ruta: '/sign-up', color: '#F7F7FB' },
  { ruta: '/onboarding', color: '#F7F7FB' },
  { ruta: '/crear-club', color: '#F7F7FB' },
  { ruta: '/completar-perfil', color: '#F7F7FB' },
];

// El landing es oscuro. Es también el valor de arranque del documento.
const COLOR_POR_DEFECTO = '#09090B';

function colorPara(pathname: string): string {
  let elegido: string | null = null;
  let largo = -1;
  for (const { ruta, color, exacta } of COLOR_POR_RUTA) {
    const coincide = exacta
      ? pathname === ruta
      : pathname === ruta || pathname.startsWith(`${ruta}/`);
    // La entrada exacta gana siempre: es la más específica que puede haber.
    if (coincide && (exacta || ruta.length > largo)) {
      if (exacta) return color;
      elegido = color;
      largo = ruta.length;
    }
  }
  return elegido ?? COLOR_POR_DEFECTO;
}

/**
 * Ajusta el color de la barra de estado a la pantalla que se está viendo.
 *
 * Hace tres cosas. Escribe la etiqueta `theme-color`, que Android respeta.
 * Enciende `viewport-fit=cover` dentro del panel, que es lo que deja que la
 * pagina llegue hasta el borde de arriba del telefono. Y deja el color en
 * `--vc-barra`, que es con lo que el panel pinta esa franja.
 *
 * En iPhone la franja no se le pide al navegador, se dibuja: con `cover` la
 * barra de estado queda dentro de la pagina y el panel le reserva el alto del
 * area segura. Pintar el fondo del documento no servia, porque esa franja no
 * era nuestra y el color terminaba saliendo en la barra de abajo.
 *
 * Es el **único** sitio que escribe `theme-color`. El `viewport` de
 * `app/layout.tsx` lo declaraba también, y como Next reescribe esas etiquetas
 * al cambiar de ruta, pisaba lo que este componente acababa de poner.
 *
 * En Android la barra toma este color y el sistema decide si el reloj va en
 * claro u oscuro según el contraste. En iPhone el comportamiento depende de la
 * versión: las recientes lo respetan, las viejas dejan la barra blanca. No se
 * usa apple-mobile-web-app-status-bar-style a propósito: ese ajuste se lee una
 * sola vez al abrir la app y vale para toda la aplicación, así que no sirve
 * para cambiar de color pantalla por pantalla.
 */
export function ColorBarraEstado() {
  const pathname = usePathname();

  useEffect(() => {
    const color = colorPara(pathname || '/');

    // El panel es el unico que se mete debajo de la barra de estado. Ahi la
    // franja es nuestra y la pintamos nosotros; en el resto del sitio la
    // pagina arranca debajo, como siempre.
    const cubreLaBarra = (pathname || '/').startsWith('/dashboard');

    const aplicar = () => {
      // Todas y no la primera. Si alguna vez quedan dos etiquetas, el navegador
      // se queda con la última, así que actualizarlas todas es lo único que
      // garantiza que la que mande tenga el color correcto.
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      if (metas.length === 0) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = color;
        document.head.appendChild(meta);
      } else {
        metas.forEach(m => { if (m.content !== color) m.content = color; });
      }

      // `viewport-fit=cover` es lo que deja que la pagina llegue hasta el borde
      // de arriba del telefono. Sin el, la franja de la barra de estado no es
      // nuestra y la pinta el navegador con lo que se le antoje: por eso el
      // color del fondo del documento terminaba saliendo abajo, en la barra de
      // la direccion, en vez de arriba.
      //
      // Se enciende solo en el panel. En la landing y en el resto, encenderlo
      // metería el contenido debajo del reloj en todas las pantallas.
      const vp = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (vp) {
        const base = vp.content.replace(/,?\s*viewport-fit=[\w-]+/g, '').replace(/,\s*$/, '').trim();
        const quiero = cubreLaBarra ? `${base}, viewport-fit=cover` : base;
        if (vp.content !== quiero) vp.content = quiero;
      }
    };

    aplicar();

    // El color de la franja. El panel la pinta con esta variable; asi el
    // encabezado morado de Inicio y la barra de estado se leen como una sola
    // pieza, y en los demas modulos la franja vuelve al gris del fondo.
    document.documentElement.style.setProperty('--vc-barra', color);

    // Y se vuelve a poner si algo la cambia. El framework reescribe la cabecera
    // al navegar, y sin esto el color duraba lo que tardara ese repintado.
    const vigia = new MutationObserver(aplicar);
    vigia.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
    return () => vigia.disconnect();
  }, [pathname]);

  return null;
}
