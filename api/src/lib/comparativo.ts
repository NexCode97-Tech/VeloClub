/**
 * Cortes para comparar un mes con el anterior «al mismo día».
 *
 * Las tarjetas de Finanzas dicen cómo va el mes frente al anterior. Comparar el
 * 17 de septiembre contra agosto completo castiga al mes en curso, que apenas
 * va por la mitad; por eso se corta el mes anterior en el mismo día.
 *
 * Los meses no miden lo mismo, y de ahí salen dos reglas:
 *   - El día del mes anterior nunca pasa de su último día: el 30 de marzo se
 *     compara contra el 28 de febrero.
 *   - El último día de un mes se compara contra el mes anterior completo: el
 *     30 de septiembre contra el 31 de agosto, no contra el 30.
 *
 * Un mes que ya cerró se compara completo contra el anterior completo, porque
 * la cifra que se ve en pantalla ya es la del mes entero.
 *
 * Todo en hora de Colombia, que es la del club. El servidor corre en UTC, y a
 * las 9 de la noche del día 1 en Bogotá allá ya es el día 2.
 */

// Colombia no tiene horario de verano: el desfase es fijo.
const DESFASE_COLOMBIA_MS = 5 * 3600 * 1000;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface Cortes {
  /** Fin del día de corte del mes consultado, como instante UTC. */
  actual: Date;
  /** Fin del día de corte del mes anterior, como instante UTC. */
  anterior: Date;
  /** Contra qué se compara, para mostrar: «17 ago» o «agosto». */
  etiqueta: string;
  /** El mes consultado ya terminó y se compara completo. */
  mesCerrado: boolean;
}

function diasDelMes(anio: number, mes: number): number {
  // Día 0 del mes siguiente = último día de este.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** 23:59:59.999 del día dado en Colombia, como instante UTC. */
function finDelDia(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia, 23, 59, 59, 999) + DESFASE_COLOMBIA_MS);
}

/**
 * Los dos cortes para comparar `mes`/`anio` con su mes anterior.
 * Devuelve null si el mes todavía no empieza: no hay nada que comparar.
 */
export function cortesComparativo(anio: number, mes: number, ahora: Date = new Date()): Cortes | null {
  const local = new Date(ahora.getTime() - DESFASE_COLOMBIA_MS);
  const anioHoy = local.getUTCFullYear();
  const mesHoy = local.getUTCMonth() + 1;
  const diaHoy = local.getUTCDate();

  const clave = anio * 12 + mes;
  const claveHoy = anioHoy * 12 + mesHoy;
  if (clave > claveHoy) return null;

  const anioAnt = mes === 1 ? anio - 1 : anio;
  const mesAnt = mes === 1 ? 12 : mes - 1;
  const diasAnt = diasDelMes(anioAnt, mesAnt);

  const mesCerrado = clave < claveHoy;
  const esUltimoDia = !mesCerrado && diaHoy === diasDelMes(anio, mes);

  if (mesCerrado || esUltimoDia) {
    return {
      actual: finDelDia(anio, mes, mesCerrado ? diasDelMes(anio, mes) : diaHoy),
      anterior: finDelDia(anioAnt, mesAnt, diasAnt),
      etiqueta: MESES[mesAnt - 1],
      mesCerrado,
    };
  }

  const diaAnt = Math.min(diaHoy, diasAnt);
  return {
    actual: finDelDia(anio, mes, diaHoy),
    anterior: finDelDia(anioAnt, mesAnt, diaAnt),
    etiqueta: `${diaAnt} ${MESES_CORTOS[mesAnt - 1]}`,
    mesCerrado: false,
  };
}

/**
 * Cambio porcentual redondeado. Null cuando el mes anterior no tuvo ninguno:
 * pasar de 0 a 5 no es un porcentaje, y un «+∞%» no le dice nada a nadie.
 */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
