/**
 * El color con el que se pinta cada clase.
 *
 * Vive en un solo sitio porque lo usan tres pantallas —el horario semanal de
 * Ajustes, el calendario y el widget de Inicio— y una clase que sale roja en
 * una y verde en otra obliga a leer el nombre en cada una para saber cuál es.
 *
 * Manda el color guardado. Cuando no hay ninguno —el caso de todo lo que existía
 * antes de que se pudiera escoger— sale de la posición de su NOMBRE en la lista
 * ordenada. Por el nombre y no por el id para que la clase de la mañana del
 * lunes y la del miércoles salgan del mismo color: son la misma clase dos veces
 * en la semana, y verlas de colores distintos es leerlas como dos cosas.
 */

/**
 * No lleva rojo ni azul, y las dos razones son de lectura, no de gusto.
 *
 * **Rojo y azul están reservados.** El calendario ya los usa para decir de qué
 * tipo es un evento: rojo es competencia, azul es entrenamiento, y su leyenda lo
 * declara. Si una clase pudiera ser roja, un punto rojo en el calendario dejaría
 * de significar «competencia» y la leyenda estaría mintiendo.
 *
 * **Y el amarillo y el azul claro tampoco sirven.** La hora de la clase va
 * escrita en su color, y sobre blanco no se leen.
 *
 * El orden importa porque un club con dos clases solo va a usar las dos
 * primeras: arranca verde, naranja, morado, que es el salto de tono más grande
 * que queda una vez fuera el rojo y el azul.
 */
const PALETA = [
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

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Los nombres de clase de un horario, sin repetir y ordenados.
 *
 * Es la lista contra la que se resuelve el color de respaldo, y tiene que ser la
 * misma en todas las pantallas: si cada una armara la suya con las clases que
 * tiene a mano, dos clases sin color escogido caerían las dos en el primero de
 * la paleta y saldrían iguales.
 */
export function nombresDeClase(clases: { nombre: string }[]): string[] {
  return [...new Set(clases.map(c => c.nombre.trim()))].sort((a, b) => a.localeCompare(b));
}

/**
 * El color de una clase: el suyo si lo escogieron, si no el de su nombre.
 *
 * @param nombres el resultado de `nombresDeClase` sobre el horario completo
 */
export function colorDeClase(
  clase: { nombre: string; color?: string | null },
  nombres: string[],
): string {
  if (clase.color && HEX.test(clase.color)) return clase.color;
  const i = nombres.indexOf(clase.nombre.trim());
  // Una clase que no está en la lista —recién creada— toma la primera antes que
  // romper: el color es una ayuda de lectura, no un dato.
  return PALETA[(i < 0 ? 0 : i) % PALETA.length];
}
