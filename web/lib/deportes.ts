/**
 * Los deportes que un club puede abrir.
 *
 * Es un catálogo cerrado y no texto libre, por tres razones que se notan:
 *
 * 1. El nombre es la llave del ícono. Escrito a mano, «Natacion», «natación» y
 *    «NATACION» son tres cosas distintas y ninguna encuentra su dibujo.
 * 2. Un club con dos administradores termina con «Fútbol» y «futbol» como dos
 *    carpetas separadas, y nadie entiende por qué la gente está repartida.
 * 3. Escribir el nombre de un deporte es trabajo que la aplicación puede
 *    ahorrarse: son doce, caben en una lista.
 *
 * Es la misma lista que ofrece el registro de club en `app/onboarding`, sin
 * «Otro»: ahí «Otro» solo llena un campo de texto del club, aquí crearía una
 * carpeta con un nombre que después no se puede corregir sin mover gente.
 */

export const DEPORTES = [
  'Fútbol',
  'Microfútbol',
  'Natación',
  'Atletismo',
  'Ciclismo',
  'Ciclomontañismo',
  'Patinaje',
  'Baloncesto',
  'Voleibol',
  'Tenis',
  'Boxeo',
  'Gimnasia',
] as const;

export type Deporte = typeof DEPORTES[number];

/** Compara nombres de deporte ignorando tildes y mayúsculas. */
export function mismoDeporte(a: string, b: string): boolean {
  const limpiar = (v: string) =>
    v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return limpiar(a) === limpiar(b);
}
