import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const paymentSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'REFUNDED']).default('PENDING'),
  notes: z.string().optional(),
});

// GET /payments?month=&year=&status=
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const month  = req.query.month  ? parseInt(String(req.query.month))  : null;
  const year   = req.query.year   ? parseInt(String(req.query.year))   : null;
  const status = req.query.status ? String(req.query.status)           : null;

  const where: Record<string, unknown> = { clubId };
  if (month  !== null) where.month  = month;
  if (year   !== null) where.year   = year;
  if (status)          where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: { member: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ payments });
});

// POST /payments
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { dueDate, paidAt, ...rest } = parsed.data;

  const payment = await prisma.payment.create({
    data: {
      ...rest,
      clubId: req.user.clubId ?? '',
      dueDate: dueDate ? new Date(dueDate) : null,
      paidAt:  paidAt  ? new Date(paidAt)  : rest.status === 'PAID' ? new Date() : null,
    },
    include: { member: { select: { id: true, fullName: true, email: true } } },
  });

  res.status(201).json({ payment });
});

// PATCH /payments/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const existing = await prisma.payment.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  const { status, paidAt, notes, amount } = req.body as {
    status?: string; paidAt?: string; notes?: string; amount?: number;
  };

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (amount !== undefined) data.amount = amount;
  if (notes  !== undefined) data.notes  = notes;
  if (paidAt)               data.paidAt = new Date(paidAt);
  else if (status === 'PAID' && !existing.paidAt) data.paidAt = new Date();

  const payment = await prisma.payment.update({
    where: { id },
    data,
    include: { member: { select: { id: true, fullName: true, email: true } } },
  });

  res.json({ payment });
});

// DELETE /payments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const existing = await prisma.payment.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  await prisma.payment.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
