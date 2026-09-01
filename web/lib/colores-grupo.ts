/**
 * El color con el que se pinta cada grupo.
 *
 * Vive en un solo sitio porque lo usan tres pantallas —el horario semanal de
 * Ajustes, el calendario y el widget de Inicio— y un grupo que sale rojo en una
 * y verde en otra obliga a leer el nombre en cada una para saber cuál es.
 *
 * Manda el color guardado. Cuando no hay ninguno —que es el caso de todo lo que
 * existía antes de que se pudiera escoger— sale de la posición del grupo en la
 * lista ordenada por nombre. Ese orden tiene que ser el mismo en todas partes o
 * el respaldo deja de coincidir entre pantallas, y para eso está
 * `gruposDeClases`: nadie ordena la lista a mano.
 */

/**
 * No es `PALETA_DEPORTES`, y no lleva rojo ni azul. Las dos razones son de
 * lectura, no de gusto.
 *
 * **Rojo y azul están reservados.** El calendario ya los usa para decir de qué
 * tipo es un evento: rojo es competencia, azul es entrenamiento, y su leyenda lo
 * declara. Si un grupo pudiera ser rojo, un punto rojo en el calendario dejaría
 * de significar «competencia» y la leyenda estaría mintiendo.
 *
 * **Y el amarillo y el azul claro de `PALETA_DEPORTES` tampoco sirven.** La hora
 * de la clase va escrita en el color del grupo, y sobre blanco no se leen.
 *
 * El orden importa porque un club con dos grupos solo va a usar los dos
 * primeros: arranca verde, naranja, morado, que es el salto de tono más grande
 * que queda una vez fuera el rojo y el azul.
 */
const PALETA_GRUPOS = [
  '#117F2D', // verde
  '#EF7D0D', // naranja
  '#6B2FBB', // morado
  '#0E7490', // petróleo
  '#B0289C', // magenta
  '#71491E', // café
  '#3F474E', // pizarra
  '#A11D5C', // vino
  '#0A6E5E', // esmeralda
  '#7A5C00', // mostaza oscuro
] as const;

/**
 * El color de un grupo.
 *
 * Manda el que alguien escogió y guardó. La posición en la lista es solo el
 * respaldo para los que nunca lo escogieron, y hay que decir por qué no basta:
 * si el color saliera siempre de la posición, renombrar un grupo reordenaría la
 * lista y **todos** cambiarían de color de golpe, sin que nadie lo pidiera.
 *
 * @param id       id del grupo
 * @param todos    ids de los grupos de la carpeta, en el orden que llegan de la API
 * @param guardado el color que el grupo tiene puesto, si tiene
 */
export function colorDeGrupo(id: string, todos: string[], guardado?: string | null): string {
  if (guardado && /^#[0-9a-fA-F]{6}$/.test(guardado)) return guardado;
  const i = todos.indexOf(id);
  // Un grupo que no está en la lista —recién creado, o de otra carpeta— toma el
  // primero antes que romper: el color es una ayuda de lectura, no un dato.
  return PALETA_GRUPOS[(i < 0 ? 0 : i) % PALETA_GRUPOS.length];
}

/**
 * El color de una clase: el suyo si lo escogieron, si no el de su grupo.
 *
 * Una clase sin grupo no hereda de nadie, así que va en gris. Se ve distinta a
 * propósito: es la que todavía arma su lista con la regla vieja.
 */
export function colorDeClase(
  clase: { color?: string | null; grupoId?: string | null },
  grupos: { id: string; color?: string | null }[],
): string {
  if (clase.color && /^#[0-9a-fA-F]{6}$/.test(clase.color)) return clase.color;
  if (!clase.grupoId) return '#8E87A8';
  const g = grupos.find(x => x.id === clase.grupoId);
  return colorDeGrupo(clase.grupoId, grupos.map(x => x.id), g?.color);
}

/**
 * Los grupos que salen de un horario, sin nombre repetido y ordenados como los
 * ordena la API.
 *
 * Existe porque el color de respaldo depende de la POSICIÓN en la lista, y cada
 * pantalla armaba la suya: el horario la pedía a `GET /grupos` y el calendario
 * la deducía de las clases una por una, con lo que dos grupos sin color
 * escogido caían los dos en el primero de la paleta y salían iguales. Ahora las
 * dos pantallas arman la lista acá, con el mismo criterio que la API: por
 * nombre.
 */
export function gruposDeClases<G extends { id: string; nombre: string; color?: string | null }>(
  clases: { grupo?: G | null }[],
): G[] {
  const vistos = new Map<string, G>();
  for (const c of clases) if (c.grupo && !vistos.has(c.grupo.id)) vistos.set(c.grupo.id, c.grupo);
  return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** El mismo color al 10 %, para fondos suaves y pastillas. */
export function fondoDeGrupo(id: string, todos: string[]): string {
  return colorDeGrupo(id, todos) + '1A';
}
