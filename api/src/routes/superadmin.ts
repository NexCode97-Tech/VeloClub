import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// Middleware: solo superadmin (verifica email directamente, sin depender de la BD)
function requireSuperadmin(req: any, res: any, next: any) {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').map((e: string) => e.trim()).filter(Boolean);
  if (!req.auth || !superadminEmails.includes(req.auth.email)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminName: z.string().min(2).max(100),
});

// GET /superadmin/clubs
router.get('/clubs', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    include: {
      _count: { select: { members: true } },
      users: { where: { role: 'ADMIN' }, select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ clubs });
});

// POST /superadmin/clubs — crea club + pre-registra admin
router.post('/clubs', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { clubName, adminEmail, adminName } = parsed.data;

  // Check email not already used
  const existing = await prisma.member.findFirst({ where: { email: adminEmail } });
  if (existing) return res.status(400).json({ error: 'Este email ya está registrado en otro club' });

  const club = await prisma.club.create({
    data: {
      name: clubName,
      members: {
        create: {
          fullName: adminName,
          email: adminEmail,
          role: 'ADMIN',
          inviteStatus: 'PENDING',
        },
      },
    },
    include: { _count: { select: { members: true } } },
  });

  res.status(201).json({ club });
});

// PATCH /superadmin/clubs/:id/toggle — activar/desactivar
router.patch('/clubs/:id/toggle', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const updated = await prisma.club.update({
    where: { id },
    data: { active: !club.active },
  });
  res.json({ club: updated });
});

// DELETE /superadmin/clubs/:id
router.delete('/clubs/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  await prisma.club.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
