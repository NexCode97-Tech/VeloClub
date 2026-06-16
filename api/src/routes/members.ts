import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { addToAllowlist, removeFromAllowlist, revokeClerkAccess, revokeClerkSessions } from '../lib/clerk-allowlist';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

const memberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  docType: z.string().optional(),
  docNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  eps: z.string().optional(),
  category: z.string().optional(),
  tipo: z.string().optional(),
  paymentDueDay: z.number().min(1).max(31).nullable().optional(),
  monthlyFee: z.number().positive().nullable().optional(),
  locationIds: z.array(z.string()).optional(),
  role: z.enum(['ADMIN', 'COACH', 'STUDENT']).optional(),
});

function getId(req: Request): string {
  return String(req.params.id);
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

// GET /members
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  const cacheKey = `members:${clubId}`;

  const cached = await cacheGet<{ members: unknown[] }>(cacheKey);
  if (cached) return res.json(cached);

  const members = await prisma.member.findMany({
    where: { clubId },
    include: { locations: { include: { location: true } } },
    orderBy: { fullName: 'asc' },
  });
  await cacheSet(cacheKey, { members }, 300); // 5 min
  res.json({ members });
});

// GET /members/birthdays — miembros con cumpleaños en los próximos 30 días
router.get('/birthdays', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const all = await prisma.member.findMany({
    where: { clubId, birthDate: { not: null } },
    select: { id: true, fullName: true, birthDate: true, pictureUrl: true, role: true },
  });

  // Normalizar "hoy" a medianoche para comparar solo por fecha
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = all
    .filter(m => m.birthDate)
    .map(m => {
      const bd = m.birthDate!;
      // Próxima ocurrencia del cumpleaños (este año o el siguiente)
      const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { id: m.id, fullName: m.fullName, pictureUrl: m.pictureUrl, role: m.role, birthDate: m.birthDate, daysUntil: diff };
    })
    .filter(m => m.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);

  res.json({ birthdays: result });
});

// GET /members/me — retorna el Member vinculado al usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const member = await prisma.member.findFirst({
    where: { clerkId: req.auth?.clerkId, clubId: req.user.clubId ?? '' },
    select: { id: true, fullName: true, role: true, pictureUrl: true, phone: true, category: true, tipo: true, email: true, createdAt: true },
  });
  if (!member) return res.json({ member: null });
  res.json({ member });
});

// GET /members/:id
router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);
  const member = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
    include: { locations: { include: { location: true } } },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
  res.json({ member });
});

// POST /members
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { locationIds, birthDate, ...rest } = parsed.data;
  rest.fullName = toTitleCase(rest.fullName);

  let member;
  try {
    member = await prisma.member.create({
      data: {
        ...rest,
        email: rest.email || undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        clubId: req.user.clubId ?? '',
        locations: locationIds?.length
          ? { create: locationIds.map((locId) => ({ locationId: locId })) }
          : undefined,
      },
      include: { locations: { include: { location: true } } },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: `El correo "${rest.email}" ya está registrado en este club` });
    }
    const msg = err instanceof Error ? err.message : 'Error al crear el miembro';
    return res.status(500).json({ error: msg });
  }

  // Agregar email al allowlist de Clerk (ignorar si ya existe o falla)
  if (member.email) {
    try { await addToAllowlist(member.email); } catch { /* ya existe o error de Clerk */ }
  }

  await cacheDel(`members:${req.user.clubId ?? ''}`);
  emitToClub(req.user.clubId ?? '', 'members');
  res.status(201).json({ member });
});

