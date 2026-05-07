import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function revokeClerkAccess(clerkId: string): Promise<void> {
  try {
    // Revocar todas las sesiones activas del usuario
    const sessions = await clerk.sessions.getSessionList({ userId: clerkId });
    await Promise.all(
      sessions.data.map(s => clerk.sessions.revokeSession(s.id).catch(() => {}))
    );
    // Banear la cuenta para que no pueda volver a entrar
    await clerk.users.banUser(clerkId);
  } catch (err: unknown) {
    console.error('Error revoking Clerk access:', err instanceof Error ? err.message : err);
  }
}

export async function addToAllowlist(email: string): Promise<void> {
  try {
    await clerk.allowlistIdentifiers.createAllowlistIdentifier({
      identifier: email,
      notify: false,
    });
  } catch (err: any) {
    // Ignorar si ya existe
    if (!err?.message?.includes('already')) {
      console.error('Error adding to allowlist:', err?.message);
    }
  }
}

export async function removeFromAllowlist(email: string): Promise<void> {
  try {
    const list = await clerk.allowlistIdentifiers.getAllowlistIdentifierList();
    const found = list.data.find((i: any) => i.identifier === email);
    if (found) {
      await clerk.allowlistIdentifiers.deleteAllowlistIdentifier(found.id);
    }
  } catch (err: any) {
    console.error('Error removing from allowlist:', err?.message);
  }
}
