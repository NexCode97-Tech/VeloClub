import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { sedeEsDelClub } from '../lib/sedes';
import { resumirAsistencia } from '../lib/asistencia';

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

// GET /attendance/saved-days?from=YYYY-MM-DD&to=YYYY-MM-DD
// Que dias del rango tienen asistencia registrada. La tira semanal necesita solo
// eso, y lo resolvia pidiendo /attendance?date= siete veces: siete viajes de ida
// y vuelta para averiguar siete si/no. Sentry lo reporto como N+1.
router.get('/saved-days', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const from = req.query.from ? new Date(String(req.query.from) + 'T00:00:00.000Z') : null;
  const to   = req.query.to   ? new Date(String(req.query.to)   + 'T00:00:00.000Z') : null;
  if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res.status(400).json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' });
  }
  const dias = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (dias < 1 || dias > 92) {
    return res.status(400).json({ error: 'El rango debe ser entre 1 y 92 días' });
  }

  // distinct sobre la fecha: no interesa cuantos registros hay, solo si hay
  const registros = await prisma.attendance.findMany({
    where: { clubId, date: { gte: from, lte: to } },
    select: { date: true },
    distinct: ['date'],
  });

  res.json({ days: registros.map(r => r.date.toISOString().slice(0, 10)) });
});

// GET /attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=
// Consolidado por deportista: el detalle que necesita el reporte descargable.
// range-stats no sirve para esto porque solo devuelve totales por dia, sin saber
// de quien son.
const MAX_DIAS_REPORTE = 366;

router.get('/report', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  // El consolidado del club completo es informacion del cuerpo tecnico
  if (req.user.role !== 'ADMIN' && req.user.role !== 'COACH') {
    return res.status(403).json({ error: 'Sin permisos' });
  }
  const clubId = req.user.clubId ?? '';

  const from = req.query.from ? new Date(String(req.query.from) + 'T00:00:00.000Z') : null;
  const to   = req.query.to   ? new Date(String(req.query.to)   + 'T00:00:00.000Z') : null;
  if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res.status(400).json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' });
  }
  if (to < from) return res.status(400).json({ error: 'La fecha final no puede ser anterior a la inicial' });

  const dias = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (dias > MAX_DIAS_REPORTE) {
    return res.status(400).json({ error: 'El rango no puede superar un año' });
  }

  const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
  if (locationId && !await sedeEsDelClub(locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  // Los miembros salen del club (no de los registros) para que un deportista
  // sin ninguna marca en el rango aparezca igual, con la fila en blanco. Si
  // solo se listaran los que tienen registros, el que nunca fue desapareceria
  // del reporte, que es justo a quien hay que ver.
  const members = await prisma.member.findMany({
    where: {
      clubId,
      role: 'STUDENT',
      active: true,
      ...(locationId ? { locations: { some: { locationId } } } : {}),
    },
    select: { id: true, fullName: true, category: true },
    orderBy: { fullName: 'asc' },
  });

  const records = await prisma.attendance.findMany({
    where: {
      clubId,
      date: { gte: from, lte: to },
      ...(locationId ? { locationId } : {}),
      memberId: { in: members.map(m => m.id) },
    },
    select: { memberId: true, date: true, status: true },
  });

  // Solo los dias en que de verdad hubo entrenamiento: armar columnas para los
  // 30 dias del mes cuando se entrena martes y jueves llena el reporte de
  // casillas vacias que se leen como inasistencias.
  const diasConRegistro = Array.from(
    new Set(records.map(r => r.date.toISOString().slice(0, 10)))
  ).sort();

  const porMiembro: Record<string, Record<string, string>> = {};
  for (const r of records) {
    const dia = r.date.toISOString().slice(0, 10);
    (porMiembro[r.memberId] ??= {})[dia] = r.status;
  }

  const filas = members.map(m => {
    const marcas = porMiembro[m.id] ?? {};
    return {
      id: m.id,
      fullName: m.fullName,
      category: m.category,
      dias: marcas,
      ...resumirAsistencia(Object.values(marcas)),
    };
  });

  res.json({ dias: diasConRegistro, filas });
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

  if (!await sedeEsDelClub(locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  // Validar que todos los memberIds pertenecen al club (previene ataque cross-tenant)
  // y que están activos: a un deportista en pausa no se le registra asistencia.
  const memberIds = records.map(r => r.memberId);
  const validMembers = await prisma.member.findMany({
    where: { id: { in: memberIds }, clubId, active: true },
    select: { id: true },
  });
  const validIds = new Set(validMembers.map(m => m.id));
  const invalidIds = memberIds.filter(id => !validIds.has(id));
  if (invalidIds.length > 0) {
    return res.status(403).json({ error: 'Uno o más miembros no pertenecen a este club o están desactivados' });
  }

  // Upsert en bloque: un upsert por registro generaba un N+1 (62 queries en una
  // sola jornada). Se resuelve leyendo los existentes y agrupando las escrituras.
  const existing = await prisma.attendance.findMany({
    where: { date, memberId: { in: memberIds } },
    select: { memberId: true },
  });
  const existingIds = new Set(existing.map(a => a.memberId));

  const toCreate = records.filter(r => !existingIds.has(r.memberId));
  const toUpdate = records.filter(r => existingIds.has(r.memberId));

  // Las actualizaciones se agrupan por valores idénticos para reducir el número
  // de queries: en la práctica los registros comparten estado y notas vacías.
  const updateGroups = new Map<string, { status: typeof records[number]['status']; notes: string | null; memberIds: string[] }>();
  for (const r of toUpdate) {
    const notes = r.notes ?? null;
    const key = `${r.status}|${notes ?? ''}`;
    const group = updateGroups.get(key);
    if (group) group.memberIds.push(r.memberId);
    else updateGroups.set(key, { status: r.status, notes, memberIds: [r.memberId] });
  }

  await prisma.$transaction([
    ...(toCreate.length > 0
      ? [prisma.attendance.createMany({
          data: toCreate.map(r => ({
            clubId,
            memberId:   r.memberId,
            locationId: locationId ?? null,
            date,
            status:     r.status,
            notes:      r.notes ?? null,
          })),
        })]
      : []),
    ...Array.from(updateGroups.values()).map(g =>
      prisma.attendance.updateMany({
        where: { date, memberId: { in: g.memberIds } },
        data: { status: g.status, locationId: locationId ?? null, notes: g.notes },
      })
    ),
  ]);

  emitToClub(clubId, 'attendance');
  res.json({ ok: true, saved: records.length });
});

export default router;
