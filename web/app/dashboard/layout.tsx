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
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Panel>{children}</Panel>;
}
