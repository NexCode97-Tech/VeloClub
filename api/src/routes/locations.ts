import { Router, Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const locationSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
});

function getId(req: Request): string {
  return String(req.params.id);
}

// GET /locations
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const locations = await prisma.location.findMany({
    where: { clubId: req.user.clubId ?? '' },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ locations });
});

// POST /locations
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const location = await prisma.location.create({
    data: { ...parsed.data, clubId: req.user.clubId ?? '' },
  });
  res.status(201).json({ location });
});

// PUT /locations/:id
router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const existing = await prisma.location.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });
  const updated = await prisma.location.update({
    where: { id },
    data: parsed.data,
  });
  res.json({ location: updated });
});

// DELETE /locations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);
  const existing = await prisma.location.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });
  await prisma.location.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
