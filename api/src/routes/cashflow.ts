import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const entrySchema = z.object({
  type:        z.enum(['INCOME', 'EXPENSE']),
  amount:      z.number().positive(),
  description: z.string().min(1).max(300),
  date:        z.string().optional(),
});

// GET /cashflow?month=&year=
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

  const entries = await prisma.cashEntry.findMany({
    where,
    include: { payment: { include: { member: { select: { fullName: true } } } } },
    orderBy: { date: 'desc' },
  });

  res.json({ entries });
});

// POST /cashflow  (manual entry only — auto entries come from payments)
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const entry = await prisma.cashEntry.create({
    data: {
      clubId:      req.user.clubId ?? '',
      type:        parsed.data.type,
      amount:      parsed.data.amount,
      description: parsed.data.description,
      date:        parsed.data.date ? new Date(parsed.data.date) : new Date(),
    },
  });

  res.status(201).json({ entry });
});

// DELETE /cashflow/:id  (only manual entries — paymentId must be null)
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const entry = await prisma.cashEntry.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!entry) return res.status(404).json({ error: 'Entrada no encontrada' });
  if (entry.paymentId) return res.status(400).json({ error: 'No se puede eliminar una entrada automática. Elimina el pago correspondiente.' });

  await prisma.cashEntry.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
