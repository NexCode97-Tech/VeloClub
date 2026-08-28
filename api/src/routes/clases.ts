import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { sedeEsDelClub } from '../lib/sedes';

const router = Router();

// "HH:mm" en 24h. Se valida el formato porque la hora se ordena como texto:
// "6:00" se colaria antes que "16:00" y el horario saldria desordenado.
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

const claseSchema = z.object({
  nombre:     z.string().min(1).max(60),
  locationId: z.string().min(1),
  diaSemana:  z.number().int().min(0).max(6),
  hora:       z.string().regex(HORA, 'La hora debe ir en formato 24h, por ejemplo 06:00'),
  categoria:  z.string().max(60).nullable().optional(),
});

const claseParcial = claseSchema.partial().extend({
  activa: z.boolean().optional(),
});

// El horario lo define quien dirige el club. Un entrenador lo consulta al
// pasar asistencia, pero no le cambia el horario al club.
function soloAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

// GET /clases — el horario completo, ordenado como se lee: por dia y por hora
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!clubId) return res.status(400).json({ error: 'Tu cuenta no está vinculada a un club' });

  const clases = await prisma.claseHorario.findMany({
    where: { clubId, activa: true },
    include: { location: { select: { id: true, name: true } } },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
  });

  res.json({ clases });
});

// GET /clases/dia?fecha=YYYY-MM-DD
// Las clases que tocan ese dia, con el estado de su asistencia. Es lo que
// Asistencia necesita para pintar el selector sin preguntarle nada a nadie.
router.get('/dia', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId  = req.user.clubId ?? '';
  const fechaStr = String(req.query.fecha ?? '');
  if (!fechaStr) return res.status(400).json({ error: 'fecha requerida' });

  // La fecha llega como YYYY-MM-DD y se interpreta a mediodia UTC: a
  // medianoche, en Colombia (UTC-5), el dia de la semana se corre al anterior.
  const fecha = new Date(`${fechaStr}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'fecha inválida' });
  const diaSemana = fecha.getUTCDay();

  // La regla que ya existia sigue mandando: un dia sin entrenamiento no tiene
  // clases aunque el horario diga otra cosa.
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { noAttendanceDays: true },
  });
  if (club?.noAttendanceDays.includes(diaSemana)) {
    return res.json({ clases: [], diaSinEntrenamiento: true });
  }

  const clases = await prisma.claseHorario.findMany({
    where: { clubId, diaSemana, activa: true },
    include: { location: { select: { id: true, name: true } } },
    orderBy: { hora: 'asc' },
  });

  // Cuales ya tienen asistencia guardada ese dia, para marcarlas en el selector
  const guardadas = clases.length
    ? await prisma.attendance.groupBy({
        by: ['claseId'],
        where: {
          clubId,
          date: new Date(fechaStr),
          claseId: { in: clases.map(c => c.id) },
        },
        _count: { _all: true },
      })
    : [];
  const conAsistencia = new Map(guardadas.map(g => [g.claseId, g._count._all]));

  res.json({
    clases: clases.map(c => ({
      ...c,
      guardada: conAsistencia.has(c.id),
      registros: conAsistencia.get(c.id) ?? 0,
    })),
    diaSinEntrenamiento: false,
  });
});

// POST /clases
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo administradores' });

  const parsed = claseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const clubId = req.user.clubId ?? '';
  if (!await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(400).json({ error: 'La sede no pertenece a tu club' });
  }

  const clase = await prisma.claseHorario.create({
    data: {
      clubId,
      deporteId:  carpetaDe(req),
      nombre:     parsed.data.nombre.trim(),
      locationId: parsed.data.locationId,
      diaSemana:  parsed.data.diaSemana,
      hora:       parsed.data.hora,
      categoria:  parsed.data.categoria?.trim() || null,
    },
    include: { location: { select: { id: true, name: true } } },
  });

  emitToClub(clubId, 'attendance');
  res.status(201).json({ clase });
});

// PATCH /clases/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo administradores' });

  const parsed = claseParcial.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const clubId = req.user.clubId ?? '';
  // Se ata al club: buscarla solo por id dejaria editar el horario de otro.
  const actual = await prisma.claseHorario.findFirst({
    where: { id: String(req.params.id), clubId },
  });
  if (!actual) return res.status(404).json({ error: 'Clase no encontrada' });

  if (parsed.data.locationId && !await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(400).json({ error: 'La sede no pertenece a tu club' });
  }

  const clase = await prisma.claseHorario.update({
    where: { id: actual.id },
    data: {
      ...(parsed.data.nombre     !== undefined ? { nombre: parsed.data.nombre.trim() } : {}),
      ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId } : {}),
      ...(parsed.data.diaSemana  !== undefined ? { diaSemana: parsed.data.diaSemana } : {}),
      ...(parsed.data.hora       !== undefined ? { hora: parsed.data.hora } : {}),
      ...(parsed.data.categoria  !== undefined ? { categoria: parsed.data.categoria?.trim() || null } : {}),
      ...(parsed.data.activa     !== undefined ? { activa: parsed.data.activa } : {}),
    },
    include: { location: { select: { id: true, name: true } } },
  });

  emitToClub(clubId, 'attendance');
  res.json({ clase });
});

// DELETE /clases/:id — desactiva, no borra.
//
// Borrarla de verdad pondria en NULL el claseId de todas sus asistencias, y
// esas filas chocarian contra el indice unico de "sin clase" si el deportista
// ya tenia otra asistencia ese dia. Ademas se perderia el desglose historico.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo administradores' });

  const clubId = req.user.clubId ?? '';
  const actual = await prisma.claseHorario.findFirst({
    where: { id: String(req.params.id), clubId },
  });
  if (!actual) return res.status(404).json({ error: 'Clase no encontrada' });

  await prisma.claseHorario.update({
    where: { id: actual.id },
    data: { activa: false },
  });

  emitToClub(clubId, 'attendance');
  res.json({ ok: true });
});

export default router;
