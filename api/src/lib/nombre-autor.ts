import { prisma } from '../db/client';

/**
 * Resuelve el nombre con el que se firma una publicación o un comentario.
 *
 * El nombre de Clerk se arma con `firstName` + `lastName`, y queda en blanco
 * cuando la persona se registró solo con el correo. Antes se usaba
 * `req.auth?.name ?? 'Autor'`, pero el `??` no atrapa la cadena vacía, así que el
 * autor se guardaba sin nombre y la pantalla terminaba mostrando "Usuario".
 *
 * Aquí se busca el nombre real donde sí lo tenemos: primero el del deportista
 * (Member), que es el que el club escribió a mano, y si no, el de la cuenta
 * (User). Es el mismo orden que ya usa GET /me.
 */

const PLACEHOLDERS = new Set(['usuario', 'autor']);

function esNombreUtil(valor: string | null | undefined): boolean {
  const limpio = (valor ?? '').trim();
  return limpio.length > 0 && !PLACEHOLDERS.has(limpio.toLowerCase());
}

/** Title Case: los nombres se muestran así en toda la interfaz. */
export function aTitleCase(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
    .trim();
}

export async function resolverNombreAutor(
  clerkId: string | null | undefined,
  nombreDeClerk: string | null | undefined,
): Promise<string> {
  if (esNombreUtil(nombreDeClerk)) return aTitleCase(nombreDeClerk!);
  if (!clerkId) return 'Miembro del club';

  const member = await prisma.member.findFirst({
    where: { clerkId },
    select: { fullName: true },
  });
  if (esNombreUtil(member?.fullName)) return aTitleCase(member!.fullName!);

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { name: true },
  });
  if (esNombreUtil(user?.name)) return aTitleCase(user!.name!);

  // Último recurso: mejor algo con sentido que un "Usuario" anónimo.
  return 'Miembro del club';
}
