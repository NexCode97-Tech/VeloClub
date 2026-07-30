import { prisma } from '../db/client';

/**
 * Comprueba que todas las sedes indicadas pertenezcan al club.
 *
 * Los ids de sede llegan sueltos desde el cliente. Sin esta validación se podían
 * crear registros (miembros, entrenamientos, eventos, asistencia) apuntando a
 * sedes de otros clubes, cuyo nombre y dirección después salían en las consultas
 * que incluyen la relación.
 */
export async function sedesSonDelClub(locationIds: string[], clubId: string): Promise<boolean> {
  const unicos = Array.from(new Set(locationIds));
  if (unicos.length === 0) return true;
  const encontradas = await prisma.location.findMany({
    where: { id: { in: unicos }, clubId },
    select: { id: true },
  });
  return encontradas.length === unicos.length;
}

/** Variante para un solo id opcional. */
export async function sedeEsDelClub(locationId: string | null | undefined, clubId: string): Promise<boolean> {
  if (!locationId) return true;
  return sedesSonDelClub([locationId], clubId);
}
