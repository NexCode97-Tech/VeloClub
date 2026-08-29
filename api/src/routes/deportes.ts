import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prismaClubEntero } from '../db/client';
import { invalidarDeportes } from '../lib/deportes';
import { createLimiter } from '../lib/rate-limit';

/**
 * Las carpetas de deporte de un club.
 *
 * Este router mira el club entero a proposito: es el unico lugar desde donde se
 * ven todas las carpetas a la vez, porque es el que alimenta el selector. Por
 * eso usa `prismaClubEntero` y por eso cada consulta lleva el `clubId` escrito
 * a mano — aca no hay filtro automatico que lo ponga.
 *
 * Quien manda es el dueno declarado del club. Un administrador de una sola
 * carpeta puede ver la suya, pero no crear, renombrar ni desactivar ninguna:
 * abrir un deporte cambia lo que el club paga.
 */

const router = Router();

const nombreSchema = z.object({
  nombre: z.string().min(2).max(40),
});

const cambioSchema = z.object({
  nombre: z.string().min(2).max(40).optional(),
  activo: z.boolean().optional(),
});

/** Titulo en mayuscula inicial, igual que el resto de la interfaz. */
function tituloDe(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Comprueba que quien pide sea el dueno del club.
 *
 * Se resuelve contra `Club.ownerUserId`, que es un dato declarado, y no contra
 * «tiene la carpeta en null»: si se dedujera del null, borrar un deporte o un
 * dato mal escrito convertiria a cualquiera en dueno sin que nadie lo decidiera.
 */
async function esDueno(clubId: string, userId: string): Promise<boolean> {
  const club = await prismaClubEntero.club.findUnique({
    where: { id: clubId },
    select: { ownerUserId: true },
  });
  return !!club?.ownerUserId && club.ownerUserId === userId;
}

/**
 * GET /deportes — las carpetas que esta persona puede ver, con su tamano.
 *
 * El conteo de deportistas no es decoracion: es el dato con el que el dueno
 * decide si abre otra carpeta, y el mismo que mueve el tramo de precio del
 * club. Va aca para que no tenga que ir a buscarlo a otra pantalla.
 */
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!clubId) return res.json({ deportes: [], activo: null, puedeCambiar: false });

  const carpetas = await prismaClubEntero.deporte.findMany({
    where: { clubId },
    select: {
      id: true, nombre: true, activo: true,
      _count: { select: { locations: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Los deportistas se cuentan con el mismo criterio con el que se cobra:
  // activos y ya aprobados. Un numero distinto al de la pantalla de miembros
  // haria dudar de los dos.
  const conteos = await prismaClubEntero.member.groupBy({
    by: ['deporteId'],
    where: { clubId, role: 'DEPORTISTA', active: true, inscripcion: 'APROBADO' },
    _count: { _all: true },
  });
  const porCarpeta = new Map(conteos.map(c => [c.deporteId, c._count._all]));

  // El que no es dueno ve solo la suya: mostrarle la lista completa le contaria
  // que el club tiene otros deportes, que es informacion de la que no participa.
  const visibles = req.esDuenoDelClub
    ? carpetas
    : carpetas.filter(c => c.id === req.deporteId);

  res.json({
    deportes: visibles.map(c => ({
      id: c.id,
      nombre: c.nombre,
      activo: c.activo,
      deportistas: porCarpeta.get(c.id) ?? 0,
      sedes: c._count.locations,
    })),
    activo: req.deporteId ?? null,
    puedeCambiar: !!req.esDuenoDelClub,
  });
});

/**
 * POST /deportes — abrir una carpeta nueva.
 *
 * Nace vacia. No se copia nada de la otra: ni deportistas, ni sedes, ni
 * horarios. Es el punto entero del modelo.
 */
router.post('/', createLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!await esDueno(clubId, req.user.id)) {
    return res.status(403).json({ error: 'Solo el dueño del club puede agregar deportes' });
  }

  const parsed = nombreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const nombre = tituloDe(parsed.data.nombre);

  const repetido = await prismaClubEntero.deporte.findFirst({
    where: { clubId, nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
  });
  if (repetido) return res.status(409).json({ error: 'Ya tienes un deporte con ese nombre' });

  const deporte = await prismaClubEntero.deporte.create({
    data: { clubId, nombre },
    select: { id: true, nombre: true, activo: true },
  });
  await invalidarDeportes(clubId);

  res.status(201).json({ deporte: { ...deporte, deportistas: 0, sedes: 0 } });
});

/** PATCH /deportes/:id — renombrar, activar o desactivar. */
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!await esDueno(clubId, req.user.id)) {
    return res.status(403).json({ error: 'Solo el dueño del club puede gestionar los deportes' });
  }

  const id = String(req.params.id);
  const parsed = cambioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const actual = await prismaClubEntero.deporte.findFirst({
    where: { id, clubId },
    select: { id: true },
  });
  if (!actual) return res.status(404).json({ error: 'Deporte no encontrado' });

  const nombre = parsed.data.nombre ? tituloDe(parsed.data.nombre) : undefined;
  if (nombre) {
    const repetido = await prismaClubEntero.deporte.findFirst({
      where: { clubId, nombre: { equals: nombre, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    });
    if (repetido) return res.status(409).json({ error: 'Ya tienes un deporte con ese nombre' });
  }

  // Un club sin ninguna carpeta activa no tiene donde pararse: el dashboard se
  // queda sin nada que mostrar y el dueno sin forma de volver a entrar.
  if (parsed.data.activo === false) {
    const activas = await prismaClubEntero.deporte.count({ where: { clubId, activo: true } });
    if (activas <= 1) {
      return res.status(409).json({ error: 'Tiene que quedar al menos un deporte activo' });
    }
  }

  const deporte = await prismaClubEntero.deporte.update({
    where: { id },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(parsed.data.activo !== undefined ? { activo: parsed.data.activo } : {}),
    },
    select: { id: true, nombre: true, activo: true },
  });
  await invalidarDeportes(clubId);

  res.json({ deporte });
});

/**
 * DELETE /deportes/:id — solo si esta vacia.
 *
 * Borrar arrastraria en cascada deportistas, asistencia, pagos e historial de
 * resultados. Desactivar hace lo que casi siempre se quiere — sacarla de en
 * medio — sin perder nada.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!await esDueno(clubId, req.user.id)) {
    return res.status(403).json({ error: 'Solo el dueño del club puede eliminar deportes' });
  }

  const id = String(req.params.id);
  const carpeta = await prismaClubEntero.deporte.findFirst({
    where: { id, clubId },
    select: {
      id: true,
      _count: {
        select: {
          members: true, locations: true, payments: true, cashEntries: true,
          attendances: true, competitions: true, trainingSessions: true,
          calendarEvents: true, clases: true, posts: true, users: true,
        },
      },
    },
  });
  if (!carpeta) return res.status(404).json({ error: 'Deporte no encontrado' });

  const dentro = Object.values(carpeta._count).reduce((a, b) => a + b, 0);
  if (dentro > 0) {
    return res.status(409).json({
      error: 'Este deporte tiene información adentro. Desactívalo si quieres dejar de usarlo: así deja de aparecer pero conserva su historial.',
    });
  }

  const activas = await prismaClubEntero.deporte.count({ where: { clubId, activo: true } });
  if (activas <= 1) {
    return res.status(409).json({ error: 'Tiene que quedar al menos un deporte activo' });
  }

  await prismaClubEntero.deporte.delete({ where: { id } });
  await invalidarDeportes(clubId);

  res.json({ ok: true });
});

export default router;
