/**
 * Quien entra a la planilla de una clase.
 *
 * Existe para que la regla se escriba una sola vez. Estaba en dos sitios —el
 * reporte del backend y la pantalla de asistencia— y cualquier cambio habia que
 * acordarse de hacerlo en los dos, que es exactamente como se desincronizan.
 *
 * La regla, en dos renglones:
 *
 *   clase CON grupo  ->  los miembros de ese grupo. La categoria deja de mandar,
 *                        y la sede no hace falta: el grupo ya la tiene.
 *   clase SIN grupo  ->  la regla vieja, sede cruzada con categoria.
 *
 * El segundo renglon no es una transicion hacia nada: es lo que deja seguir
 * funcionando a un club que nunca armo grupos, y se queda. Si la planilla
 * pasara a salir solo del grupo, el lunes siguiente las listas de todos los
 * clubes que ya operan amanecerian vacias.
 */

export interface ClaseDeLaPlanilla {
  grupoId:    string | null;
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
export function filtroDePlanilla({ grupoId, locationId, categoria }: ClaseDeLaPlanilla) {
  // Un deportista en pausa nunca entra: quedaria ausente todos los dias de sus
  // vacaciones y le arruinaria el porcentaje del año.
  const base = { role: 'DEPORTISTA' as const, active: true };

  if (grupoId) return { ...base, grupos: { some: { grupoId } } };

  return {
    ...base,
    ...(locationId ? { locations: { some: { locationId } } } : {}),
    // Sin categoria declarada no se filtra. Una clase abierta a todas las
    // categorias dejaria la planilla vacia si se comparara contra null.
    ...(categoria ? { category: categoria } : {}),
  };
}
