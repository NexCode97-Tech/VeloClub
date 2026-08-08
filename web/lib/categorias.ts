// Categorias y niveles de un deportista.
//
// Son un catalogo cerrado, no texto libre: la categoria se compara letra por
// letra contra la del miembro para armar la planilla de una clase y para
// filtrar en Miembros. Escribir "Menores" a mano donde el miembro dice
// "Menores 3-10 años" no da error — da una lista vacia, que es peor.
//
// Estaban repetidas en el formulario de Miembros y en la plantilla de Excel,
// y cualquier cambio habia que acordarse de hacerlo en los dos lados.

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
