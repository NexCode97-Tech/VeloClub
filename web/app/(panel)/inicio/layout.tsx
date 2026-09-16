import type { Viewport } from 'next';

/**
 * Inicio declara el color de su barra de estado.
 *
 * Es la única pantalla del panel cuyo encabezado es morado sólido, así que la
 * barra de arriba lleva el mismo color y las dos se leen como una sola pieza.
 * El resto de módulos hereda el gris del panel.
 *
 * Va en el HTML que llega del servidor, no escrito desde JavaScript después de
 * cargar. Esa era la diferencia con la pantalla de carga, que sí pintaba bien:
 * su color venía declarado de entrada.
 */
export const viewport: Viewport = {
  themeColor: '#381DA0',
};

export default function LayoutDeInicio({ children }: { children: React.ReactNode }) {
  return children;
}
