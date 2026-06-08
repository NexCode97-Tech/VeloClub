import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

const router = Router();

const bulkSchema = z.object({
  date:       z.string(),
  locationId: z.string().optional(),
  records: z.array(z.object({
    memberId: z.string(),
    status:   z.enum(['PRESENT', 'LATE', 'ABSENT', 'MEDICAL_EXCUSE']),
    notes:    z.string().optional(),
  })),
});

// GET /attendance?date=YYYY-MM-DD&locationId=
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId     = req.user.clubId ?? '';
  const dateStr    = String(req.query.date ?? '');
  const locationId = req.query.locationId ? String(req.query.locationId) : undefined;

  if (!dateStr) return res.status(400).json({ error: 'date requerido' });

  const date = new Date(dateStr);
  const where: Record<string, unknown> = { clubId, date };
  if (locationId) where.locationId = locationId;

  const records = await prisma.attendance.findMany({
    where,
    select: { memberId: true, status: true, notes: true },
  });

  res.json({ records });
});

// GET /attendance/monthly-stats — total presentes por mes (últimos 6 meses)
router.get('/monthly-stats', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const now = new Date();
  const months: { month: number; year: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${d.getMonth() + 1}-${d.getFullYear()}` });
  }

  const since = new Date(months[0].year, months[0].month - 1, 1);
  const records = await prisma.attendance.findMany({
    where: { clubId, status: 'PRESENT', date: { gte: since } },
    select: { date: true },
  });

  const counts: Record<string, number> = {};
  for (const r of records) {
    const d = new Date(r.date);
    const key = `${d.getMonth() + 1}-${d.getFullYear()}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const result = months.map(m => ({ month: m.month, year: m.year, presentes: counts[m.label] ?? 0 }));
  res.json({ months: result });
});

// GET /attendance/weekday-stats — presentes por día de semana (últimas 8 semanas)
router.get('/weekday-stats', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const since = new Date();
  since.setDate(since.getDate() - 56); // 8 semanas atrás

  const records = await prisma.attendance.findMany({
    where: { clubId, status: 'PRESENT', date: { gte: since } },
    select: { date: true },
  });

  // Contar presentes por día de semana (0=Dom ... 6=Sáb)
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of records) {
    counts[new Date(r.date).getUTCDay()]++;
  }

  res.json({ counts });
});

// GET /attendance/range-stats?from=YYYY-MM-DD&to=YYYY-MM-DD — presentes por día en un rango
router.get('/range-stats', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to   = req.query.to   ? new Date(String(req.query.to))   : null;
  if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res.status(400).json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' });
  }
  // Máximo 90 días para evitar consultas muy pesadas
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (diffDays < 1 || diffDays > 90) {
    return res.status(400).json({ error: 'El rango debe ser entre 1 y 90 días' });
  }

  const records = await prisma.attendance.findMany({
    where: { clubId, status: 'PRESENT', date: { gte: from, lte: to } },
    select: { date: true },
  });

  // Agrupar por fecha ISO
  const counts: Record<string, number> = {};
  for (const r of records) {
    const key = new Date(r.date).toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Devolver todos los días del rango (incluso los que tienen 0)
  const days: { date: string; presentes: number }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, presentes: counts[key] ?? 0 });
  }

  res.json({ days });
});

// POST /attendance/bulk  — upsert all records for a date+location
router.post('/bulk', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });
  const clubId = req.user.clubId ?? '';

  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { date: dateStr, locationId, records } = parsed.data;
  const date = new Date(dateStr);

  // Validar que todos los memberIds pertenecen al club (previene ataque cross-tenant)
  const memberIds = records.map(r => r.memberId);
  const validMembers = await prisma.member.findMany({
    where: { id: { in: memberIds }, clubId },
    select: { id: true },
  });
  const validIds = new Set(validMembers.map(m => m.id));
  const invalidIds = memberIds.filter(id => !validIds.has(id));
  if (invalidIds.length > 0) {
    return res.status(403).json({ error: 'Uno o más miembros no pertenecen a este club' });
  }

  await prisma.$transaction(
    records.map(r =>
      prisma.attendance.upsert({
        where: { memberId_date: { memberId: r.memberId, date } },
        create: {
          clubId,
          memberId:   r.memberId,
          locationId: locationId ?? null,
          date,
          status:     r.status,
          notes:      r.notes ?? null,
        },
        update: {
          status:     r.status,
          locationId: locationId ?? null,
          notes:      r.notes ?? null,
        },
      })
    )
  );

  emitToClub(clubId, 'attendance');
  res.json({ ok: true, saved: records.length });
});

export default router;
