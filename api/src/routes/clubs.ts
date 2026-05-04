import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

const router = Router();

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
});

const settingsSchema = z.object({
  name:             z.string().min(2).max(100).optional(),
  city:             z.string().max(100).optional(),
  department:       z.string().max(100).optional(),
  noAttendanceDays: z.array(z.number().min(0).max(6)).optional(),
});

// GET /clubs/settings
router.get('/settings', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const club = await prisma.club.findUnique({
    where: { id: req.user.clubId ?? '' },
    select: { id: true, name: true, city: true, department: true, logoUrl: true, noAttendanceDays: true },
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

  const data: Record<string, unknown> = {};
  if (parsed.data.name             !== undefined) data.name             = parsed.data.name;
  if (parsed.data.city             !== undefined) data.city             = parsed.data.city;
  if (parsed.data.department       !== undefined) data.department       = parsed.data.department;
  if (parsed.data.noAttendanceDays !== undefined) data.noAttendanceDays = parsed.data.noAttendanceDays;

  const club = await prisma.club.update({
    where: { id: req.user.clubId ?? '' },
    data,
    select: { id: true, name: true, city: true, department: true, logoUrl: true, noAttendanceDays: true },
  });
  res.json({ club });
});

// POST /clubs/logo  — recibe base64, sube a Cloudinary
router.post('/logo', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { base64 } = req.body as { base64: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  const clubId = req.user.clubId ?? '';

  try {
    const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { logoPublicId: true } });
    if (existing?.logoPublicId) {
      await cloudinary.uploader.destroy(existing.logoPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder:         'veloclub/logos',
      public_id:      `club_${clubId}`,
      overwrite:      true,
      transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'center' }],
    });

    const club = await prisma.club.update({
      where: { id: clubId },
      data:  { logoUrl: result.secure_url, logoPublicId: result.public_id },
      select: { id: true, logoUrl: true },
    });

    res.json({ club });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[logo upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /clubs  — crear club
router.post('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const existing = await prisma.user.findUnique({ where: { clerkId: req.auth.clerkId } });
  if (existing) return res.status(400).json({ error: 'El usuario ya pertenece a un club' });

  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });

  const club = await prisma.club.create({
    data: {
      name: parsed.data.clubName,
      users: {
        create: {
          clerkId: req.auth.clerkId,
          email:   req.auth.email,
          name:    req.auth.name,
          picture: req.auth.picture,
          role:    'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  res.status(201).json({ club });
});

export default router;
