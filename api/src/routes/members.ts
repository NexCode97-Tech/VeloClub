import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { addToAllowlist, removeFromAllowlist, revokeClerkAccess, revokeClerkSessions } from '../lib/clerk-allowlist';

const router = Router();

const memberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  docNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  eps: z.string().optional(),
  category: z.string().optional(),
  tipo: z.string().optional(),
  deporte: z.string().optional(),
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
  const members = await prisma.member.findMany({
    where: { clubId: req.user.clubId ?? '' },
    include: { locations: { include: { location: true } } },
    orderBy: { fullName: 'asc' },
  });
  res.json({ members });
});

// GET /members/me — retorna el Member vinculado al usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const member = await prisma.member.findFirst({
    where: { clerkId: req.auth?.clerkId, clubId: req.user.clubId ?? '' },
    select: { id: true, fullName: true, role: true },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
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

  emitToClub(req.user.clubId ?? '', 'members');
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

export default router;
