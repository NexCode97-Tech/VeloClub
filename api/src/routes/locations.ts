import { Router, Request } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma } from '../db/client';
import { Prisma } from '@prisma/client';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';

const router = Router();

const locationSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

function getId(req: Request): string {
  return String(req.params.id);
}

// GET /locations
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  // La clave lleva el deporte. Sin el, las sedes de patinaje quedarian servidas
  // desde cache a quien esta parado en natacion, y la base ni se enteraria
  // porque la consulta no llega a hacerse.
  const cacheKey = `locations:${clubId}:${req.deporteId ?? ''}`;

  const cached = await cacheGet<{ locations: unknown[] }>(cacheKey);
  if (cached) return res.json(cached);

  const locations = await prisma.location.findMany({
    where: { clubId },
    orderBy: { createdAt: 'asc' },
  });
  await cacheSet(cacheKey, { locations }, 600); // 10 min
  res.json({ locations });
});

// POST /locations
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  // Solo el administrador gestiona sedes; el entrenador tiene acceso de lectura
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const location = await prisma.location.create({
    data: { ...parsed.data, clubId: req.user.clubId ?? '', deporteId: carpetaDe(req) },
  });
  await cacheDel(`locations:${req.user.clubId ?? ''}:${req.deporteId ?? ''}`);
  res.status(201).json({ location });
});

// PUT /locations/:id
router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  // Solo el administrador gestiona sedes; el entrenador tiene acceso de lectura
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const existing = await prisma.location.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });
  const updated = await prisma.location.update({
    where: { id },
    data: parsed.data,
  });
  await cacheDel(`locations:${req.user.clubId ?? ''}:${req.deporteId ?? ''}`);
  res.json({ location: updated });
});

// DELETE /locations/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  // Solo el administrador gestiona sedes; el entrenador tiene acceso de lectura
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);
  const existing = await prisma.location.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Sede no encontrada' });

  // Borrar una sede dispara una cadena: se van sus clases del horario en
  // cascada, y las asistencias que apuntaban a esas clases quedan con claseId
  // en null. Ahi pasan a caer bajo el indice unico (memberId, date) de las
  // filas sin clase, y si alguien tenia asistencia ese mismo dia en dos clases
  // de esa sede, las dos colisionan. Antes eso salia como un 500 sin
  // explicacion (VELOCLUB-API-5); ahora se cuenta lo que pasa.
  try {
    await prisma.location.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return res.status(409).json({
        error: 'Esta sede tiene asistencias registradas en varias clases del mismo dia y no se puede borrar sin perderlas. Escribenos y las movemos.',
      });
    }
    throw e;
  }

  await cacheDel(`locations:${req.user.clubId ?? ''}:${req.deporteId ?? ''}`);
  res.json({ ok: true });
});

export default router;
