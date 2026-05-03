import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';

const router = Router();

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
});

const settingsSchema = z.object({
  noAttendanceDays: z.array(z.number().min(0).max(6)),
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

// GET /clubs/settings
router.get('/settings', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const club = await prisma.club.findUnique({
    where: { id: req.user.clubId ?? '' },
    select: { id: true, name: true, noAttendanceDays: true },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });
  res.json({ club });
});

// PATCH /clubs/settings
router.patch('/settings', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const club = await prisma.club.update({
    where: { id: req.user.clubId ?? '' },
    data:  { noAttendanceDays: parsed.data.noAttendanceDays },
    select: { id: true, name: true, noAttendanceDays: true },
  });
  res.json({ club });
});

export default router;
