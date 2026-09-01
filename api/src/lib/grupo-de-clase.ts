import { prisma } from '../db/client';

/**
 * El grupo de una clase no se elige: se deduce del nombre y la sede.
 *
 * El grupo es donde vive la lista de deportistas, pero dejó de ser una pantalla
 * aparte. Quien arma el horario piensa en clases, no en grupos, y tener las dos
 * cosas en el menú obligaba a mantener sincronizado a mano lo que el sistema
 * puede deducir: dos clases que se llaman igual en la misma sede son la misma
 * gente a dos horas distintas.
 *
 * `Grupo` tiene `@@unique([locationId, nombre])`, así que la deducción no es una
 * convención sino la llave de la tabla.
 *
 * El caso delicado es renombrar. Si la clase es la única que usa su grupo y el
 * nombre nuevo está libre, se renombra el grupo y la lista se conserva. Crear
 * uno nuevo ahí dejaría la clase con la planilla vacía por haberle cambiado una
 * letra al nombre, que es la peor forma de perder datos: silenciosa.
 */
export async function grupoParaClase(opts: {
  clubId: string;
  deporteId: string;
  locationId: string;
  nombre: string;
  /** La clase que se está editando, para no contarse a sí misma. */
  claseId?: string;
  grupoActualId?: string | null;
}): Promise<string> {
  const { clubId, deporteId, locationId, nombre, claseId, grupoActualId } = opts;

  const homonimo = await prisma.grupo.findFirst({
    where: { clubId, locationId, nombre },
    select: { id: true },
  });
  if (homonimo && homonimo.id === grupoActualId) return grupoActualId;

  if (grupoActualId && !homonimo) {
    const otras = await prisma.claseHorario.count({
      where: { grupoId: grupoActualId, ...(claseId ? { id: { not: claseId } } : {}) },
    });
    if (otras === 0) {
      await prisma.grupo.update({
        where: { id: grupoActualId },
        data: { nombre, locationId },
      });
      return grupoActualId;
    }
  }

  if (homonimo) return homonimo.id;

  const nuevo = await prisma.grupo.create({
    data: { clubId, deporteId, locationId, nombre },
    select: { id: true },
  });
  return nuevo.id;
}
