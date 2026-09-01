/**
 * Quien entra a la planilla de una clase.
 *
 * Existe para que la regla se escriba una sola vez. Estaba en dos sitios —el
 * reporte del backend y la pantalla de asistencia— y cualquier cambio habia que
 * acordarse de hacerlo en los dos, que es exactamente como se desincronizan.
 *
 * La regla, completa:
 *
 *   la sede de la clase, cruzada con su categoria.
 *
 * Hubo una segunda regla —una lista de deportistas marcada a mano por clase— y
 * se quito a proposito. Resolvia un caso real, el club que parte en mañana y
 * tarde sin que la edad los separe, pero costaba una pantalla mas, un campo mas
 * en el formulario de inscripcion y una columna mas en el Excel, y obligaba a
 * mantener a mano lo que la categoria ya dice. Un club que necesite separar dos
 * clases le pone categorias distintas.
 */

export interface ClaseDeLaPlanilla {
  locationId: string | null;
  categoria:  string | null;
}

/**
 * El `where` de Prisma para `member.findMany`.
 *
 * No lleva `clubId` ni `deporteId`: esos los pone el alcance por su cuenta
 * (`api/src/lib/alcance.ts`). Escribirlos aca ademas seria repetirlos, y
 * repetir un filtro de aislamiento es como se terminan desviando uno del otro.
 */
export function filtroDePlanilla({ locationId, categoria }: ClaseDeLaPlanilla) {
  // Un deportista en pausa nunca entra: quedaria ausente todos los dias de sus
  // vacaciones y le arruinaria el porcentaje del año.
  return {
    role: 'DEPORTISTA' as const,
    active: true,
    ...(locationId ? { locations: { some: { locationId } } } : {}),
    // Sin categoria declarada no se filtra. Una clase abierta a todas las
    // categorias dejaria la planilla vacia si se comparara contra null.
    ...(categoria ? { category: categoria } : {}),
  };
}
