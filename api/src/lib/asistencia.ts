/**
 * Resumen de asistencia de un deportista en un rango.
 *
 * El criterio del porcentaje es una decision de negocio, no un detalle tecnico:
 * es el numero que el club le muestra a un padre o le entrega a una liga.
 *
 * - Llegar tarde sigue siendo entrenar, asi que la tardanza cuenta como
 *   asistencia.
 * - La excusa medica no resta: sale de la base en vez de contar como falta,
 *   para no castigar a un lesionado.
 */

export interface ResumenAsistencia {
  presentes: number;
  tardanzas: number;
  ausencias: number;
  excusas: number;
  /** null cuando no hay base de calculo. Nunca 0. */
  porcentaje: number | null;
}

export function resumirAsistencia(estados: string[]): ResumenAsistencia {
  const presentes = estados.filter(e => e === 'PRESENT').length;
  const tardanzas = estados.filter(e => e === 'LATE').length;
  const ausencias = estados.filter(e => e === 'ABSENT').length;
  const excusas   = estados.filter(e => e === 'MEDICAL_EXCUSE').length;

  const base = estados.length - excusas;
  // Si a alguien le excusaron todos los dias, un 0% diria exactamente lo
  // contrario de lo que paso. Sin base no hay porcentaje que reportar.
  const porcentaje = base > 0 ? Math.round(((presentes + tardanzas) / base) * 100) : null;

  return { presentes, tardanzas, ausencias, excusas, porcentaje };
}
