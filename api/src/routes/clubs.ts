import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';

const router = Router();

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
});

router.post('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const existing = await prisma.user.findUnique({
    where: { clerkId: req.auth.clerkId },
  });
  if (existing) {
    return res.status(400).json({ error: 'El usuario ya pertenece a un club' });
  }

  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
  }

  const club = await prisma.club.create({
    data: {
      name: parsed.data.clubName,
      users: {
        create: {
          clerkId: req.auth.clerkId,
          email: req.auth.email,
          name: req.auth.name,
          picture: req.auth.picture,
          role: 'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  res.status(201).json({ club });
});

export default router;
