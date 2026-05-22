import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

const router = Router();

const competitionSchema = z.object({
  name:  z.string().min(1).max(200),
  place: z.string().optional(),
  date:  z.string(),
});

const eventSchema = z.object({
  name: z.string().min(1).max(200),
});

const resultSchema = z.object({
  memberId:     z.string(),
  position:     z.number().int().positive().optional(),
  category:     z.string().optional(),
  observations: z.string().optional(),
});

// ── Competitions ─────────────────────────────────────────────────────────────

// GET /competitions
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const competitions = await prisma.competition.findMany({
    where: { clubId: req.user.clubId ?? '' },
    include: {
      events: {
        include: { results: { include: { member: { select: { id: true, fullName: true } } } } },
      },
    },
    orderBy: { date: 'desc' },
  });

  res.json({ competitions });
});

// POST /competitions
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = competitionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const competition = await prisma.competition.create({
    data: {
      clubId: req.user.clubId ?? '',
      name:   parsed.data.name,
      place:  parsed.data.place ?? null,
      date:   new Date(parsed.data.date),
    },
    include: { events: true },
  });

  emitToClub(req.user.clubId ?? '', 'competitions');
  res.status(201).json({ competition });
});

// GET /competitions/:id
router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const competition = await prisma.competition.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
    include: {
      events: {
        orderBy: { createdAt: 'asc' },
        include: {
          results: {
            orderBy: { position: 'asc' },
            include: { member: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
  });

  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });
  res.json({ competition });
});

// DELETE /competitions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const competition = await prisma.competition.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });

  await prisma.competition.delete({ where: { id } });
  emitToClub(req.user.clubId ?? '', 'competitions');
  res.json({ ok: true });
});

// ── Events (pruebas) ─────────────────────────────────────────────────────────

// POST /competitions/:id/events
router.post('/:id/events', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const competitionId = String(req.params.id);

  const competition = await prisma.competition.findFirst({ where: { id: competitionId, clubId: req.user.clubId ?? '' } });
  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });

  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const event = await prisma.competitionEvent.create({
    data: { competitionId, name: parsed.data.name },
    include: { results: true },
  });

  emitToClub(req.user.clubId ?? '', 'competitions');
  res.status(201).json({ event });
});

// DELETE /competitions/:id/events/:eventId
router.delete('/:id/events/:eventId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const competitionId = String(req.params.id);
  const eventId       = String(req.params.eventId);

  const competition = await prisma.competition.findFirst({ where: { id: competitionId, clubId: req.user.clubId ?? '' } });
  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });

  await prisma.competitionEvent.delete({ where: { id: eventId } });
  emitToClub(req.user.clubId ?? '', 'competitions');
  res.json({ ok: true });
});

// ── Results ───────────────────────────────────────────────────────────────────

// POST /competitions/:id/events/:eventId/results
router.post('/:id/events/:eventId/results', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const competitionId = String(req.params.id);
  const eventId       = String(req.params.eventId);

  const competition = await prisma.competition.findFirst({ where: { id: competitionId, clubId: req.user.clubId ?? '' } });
  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });

  const parsed = resultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  // Verificar que el miembro pertenece al mismo club
  const member = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, clubId: req.user.clubId ?? '' },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado en este club' });

  try {
    const result = await prisma.eventResult.upsert({
      where: { eventId_memberId: { eventId, memberId: parsed.data.memberId } },
      create: {
        eventId,
        memberId:     parsed.data.memberId,
        position:     parsed.data.position  ?? null,
        category:     parsed.data.category  ?? null,
        observations: parsed.data.observations ?? null,
      },
      update: {
        position:     parsed.data.position  ?? null,
        category:     parsed.data.category  ?? null,
        observations: parsed.data.observations ?? null,
      },
      include: { member: { select: { id: true, fullName: true } } },
    });
    emitToClub(req.user.clubId ?? '', 'competitions');
    res.status(201).json({ result });
  } catch (err) {
    console.error('Error al guardar resultado de competencia:', err);
    res.status(500).json({ error: 'Error al guardar el resultado' });
  }
});

// DELETE /competitions/:id/events/:eventId/results/:resultId
router.delete('/:id/events/:eventId/results/:resultId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const competitionId = String(req.params.id);
  const resultId      = String(req.params.resultId);

  const competition = await prisma.competition.findFirst({ where: { id: competitionId, clubId: req.user.clubId ?? '' } });
  if (!competition) return res.status(404).json({ error: 'Competencia no encontrada' });

  await prisma.eventResult.delete({ where: { id: resultId } });
  emitToClub(req.user.clubId ?? '', 'competitions');
  res.json({ ok: true });
});

export default router;
