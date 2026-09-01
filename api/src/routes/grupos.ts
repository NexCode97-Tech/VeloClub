import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { sedeEsDelClub } from '../lib/sedes';

const router = Router();

const grupoSchema = z.object({
  nombre:     z.string().min(1).max(60),
  locationId: z.string().min(1),
});

const grupoParcial = grupoSchema.partial().extend({
  activo: z.boolean().optional(),
});

// Quien arma los grupos es quien dirige el club. Un entrenador los consulta al
// pasar asistencia, pero no le reorganiza los grupos al club. Mismo criterio
// que el horario de clases, del que los grupos son el padre.
function soloAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

// GET /grupos — los grupos de la carpeta, con sus clases y cuanta gente tienen
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const grupos = await prisma.grupo.findMany({
    where: { clubId: req.user.clubId ?? '' },
    include: {
      location: { select: { id: true, name: true } },
      clases:   { select: { id: true, diaSemana: true, hora: true, activa: true } },
      _count:   { select: { miembros: true } },
    },
    orderBy: [{ nombre: 'asc' }],
  });

  res.json({ grupos });
});

// POST /grupos
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador puede crear grupos' });

  const parsed = grupoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  if (!await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  const nombre = parsed.data.nombre.trim();

  // Se comprueba antes para devolver un mensaje que se entienda. Sin esto, la
  // llave unica de la base responde con un error de Prisma que no dice nada.
  const existe = await prisma.grupo.findFirst({
    where: { locationId: parsed.data.locationId, nombre },
    select: { id: true },
  });
  if (existe) return res.status(409).json({ error: 'Esa sede ya tiene un grupo con ese nombre' });

  const grupo = await prisma.grupo.create({
    data: {
      clubId,
      deporteId:  carpetaDe(req),
      locationId: parsed.data.locationId,
      nombre,
    },
    include: {
      location: { select: { id: true, name: true } },
      clases:   { select: { id: true, diaSemana: true, hora: true, activa: true } },
      _count:   { select: { miembros: true } },
    },
  });

  // Va por el canal de asistencia y no por uno propio: quien necesita enterarse
  // de que cambio un grupo es justo quien esta mirando planillas.
  emitToClub(clubId, 'attendance');
  res.status(201).json({ grupo });
});

// PATCH /grupos/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador puede editar grupos' });

  const parsed = grupoParcial.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  const actual = await prisma.grupo.findFirst({
    where: { id: String(req.params.id), clubId }, select: { id: true },
  });
  if (!actual) return res.status(404).json({ error: 'Grupo no encontrado' });

  if (parsed.data.locationId && !await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  const grupo = await prisma.grupo.update({
    where: { id: String(req.params.id) },
    data: {
      ...(parsed.data.nombre     !== undefined ? { nombre: parsed.data.nombre.trim() } : {}),
      ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId } : {}),
      ...(parsed.data.activo     !== undefined ? { activo: parsed.data.activo } : {}),
    },
    include: {
      location: { select: { id: true, name: true } },
      clases:   { select: { id: true, diaSemana: true, hora: true, activa: true } },
      _count:   { select: { miembros: true } },
    },
  });

  emitToClub(clubId, 'attendance');
  res.json({ grupo });
});

// DELETE /grupos/:id — solo si no tiene clases colgadas.
//
// El sentido de la falla es intencional: borrar un grupo con clases las dejaria
// sin padre y sus planillas caerian sin aviso a la regla vieja, que es
// exactamente el cruce que este modelo vino a evitar. Mejor que se quede
// trancado y alguien pregunte.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador puede borrar grupos' });

  const clubId = req.user.clubId ?? '';
  const grupo = await prisma.grupo.findFirst({
    where: { id: String(req.params.id), clubId },
    select: { id: true, _count: { select: { clases: true } } },
  });
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
  if (grupo._count.clases > 0) {
    return res.status(409).json({ error: 'El grupo todavía tiene clases. Quítaselas o desactívalo.' });
  }

  await prisma.grupo.delete({ where: { id: String(req.params.id) } });
  emitToClub(clubId, 'attendance');
  res.json({ ok: true });
});

// PUT /grupos/:id/miembros — reemplaza la lista completa del grupo
router.put('/:id/miembros', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador puede asignar deportistas' });

  const parsed = z.object({ memberIds: z.array(z.string()).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  const grupo = await prisma.grupo.findFirst({
    where: { id: String(req.params.id), clubId }, select: { id: true },
  });
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

  // Los ids se comprueban contra la carpeta antes de escribir. Sin esto, un id
  // de otro deporte entraria al grupo y el alcance no lo atrapa, porque
  // MemberGrupo no lleva deporteId propio: se llega a el por Member o por
  // Grupo, y esta consulta es justo la que hace de puerta.
  const validos = await prisma.member.findMany({
    where: { id: { in: parsed.data.memberIds }, clubId },
    select: { id: true },
  });

  // Reemplazo completo y no diferencial: la pantalla manda la lista entera, y
  // calcular altas y bajas por separado deja la puerta abierta a que una de las
  // dos falle y el grupo quede a medias.
  await prisma.$transaction([
    prisma.memberGrupo.deleteMany({ where: { grupoId: grupo.id } }),
    prisma.memberGrupo.createMany({
      data: validos.map(m => ({ memberId: m.id, grupoId: grupo.id })),
      skipDuplicates: true,
    }),
  ]);

  emitToClub(clubId, 'attendance');
  res.json({ ok: true, asignados: validos.length });
});

export default router;
