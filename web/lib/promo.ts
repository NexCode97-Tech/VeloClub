// Promoción de lanzamiento: 2 meses gratis.
//
// Esta fecha es el espejo de PROMO_FIN en api/src/routes/clubs.ts. Tiene que ser
// la misma: si el frontend la anuncia un día más que el backend, alguien se
// registra confiando en los 60 días y recibe 15.
//
// El corte es a medianoche del 1 de noviembre en hora de Colombia, así que un
// club que entre el 31 de octubre a las 11 de la noche todavía alcanza.
export const PROMO_FIN = new Date('2026-11-01T00:00:00-05:00');

/** Milisegundos que faltan para que cierre la promoción. 0 si ya venció. */
export function restantePromo(ahora: number = Date.now()): number {
  return Math.max(0, PROMO_FIN.getTime() - ahora);
}

/** Descompone lo que falta en días, horas y minutos. */
export function desglosarRestante(ms: number): { dias: number; horas: number; minutos: number } {
  const totalMinutos = Math.floor(ms / 60_000);
  return {
    dias:    Math.floor(totalMinutos / 1440),
    horas:   Math.floor((totalMinutos % 1440) / 60),
    minutos: totalMinutos % 60,
  };
}
