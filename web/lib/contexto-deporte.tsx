'use client';

import { createContext, useContext } from 'react';
import SelectorDeporte, { type Carpeta } from '@/components/ui/selector-deporte';

/**
 * El selector de deporte, disponible para las páginas.
 *
 * El estado vive en el panel, que es quien llama a `/me`, pero en móvil el
 * selector no siempre va en el mismo sitio: en los módulos va arriba del
 * contenido, y en Inicio tiene que ir **debajo** del encabezado morado, junto a
 * las fichas de resumen. Ahí arriba, encima del encabezado, se veía como una
 * pieza suelta que no pertenece a la pantalla.
 *
 * Se comparte por contexto y no por props porque entre el panel y la página hay
 * un `children` de por medio: pasarlo a mano obligaría a que cada página lo
 * recibiera y lo reenviara, aunque no lo use.
 */

export interface DatosDeporte {
  lista: Carpeta[];
  activo: string | null;
  puedeCambiar: boolean;
  onCambiar: (id: string) => void;
  cargarCifras: () => Promise<(Carpeta & { deportistas: number; sedes: number })[]>;
  onAgregar: (nombre: string) => Promise<void>;
}

const Contexto = createContext<DatosDeporte | null>(null);

export const ProveedorDeporte = Contexto.Provider;

/**
 * El nombre del deporte activo, para mostrarlo como dato y no como control.
 *
 * Lo usa Ajustes, donde el selector dejó de salir: ahí saber en qué carpeta
 * estás parado sigue sirviendo, pero cambiarla no, porque en esa pantalla no
 * hay nada que dependa del deporte.
 *
 * Fuera del proveedor devuelve `null` en vez de reventar, igual que el selector.
 */
export function useDeporteActivo(): string | null {
  const datos = useContext(Contexto);
  if (!datos) return null;
  return datos.lista.find(d => d.id === datos.activo)?.nombre ?? null;
}

/**
 * El selector en su versión de móvil, para colocarlo donde cada pantalla lo
 * necesite. Fuera del proveedor no revienta: no dibuja nada.
 */
export function SelectorDeporteMovil({ className = '' }: { className?: string }) {
  const datos = useContext(Contexto);
  if (!datos || datos.lista.length === 0) return null;
  return (
    <div className={`md:hidden ${className}`}>
      <SelectorDeporte
        deportes={datos.lista}
        activo={datos.activo}
        puedeCambiar={datos.puedeCambiar}
        colapsado={false}
        onCambiar={datos.onCambiar}
        cargarCifras={datos.cargarCifras}
        onAgregar={datos.onAgregar}
      />
    </div>
  );
}
