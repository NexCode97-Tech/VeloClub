'use client';

/**
 * Extrae el id del club de la ruta. Devuelve null fuera del detalle de un club,
 * incluida la lista, para que el sidebar sepa cuando volver a su forma global.
 *
 * El sidebar vive en el layout y la pantalla del club una capa mas abajo, asi
 * que no puede leerle el estado: la ruta es lo unico que ambas capas comparten.
 * Con mostrar solo los modulos alcanza con el id; si algun dia el sidebar
 * necesita el nombre o el logo, la pantalla tendra que publicarlos por contexto.
 */
export function idClubDeRuta(pathname: string): string | null {
  const m = pathname.match(/^\/superadmin\/clubs\/([^/]+)/);
  return m ? m[1] : null;
}
