import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
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
  const clubId = req.user.clubId ?? '';
  const cacheKey = `club:settings:${clubId}`;

  const cached = await cacheGet<{ club: unknown }>(cacheKey);
  if (cached) return res.json(cached);

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, city: true, department: true,
      logoUrl: true, coverUrl: true, verified: true,
      noAttendanceDays: true, createdAt: true,
      suscripcion: { select: { tipoPlan: true, createdAt: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });
  await cacheSet(cacheKey, { club }, 300); // 5 min
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

  const clubId = req.user.clubId ?? '';
  const club = await prisma.club.update({
    where: { id: clubId },
    data,
    select: { id: true, name: true, city: true, department: true, logoUrl: true, noAttendanceDays: true },
  });
  await cacheDel(`club:settings:${clubId}`);
  await cacheDel(`club:profile:${clubId}`);
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
      folder:     'veloclub/logos',
      public_id:  `club_${clubId}`,
      overwrite:  true,
    });

    const club = await prisma.club.update({
      where: { id: clubId },
      data:  { logoUrl: result.secure_url, logoPublicId: result.public_id },
      select: { id: true, logoUrl: true },
    });

    await cacheDel(`club:settings:${clubId}`);
    await cacheDel(`club:profile:${clubId}`);
    res.json({ club });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[logo upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /clubs/logo
router.delete('/logo', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const clubId = req.user.clubId ?? '';
  const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { logoPublicId: true } });
  if (existing?.logoPublicId) {
    await cloudinary.uploader.destroy(existing.logoPublicId).catch(() => {});
  }
  await prisma.club.update({
    where: { id: clubId },
    data:  { logoUrl: null, logoPublicId: null },
  });
  await cacheDel(`club:settings:${clubId}`);
  await cacheDel(`club:profile:${clubId}`);
  res.json({ ok: true });
});

// GET /clubs/profile — datos del club para la página de perfil
router.get('/profile', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const clubId = req.user.clubId ?? '';
  const cacheKey = `club:profile:${clubId}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, city: true, department: true, deporte: true,
      logoUrl: true, coverUrl: true, verified: true, createdAt: true,
      description: true, phone: true, email: true,
      _count: { select: { members: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const members = await prisma.member.findMany({
    where: { clubId },
    select: {
      id: true, fullName: true, pictureUrl: true, role: true, clerkId: true,
    },
    orderBy: { fullName: 'asc' },
  });

  const followersCount = await prisma.follow.count({
    where: { followingClerkId: `club:${clubId}` },
  });

  // Sede principal (primera sede registrada)
  const mainLocation = await prisma.location.findFirst({
    where: { clubId },
    select: { id: true, name: true, address: true },
    orderBy: { createdAt: 'asc' },
  });

  const payload = { club, members, followersCount, mainLocation: mainLocation ?? null };
  await cacheSet(cacheKey, payload, 300); // 5 min
  res.json(payload);
});

// GET /clubs/:id/public — perfil público de cualquier club (buscador de comunidad).
// Solo datos públicos; no expone datos sensibles de miembros.
router.get('/:id/public', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const club = await prisma.club.findFirst({
    where: { id, active: true },
    select: {
      id: true, name: true, city: true, department: true, deporte: true,
      logoUrl: true, coverUrl: true, verified: true, description: true, createdAt: true,
      phone: true, email: true,
      _count: { select: { members: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const [followersCount, postsCount, mainLocation] = await Promise.all([
    prisma.follow.count({ where: { followingClerkId: `club:${id}` } }),
    prisma.post.count({ where: { clubId: id } }),
    prisma.location.findFirst({
      where: { clubId: id },
      select: { id: true, name: true, address: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  res.json({ club, followersCount, postsCount, mainLocation: mainLocation ?? null });
});

// PATCH /clubs/contact — actualizar info de contacto (solo ADMIN)
router.patch('/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { phone, email } = req.body as { phone?: string; email?: string };
  const clubId = req.user.clubId ?? '';
  const updated = await prisma.club.update({
    where: { id: clubId },
    data: {
      phone: phone !== undefined ? (phone.trim() || null) : undefined,
      email: email !== undefined ? (email.trim() || null) : undefined,
    },
    select: { phone: true, email: true },
  });
  await cacheDel(`club:profile:${clubId}`);
  res.json(updated);
});

// PATCH /clubs/description — actualizar descripción del club
router.patch('/description', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { description } = req.body as { description?: string };
  const clubId = req.user.clubId ?? '';
  const updated = await prisma.club.update({
    where: { id: clubId },
    data: { description: description?.trim() || null },
    select: { description: true },
  });
  await cacheDel(`club:profile:${clubId}`);
  res.json({ description: updated.description });
});

// POST /clubs/cover — portada del club
router.post('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { base64 } = req.body as { base64?: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  const clubId = req.user.clubId ?? '';
  try {
    const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { coverPublicId: true } });
    if (existing?.coverPublicId) {
      await cloudinary.uploader.destroy(existing.coverPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/club-covers',
      transformation: [{ width: 1200, height: 400, crop: 'fill', gravity: 'center', quality: 'auto:good' }],
    });

    const club = await prisma.club.update({
      where: { id: clubId },
      data: { coverUrl: result.secure_url, coverPublicId: result.public_id },
      select: { coverUrl: true },
    });

    await cacheDel(`club:settings:${clubId}`);
    await cacheDel(`club:profile:${clubId}`);
    res.json({ coverUrl: club.coverUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[club cover upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /clubs/cover
router.delete('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const clubId = req.user.clubId ?? '';
  const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { coverPublicId: true } });
  if (existing?.coverPublicId) {
    await cloudinary.uploader.destroy(existing.coverPublicId).catch(() => {});
  }
  await prisma.club.update({
    where: { id: clubId },
    data: { coverUrl: null, coverPublicId: null },
  });
  res.json({ ok: true });
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
