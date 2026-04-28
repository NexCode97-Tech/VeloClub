import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const user = await prisma.user.findUnique({
    where: { clerkId: req.auth.clerkId },
    include: { club: true },
  });

  if (!user) {
    return res.json({ user: null, needsOnboarding: true });
  }

  res.json({ user, needsOnboarding: false });
});

export default router;
