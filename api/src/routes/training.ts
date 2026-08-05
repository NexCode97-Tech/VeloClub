import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { sedeEsDelClub } from '../lib/sedes';

const router = Router();

// Registrar competencias, entrenamientos y sus resultados es tarea del cuerpo
// tecnico. El deportista solo consulta: antes estas rutas no validaban rol, asi
// que respondian a cualquiera con sesion activa del club aunque la interfaz le
// escondiera los botones.
function puedeGestionar(req: import('express').Request): boolean {
  return req.user?.role === 'ADMIN' || req.user?.role === 'COACH';
}


const sessionSchema = z.object({
  title:      z.string().min(1).max(200),
  date:       z.string(),
  escenario:  z.enum(['PISTA', 'GIMNASIO']).optional(),
  locationId: z.string().optional(),
  notes:      z.string().optional(),
});

const resultSchema = z.object({
  memberId:     z.string(),
  // Pista
  time:         z.string().max(50).optional(),
  distance:     z.string().max(50).optional(),
  laps:         z.number().int().positive().optional(),
  // Gimnasio
  exercise:     z.string().max(120).optional(),
  weight:       z.string().max(50).optional(),
  sets:         z.number().int().positive().optional(),
  reps:         z.number().int().positive().optional(),
  mark:         z.string().max(50).optional(),
  observations: z.string().max(500).optional(),
});

// Un resultado de gimnasio no tiene vueltas y uno de pista no tiene series. El
// cliente manda lo que corresponde, pero el escenario lo manda la sesion, asi
// que aqui se descarta lo que no aplica en vez de confiar en el formulario.
export function camposDelEscenario(
  datos: z.infer<typeof resultSchema>,
  escenario: 'PISTA' | 'GIMNASIO',
) {
  const comunes = { observations: datos.observations ?? null };
  if (escenario === 'GIMNASIO') {
    return {
      ...comunes,
      exercise: datos.exercise ?? null,
      weight:   datos.weight   ?? null,
      sets:     datos.sets     ?? null,
      reps:     datos.reps     ?? null,
      mark:     datos.mark     ?? null,
      time: null, distance: null, laps: null,
    };
  }
  return {
    ...comunes,
    time:     datos.time     ?? null,
    distance: datos.distance ?? null,
    laps:     datos.laps     ?? null,
    exercise: null, weight: null, sets: null, reps: null, mark: null,
  };
}

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
      results:  { include: { member: { select: { id: true, fullName: true, pictureUrl: true } } } },
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
        include: { member: { select: { id: true, fullName: true, pictureUrl: true } } },
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
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permisos' });
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  if (!await sedeEsDelClub(parsed.data.locationId, req.user.clubId ?? '')) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  const session = await prisma.trainingSession.create({
    data: {
      clubId:     req.user.clubId ?? '',
      title:      parsed.data.title,
      date:       new Date(parsed.data.date),
      escenario:  parsed.data.escenario ?? 'PISTA',
      locationId: parsed.data.locationId ?? null,
      notes:      parsed.data.notes ?? null,
    },
    include: {
      location: { select: { id: true, name: true } },
      results:  { include: { member: { select: { id: true, fullName: true, pictureUrl: true } } } },
    },
  });

  emitToClub(req.user.clubId ?? '', 'training');
  res.status(201).json({ session });
});

// DELETE /training/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permisos' });
  const existing = await prisma.trainingSession.findFirst({
    where: { id: String(req.params.id), clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sesión no encontrada' });
  await prisma.trainingSession.delete({ where: { id: existing.id } });
  emitToClub(req.user.clubId ?? '', 'training');
  res.json({ ok: true });
});

// POST /training/:id/results
router.post('/:id/results', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permisos' });
  const sessionId = String(req.params.id);
  const clubId    = req.user.clubId ?? '';

  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, clubId },
  });
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  const parsed = resultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  // Verificar que el miembro pertenece al mismo club
  const member = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, clubId },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado en este club' });

  try {
    const campos = camposDelEscenario(parsed.data, session.escenario);
    const result = await prisma.trainingResult.upsert({
      where: { sessionId_memberId: { sessionId, memberId: parsed.data.memberId } },
      create: { sessionId, memberId: parsed.data.memberId, ...campos },
      update: campos,
      include: { member: { select: { id: true, fullName: true, pictureUrl: true } } },
    });
    emitToClub(clubId, 'training');
    res.status(201).json({ result });
  } catch (err) {
    console.error('Error al guardar resultado:', err);
    res.status(500).json({ error: 'Error al guardar el resultado' });
  }
});

// DELETE /training/:id/results/:resultId
router.delete('/:id/results/:resultId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!puedeGestionar(req)) return res.status(403).json({ error: 'Sin permisos' });
  const sessionId = String(req.params.id);
  const resultId  = String(req.params.resultId);

  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, clubId: req.user.clubId ?? '' },
  });
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  // El resultado debe pertenecer a la sesión ya validada: borrar solo por id
  // permitía eliminar resultados de entrenamientos de otros clubes.
  const result = await prisma.trainingResult.findFirst({ where: { id: resultId, sessionId } });
  if (!result) return res.status(404).json({ error: 'Resultado no encontrado' });

  await prisma.trainingResult.delete({ where: { id: resultId } });
  emitToClub(req.user.clubId ?? '', 'training');
  res.json({ ok: true });
});

export default router;
