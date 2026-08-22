'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Las acciones de un módulo, en la fila del título.
 *
 * El título de cada pantalla lo pinta el layout, no la página. Sin esto, un
 * módulo que necesita un botón propio tiene que dibujarse su propio encabezado
 * abajo, y el nombre termina saliendo dos veces: una en la barra y otra en la
 * página.
 *
 * Se resuelve con un portal a un hueco que el layout deja al lado del título.
 * La página declara qué botones quiere y aparecen arriba, sin que el layout
 * tenga que conocer a cada módulo.
 */

export const ID_ACCIONES = 'acciones-cabecera-superadmin';

export function AccionesCabecera({ children }: { children: React.ReactNode }) {
  // El hueco solo existe después de montar, así que el primer render no pinta
  // nada: buscarlo durante el render daría null en el servidor y rompería la
  // hidratación.
  const [hueco, setHueco] = useState<HTMLElement | null>(null);
  useEffect(() => { setHueco(document.getElementById(ID_ACCIONES)); }, []);

  return hueco ? createPortal(children, hueco) : null;
}
