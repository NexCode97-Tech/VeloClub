import { createClerkClient } from '@clerk/backend';

/**
 * Lo que hay que hacerle a una cuenta de Clerk cuando cambia su situación en el
 * club.
 *
 * Antes este archivo se llamaba `clerk-allowlist.ts` y traía además dos
 * funciones para meter y sacar correos de la lista de permitidos de Clerk. Se
 * quitaron el 1 de septiembre de 2026: la lista está **apagada** en el Clerk de
 * producción —`restrictions.allowlist.enabled: false`, `sign_up.mode: public`—
 * así que no bloqueaba a nadie, y encima la llamada fallaba siempre con
 * «Payment Required» porque la función no está en el plan.
 *
 * Costaba una llamada de red por cada miembro creado o borrado. El caso peor
 * era borrar un club: sacaba a cada miembro de la lista, y sacar a uno pedía
 * antes la lista entera, así que un club de doscientos deportistas hacía
 * doscientas peticiones fallidas en fila.
 *
 * Si algún día se prende la lista en Clerk, vuelve a hacer falta.
 */

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

/** Revocar sesiones y banear. Al ELIMINAR un miembro. */
export async function revokeClerkAccess(clerkId: string): Promise<void> {
  try {
    const sessions = await clerk.sessions.getSessionList({ userId: clerkId });
    await Promise.all(
      sessions.data.map(s => clerk.sessions.revokeSession(s.id).catch(() => {}))
    );
    await clerk.users.banUser(clerkId);
  } catch (err: unknown) {
    console.error('Error revoking Clerk access:', err instanceof Error ? err.message : err);
  }
}

/** Solo revocar sesiones. Al CAMBIAR EL ROL, para forzar un JWT nuevo. */
export async function revokeClerkSessions(clerkId: string): Promise<void> {
  try {
    const sessions = await clerk.sessions.getSessionList({ userId: clerkId });
    await Promise.all(
      sessions.data.map(s => clerk.sessions.revokeSession(s.id).catch(() => {}))
    );
  } catch (err: unknown) {
    console.error('Error revoking Clerk sessions:', err instanceof Error ? err.message : err);
  }
}
