import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

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
