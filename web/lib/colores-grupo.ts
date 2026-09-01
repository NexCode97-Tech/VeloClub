/**
 * El color con el que se pinta cada grupo.
 *
 * Vive en un solo sitio porque lo usan tres pantallas —el horario semanal de
 * Ajustes, el calendario y el widget de Inicio— y un grupo que sale rojo en una
 * y verde en otra obliga a leer el nombre en cada una para saber cuál es.
 *
 * El color NO se guarda en la base. Sale de la posición del grupo en la lista
 * ordenada por nombre, que es la misma en todas partes porque `GET /grupos` la
 * devuelve así. Guardarlo obligaría a que alguien lo escogiera al crear el
 * grupo, y esa es una decisión que a un club no le aporta nada.
 */

/**
 * No es `PALETA_DEPORTES`, y la razón es de lectura, no de gusto.
 *
 * Aquel catálogo lleva un amarillo (`#F5F557`) y un azul muy claro (`#D6E0F0`)
 * que funcionan como relleno de un aro pero no como texto sobre blanco: la hora
 * de la clase va escrita en el color del grupo, y en esos dos no se lee.
 *
 * El orden tampoco es el mismo. Acá importa que dos grupos **seguidos** se
 * distingan, porque un club con dos grupos solo va a usar los dos primeros. Por
 * eso arranca rojo, azul, verde: el salto de tono más grande que hay, y no dos
 * morados parecidos como quedó la primera versión.
 */
const PALETA_GRUPOS = [
  '#C51111', // rojo
  '#132ED1', // azul
  '#117F2D', // verde
  '#EF7D0D', // naranja
  '#B0289C', // magenta
  '#0E7490', // petróleo
  '#6B2FBB', // morado
  '#71491E', // café
  '#3F474E', // pizarra
  '#A11D5C', // vino
] as const;

/**
 * @param id    id del grupo
 * @param todos ids de los grupos de la carpeta, en el orden que llegan de la API
 */
export function colorDeGrupo(id: string, todos: string[]): string {
  const i = todos.indexOf(id);
  // Un grupo que no está en la lista —recién creado, o de otra carpeta— toma el
  // primero antes que romper: el color es una ayuda de lectura, no un dato.
  return PALETA_GRUPOS[(i < 0 ? 0 : i) % PALETA_GRUPOS.length];
}

/** El mismo color al 10 %, para fondos suaves y pastillas. */
export function fondoDeGrupo(id: string, todos: string[]): string {
  return colorDeGrupo(id, todos) + '1A';
}
