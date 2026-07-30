import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { prisma } from '../db/client';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

declare global {
  namespace Express {
    interface Request {
      auth?: {
        clerkId: string;
        email: string;
        name: string;
        picture?: string;
      };
      user?: { id: string; clubId: string | null; role: string };
      clubId?: string;
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    next();
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const token = header.substring(7);
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const clerkId = payload.sub as string;

    const clerkUser = await clerk.users.getUser(clerkId);

    // El email es la llave de identidad en todo el backend: promueve a SUPERADMIN,
    // vincula al Member y resuelve permisos. Tomar el primero del arreglo permitía
    // suplantar a otro admin agregando ese correo sin verificar a la cuenta, así
    // que solo se acepta un email verificado, priorizando el principal.
    const isVerified = (e: { verification: { status: string } | null }) =>
      e.verification?.status === 'verified';
    const primary = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    const trustedEmail = primary && isVerified(primary)
      ? primary
      : clerkUser.emailAddresses.find(isVerified);

    if (!trustedEmail) {
      return res.status(403).json({ error: 'Debes verificar tu correo para continuar' });
    }

    req.auth = {
      clerkId,
      email: trustedEmail.emailAddress,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim(),
      picture: clerkUser.imageUrl,
    };

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (user) {
      req.user = { id: user.id, clubId: user.clubId, role: user.role };
    }
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Auth error:', msg); // solo en servidor
    res.status(401).json({ error: 'No autenticado' });
  }
}
