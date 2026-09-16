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
        return;
      }
      metas.forEach(m => { if (m.content !== color) m.content = color; });
    };

    aplicar();

    // Y se vuelve a poner si algo la cambia. El framework reescribe la cabecera
    // al navegar, y sin esto el color duraba lo que tardara ese repintado.
    const vigia = new MutationObserver(aplicar);
    vigia.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['content'] });
    return () => vigia.disconnect();
  }, [pathname]);

  return null;
}
