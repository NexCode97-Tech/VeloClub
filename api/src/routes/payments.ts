import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

const router = Router();

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

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

async function createCashEntry(clubId: string, paymentId: string, amount: number, memberName: string, month: number, year: number) {
  const existing = await prisma.cashEntry.findUnique({ where: { paymentId } });
  if (existing) return;
  await prisma.cashEntry.create({
    data: {
      clubId,
      type:        'INCOME',
      amount,
      description: `Mensualidad ${memberName} — ${MONTH_NAMES[month - 1]} ${year}`,
      paymentId,
    },
  });
}

// POST /payments/generate-month — genera pagos PENDING del mes para todos los miembros configurados
router.post('/generate-month', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });

  const parsed = z.object({
    month: z.number().min(1).max(12),
    year:  z.number().min(2020).max(2100),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { month, year } = parsed.data;
  const clubId = req.user.clubId ?? '';

  const members = await prisma.member.findMany({
    where: {
      clubId,
      monthlyFee:    { not: null },
      paymentDueDay: { not: null },
    },
    select: {
      id: true, fullName: true, monthlyFee: true, paymentDueDay: true,
      payments: { where: { month, year }, select: { id: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const m of members) {
    if (m.payments.length > 0) { skipped++; continue; }
    const dueDate = new Date(year, month - 1, m.paymentDueDay!);
    await prisma.payment.create({
      data: { clubId, memberId: m.id, amount: m.monthlyFee!, month, year, status: 'PENDING', dueDate },
    });
    created++;
  }

  if (created > 0) emitToClub(clubId, 'payments');
  res.json({ ok: true, created, skipped });
});

// GET /payments/notifications — pagos PENDING próximos a vencer o vencidos
router.get('/notifications', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.json({ notifications: [] });

  const clubId = req.user.clubId ?? '';
  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Pagos PENDING o OVERDUE del mes actual con miembro que tenga paymentDueDay
  const payments = await prisma.payment.findMany({
    where: {
      clubId,
      status: { in: ['PENDING', 'OVERDUE'] },
      year,
      month,
      member: { paymentDueDay: { not: null } },
    },
    include: { member: { select: { id: true, fullName: true, paymentDueDay: true } } },
  });

  const notifications = payments
    .map(p => {
      const dueDay = p.member.paymentDueDay!;
      const daysLeft = dueDay - today;
      if (daysLeft < 0) {
        return { type: 'overdue' as const, memberId: p.member.id, memberName: p.member.fullName, daysLate: Math.abs(daysLeft), paymentId: p.id };
      }
      if (daysLeft <= 3) {
        return { type: 'due_soon' as const, memberId: p.member.id, memberName: p.member.fullName, daysLeft, paymentId: p.id };
      }
      return null;
    })
    .filter(Boolean);

  res.json({ notifications });
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
    include: { member: { select: { id: true, fullName: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ payments });
});

// POST /payments
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { dueDate, paidAt, ...rest } = parsed.data;
  const clubId = req.user.clubId ?? '';

  const payment = await prisma.payment.create({
    data: {
      ...rest,
      clubId,
      dueDate: dueDate ? new Date(dueDate) : null,
      paidAt:  paidAt  ? new Date(paidAt)  : rest.status === 'PAID' ? new Date() : null,
    },
    include: { member: { select: { id: true, fullName: true, email: true } } },
  });

  if (payment.status === 'PAID') {
    await createCashEntry(clubId, payment.id, payment.amount, payment.member.fullName, payment.month, payment.year);
  }

  emitToClub(clubId, 'payments');
  res.status(201).json({ payment });
});

// PATCH /payments/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const id = String(req.params.id);
  const clubId = req.user.clubId ?? '';

  const existing = await prisma.payment.findFirst({
    where: { id, clubId },
    include: { member: { select: { fullName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  const { status, paidAt, notes, amount } = req.body as {
    status?: string; paidAt?: string; notes?: string; amount?: number;
  };

  const VALID_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'REFUNDED'];
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

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

  if (payment.status === 'PAID') {
    await createCashEntry(
      clubId, payment.id,
      payment.amount,
      existing.member.fullName,
      payment.month, payment.year
    );
  }

  emitToClub(clubId, 'payments');
  res.json({ payment });
});

// DELETE /payments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const id = String(req.params.id);

  const existing = await prisma.payment.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  await prisma.cashEntry.deleteMany({ where: { paymentId: id } });
  await prisma.payment.delete({ where: { id } });
  emitToClub(req.user.clubId ?? '', 'payments');
  res.json({ ok: true });
});

export default router;
