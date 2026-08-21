/**
 * Catalogos cerrados de un deportista.
 *
 * Espejo de web/lib/categorias.ts. Se repiten a proposito en vez de compartir
 * un paquete: son dos despliegues distintos y una constante de tres lineas no
 * justifica un workspace compartido. Lo que si importa es que digan exactamente
 * lo mismo, letra por letra.
 *
 * Son cerrados y no texto libre porque la categoria se compara caracter a
 * caracter contra la del miembro para armar la planilla de una clase. Escribir
 * "Menores" donde el miembro dice "Menores 3-10 años" no da error: da una lista
 * vacia, que es peor porque nadie se entera.
 */

export const CATEGORIAS = [
  'Menores 3-10 años',
  'Transición 11-13 años',
  'Mayores 14+ años',
] as const;

export const NIVELES = [
  'Escuela',
  'Novatos',
  'Intermedio',
  'Avanzados',
  'Federados',
  'Adultos',
] as const;

export type Categoria = typeof CATEGORIAS[number];
export type Nivel = typeof NIVELES[number];

export function esCategoriaValida(valor: string): boolean {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

export function esNivelValido(valor: string): boolean {
  return (NIVELES as readonly string[]).includes(valor);
}
