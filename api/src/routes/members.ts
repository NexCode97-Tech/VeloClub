import { Router, Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const memberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  docNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  category: z.string().optional(),
  locationIds: z.array(z.string()).optional(),
  role: z.enum(['ADMIN', 'COACH', 'STUDENT']).optional(),
});

function getId(req: Request): string {
  return String(req.params.id);
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

  const member = await prisma.member.create({
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
  await prisma.member.delete({ where: { id } });
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