// PUT /members/:id
router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { locationIds, birthDate, ...rest } = parsed.data;
  if (rest.fullName) rest.fullName = toTitleCase(rest.fullName);

  if (locationIds !== undefined) {
    await prisma.memberLocation.deleteMany({ where: { memberId: id } });
  }

  const member = await prisma.member.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email || undefined,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      locations: locationIds?.length
        ? { create: locationIds.map((locId) => ({ locationId: locId })) }
        : undefined,
    },
    include: { locations: { include: { location: true } } },
  });

  // Si cambió la tarifa mensual, reflejarla en los pagos aún no pagados
  // (PENDING / OVERDUE). Los pagos ya cobrados (PAID) no se tocan.
  if (typeof rest.monthlyFee === 'number' && rest.monthlyFee > 0) {
    await prisma.payment.updateMany({
      where: {
        memberId: id,
        clubId: req.user.clubId ?? '',
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: { amount: rest.monthlyFee },
    });
  }

  // Sincronizar rol en User y revocar sesiones si el rol cambió
  if (rest.role && member.clerkId) {
    await prisma.user.updateMany({
      where: { clerkId: member.clerkId },
      data:  { role: rest.role },
    });
    // Forzar nuevo login para que el JWT refleje el rol actualizado
    const roleCambio = existing.role !== rest.role;
    if (roleCambio) await revokeClerkSessions(member.clerkId);
  }

  await cacheDel(`members:${req.user.clubId ?? ''}`);
  emitToClub(req.user.clubId ?? '', 'members');
  res.json({ member });
});

// PATCH /members/me/contact — el usuario actualiza su propio teléfono.
// Resuelve el Member desde el token (no depende de un id enviado por el cliente).
// IMPORTANTE: definir antes de '/:id/contact' para que no lo capture la ruta con :id.
router.patch('/me/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const existing = await prisma.member.findFirst({
    where: { clerkId: req.auth?.clerkId, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'No encontramos tu perfil de miembro' });

  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() || null : null;

  const member = await prisma.member.update({
    where: { id: existing.id },
    data: { phone },
    select: { id: true, fullName: true, role: true, pictureUrl: true, phone: true, email: true, category: true, tipo: true, createdAt: true },
  });

  res.json({ member });
});

// PATCH /members/:id/contact — actualiza solo teléfono y correo (usado desde Mi Perfil)
router.patch('/:id/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() || null : null;
  const email = typeof req.body.email === 'string' ? req.body.email.trim() || null : null;

  const member = await prisma.member.update({
    where: { id },
    data: { phone, email: email || undefined },
    select: { id: true, fullName: true, role: true, pictureUrl: true, phone: true, email: true, category: true, tipo: true },
  });

  res.json({ member });
});

// DELETE /members/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Revocar acceso Clerk: quitar del allowlist + banear cuenta si existe
  if (existing.email) {
    try { await removeFromAllowlist(existing.email); } catch { /* ignorar */ }
  }
  if (existing.clerkId) {
    await revokeClerkAccess(existing.clerkId);
  }

  await prisma.member.delete({ where: { id } });
  await cacheDel(`members:${req.user.clubId ?? ''}`);
  emitToClub(req.user.clubId ?? '', 'members');
  res.json({ ok: true });
});

// POST /members/:id/upload
router.post('/:id/upload', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  const { field, url, publicId } = req.body as {
    field: 'picture' | 'doc' | 'insurance';
    url: string;
    publicId: string;
  };

  const fieldMap: Record<string, object> = {
    picture: { pictureUrl: url, picturePublicId: publicId },
    doc: { docFileUrl: url, docFilePublicId: publicId },
    insurance: { insuranceFileUrl: url, insurancePublicId: publicId },
  };

  if (!fieldMap[field]) return res.status(400).json({ error: 'Campo inválido' });

  const member = await prisma.member.update({
    where: { id },
    data: fieldMap[field],
  });
  res.json({ member });
});

// POST /members/me/picture — deportista sube su propia foto de perfil
router.post('/me/picture', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const member = await prisma.member.findFirst({
    where: { clerkId: req.auth.clerkId },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  const { base64 } = req.body as { base64: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  try {
    // Eliminar foto anterior si existe
    if (member.picturePublicId) {
      await cloudinary.uploader.destroy(member.picturePublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/members',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    });

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { pictureUrl: result.secure_url, picturePublicId: result.public_id },
    });

    res.json({ pictureUrl: updated.pictureUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al subir imagen';
    res.status(500).json({ error: msg });
  }
});

export default router;
