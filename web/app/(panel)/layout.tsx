import type { Viewport } from 'next';
import Panel from './panel';

/**
 * El panel declara su propio viewport.
 *
 * Esto es lo único que vive acá, y por eso este archivo es de servidor: Next
 * ignora los `export const viewport` de un componente de cliente, y el panel
 * entero lo es. Antes se intentó encender `viewport-fit` desde JavaScript,
 * escribiendo la etiqueta después de cargar la página, y Safari no lo aplica:
 * ese ajuste lo lee una sola vez, cuando parsea el documento.
 *
 * `viewport-fit=cover` es lo que deja que la página llegue hasta el borde de
 * arriba del teléfono, debajo del reloj. Va solo acá y no en el layout raíz
 * porque en la landing y en las pantallas de cuenta metería el contenido
 * debajo del reloj sin que nadie le haya reservado ese alto.
 *
 * El alto lo reserva el panel, y el color de esa franja lo pone
 * `ColorBarraEstado` en `--vc-barra`.
 *
 * `(panel)` entre paréntesis es un grupo de rutas: agrupa los módulos para que
 * compartan este armazón sin aportar nada a la dirección. Por eso Miembros es
 * `/miembros` y no `/panel/miembros`.
 *
 * Acá **no** va `themeColor`, aunque el gris sea el color de casi todos los
 * módulos. En el HTML del servidor ganaba el morado que declara Inicio, por ser
 * más profundo, pero al hidratarse la página esas etiquetas se vuelven a
 * escribir y el gris alcanzaba a quedar de último: la barra de estado salía
 * morada medio segundo y se pasaba a gris. El color lo pone `ColorBarraEstado`,
 * que es una sola mano y ya sabe qué le toca a cada ruta.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function LayoutDelPanel({ children }: { children: React.ReactNode }) {
  return <Panel>{children}</Panel>;
}
