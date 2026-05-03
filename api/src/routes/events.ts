import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['TRAINING', 'MEETUP', 'COMPETITION']),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  allDay: z.boolean().default(true),
  locationId: z.string().optional(),
});

// GET /events?month=&year=
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const month = req.query.month ? parseInt(String(req.query.month)) : null;
  const year  = req.query.year  ? parseInt(String(req.query.year))  : null;

  const where: Record<string, unknown> = { clubId };
  if (month !== null && year !== null) {
    where.startDate = {
      gte: new Date(year, month - 1, 1),
      lte: new Date(year, month, 0, 23, 59, 59),
    };
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startDate: 'asc' },
    include: { location: true },
  });

  res.json({ events });
});

// POST /events
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { startDate, endDate, ...rest } = parsed.data;

  const event = await prisma.calendarEvent.create({
    data: {
      ...rest,
      clubId: req.user.clubId ?? '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      weekDays: [],
    },
    include: { location: true },
  });

  res.status(201).json({ event });
});

// DELETE /events/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const event = await prisma.calendarEvent.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

  await prisma.calendarEvent.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
