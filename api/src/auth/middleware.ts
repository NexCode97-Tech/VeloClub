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
    req.auth = {
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Usuario',
      picture: clerkUser.imageUrl,
    };

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (user) {
      req.user = { id: user.id, clubId: user.clubId, role: user.role };
    }
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Token inválido' });
  }
}
