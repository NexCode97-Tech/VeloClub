import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const bulkSchema = z.object({
  date:       z.string(),
  locationId: z.string().optional(),
  records: z.array(z.object({
    memberId: z.string(),
    status:   z.enum(['PRESENT', 'LATE', 'ABSENT', 'MEDICAL']),
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

// POST /attendance/bulk  — upsert all records for a date+location
router.post('/bulk', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { date: dateStr, locationId, records } = parsed.data;
  const date = new Date(dateStr);

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

  res.json({ ok: true, saved: records.length });
});

export default router;
