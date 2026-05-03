import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const sessionSchema = z.object({
  title:      z.string().min(1).max(200),
  date:       z.string(),
  locationId: z.string().optional(),
  notes:      z.string().optional(),
});

const resultSchema = z.object({
  memberId:     z.string(),
  time:         z.string().optional(),
  distance:     z.string().optional(),
  laps:         z.number().int().positive().optional(),
  observations: z.string().optional(),
});

// GET /training?month=&year=
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const month = req.query.month ? parseInt(String(req.query.month)) : null;
  const year  = req.query.year  ? parseInt(String(req.query.year))  : null;

  const where: Record<string, unknown> = { clubId };
  if (month !== null && year !== null) {
    where.date = {
      gte: new Date(year, month - 1, 1),
      lte: new Date(year, month, 0, 23, 59, 59),
    };
  }

  const sessions = await prisma.trainingSession.findMany({
    where,
    include: {
      location: { select: { id: true, name: true } },
      results:  { include: { member: { select: { id: true, fullName: true } } } },
    },
    orderBy: { date: 'desc' },
  });

  res.json({ sessions });
});

// GET /training/:id
router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const session = await prisma.trainingSession.findFirst({
    where: { id: String(req.params.id), clubId: req.user.clubId ?? '' },
    include: {
      location: { select: { id: true, name: true } },
      results:  {
        include: { member: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.json({ session });
});

// POST /training
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const session = await prisma.trainingSession.create({
    data: {
      clubId:     req.user.clubId ?? '',
      title:      parsed.data.title,
      date:       new Date(parsed.data.date),
      locationId: parsed.data.locationId ?? null,
      notes:      parsed.data.notes ?? null,
    },
    include: {
      location: { select: { id: true, name: true } },
      results:  { include: { member: { select: { id: true, fullName: true } } } },
    },
  });

  res.status(201).json({ session });
});

// DELETE /training/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const existing = await prisma.trainingSession.findFirst({
    where: { id: String(req.params.id), clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sesión no encontrada' });
  await prisma.trainingSession.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// POST /training/:id/results
router.post('/:id/results', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const sessionId = String(req.params.id);

  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, clubId: req.user.clubId ?? '' },
  });
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  const parsed = resultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const result = await prisma.trainingResult.upsert({
    where: { sessionId_memberId: { sessionId, memberId: parsed.data.memberId } },
    create: { sessionId, ...parsed.data },
    update: {
      time:         parsed.data.time         ?? null,
      distance:     parsed.data.distance     ?? null,
      laps:         parsed.data.laps         ?? null,
      observations: parsed.data.observations ?? null,
    },
    include: { member: { select: { id: true, fullName: true } } },
  });

  res.status(201).json({ result });
});

// DELETE /training/:id/results/:resultId
router.delete('/:id/results/:resultId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const sessionId = String(req.params.id);
  const resultId  = String(req.params.resultId);

  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, clubId: req.user.clubId ?? '' },
  });
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  await prisma.trainingResult.delete({ where: { id: resultId } });
  res.json({ ok: true });
});

export default router;
