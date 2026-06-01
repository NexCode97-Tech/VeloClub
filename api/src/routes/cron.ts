/**
 * /cron — endpoints protegidos para Railway Cron Jobs
 *
 * Autenticación: header  X-Cron-Secret: <CRON_SECRET>
 *
 * POST /cron/generate-payments
 *   Crea pagos PENDING para el mes corriente en todos los miembros
 *   que tengan monthlyFee y paymentDueDay configurados, siempre que
 *   aún no exista un pago para ese mes/año.
 *
 * POST /cron/mark-overdue
 *   Marca como OVERDUE los pagos PENDING cuya dueDate ya pasó.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

const router = Router();

// ── Middleware de autenticación de cron ───────────────────────────────────────
function requireCronSecret(req: Request, res: Response, next: () => void) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron] CRON_SECRET no está configurado');
    res.status(500).json({ error: 'Cron no configurado' });
    return;
  }
  if (req.headers['x-cron-secret'] !== secret) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  next();
}

// ── POST /cron/generate-payments ──────────────────────────────────────────────
router.post('/generate-payments', requireCronSecret, async (_req, res) => {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Todos los miembros activos con tarifa y día de pago configurados
  const members = await prisma.member.findMany({
    where: {
      monthlyFee:    { not: null },
      paymentDueDay: { not: null },
    },
    select: {
      id: true, fullName: true, clubId: true,
      monthlyFee: true, paymentDueDay: true,
      payments: {
        where: { month, year },
        select: { id: true },
      },
    },
  });

  let created = 0;
  const clubsAffected = new Set<string>();

  for (const m of members) {
    // Si ya tiene un pago este mes, skip
    if (m.payments.length > 0) continue;

    const dueDate = new Date(year, month - 1, m.paymentDueDay!);

    await prisma.payment.create({
      data: {
        clubId:   m.clubId,
        memberId: m.id,
        amount:   m.monthlyFee!,
        month,
        year,
        status:  'PENDING',
        dueDate,
      },
    });

    clubsAffected.add(m.clubId);
    created++;
  }

  // Notificar por SSE a cada club afectado
  for (const clubId of clubsAffected) {
    emitToClub(clubId, 'payments');
  }

  console.log(`[cron/generate-payments] ${created} pagos creados para ${month}/${year}`);
  res.json({ ok: true, created, month, year });
});

// ── POST /cron/mark-overdue ───────────────────────────────────────────────────
router.post('/mark-overdue', requireCronSecret, async (_req, res) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // inicio del día

  // Pagos PENDING con dueDate en el pasado
  const overduePayments = await prisma.payment.findMany({
    where: {
      status:  'PENDING',
      dueDate: { lt: now },
    },
    select: { id: true, clubId: true },
  });

  if (overduePayments.length === 0) {
    res.json({ ok: true, marked: 0 });
    return;
  }

  const ids     = overduePayments.map(p => p.id);
  const clubIds = [...new Set(overduePayments.map(p => p.clubId))];

  await prisma.payment.updateMany({
    where:  { id: { in: ids } },
    data:   { status: 'OVERDUE' },
  });

  for (const clubId of clubIds) {
    emitToClub(clubId, 'payments');
  }

  console.log(`[cron/mark-overdue] ${overduePayments.length} pagos marcados OVERDUE`);
  res.json({ ok: true, marked: overduePayments.length });
});

export default router;
