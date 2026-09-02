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

/**
 * Los colores que el calendario tiene reservados para el tipo de evento: rojo
 * es competencia y azul es entrenamiento, y su leyenda lo declara. Un grupo o
 * una clase de ese color harian que un punto rojo dejara de significar
 * «competencia».
 *
 * La rejilla del selector ya no los ofrece, pero la comprobacion va tambien
 * aca: lo que el navegador impide, una peticion a mano no lo impide.
 */
const RESERVADOS = ['#EF476F', '#4361EE'];

const color = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'El color va en formato #RRGGBB')
  .refine(c => !RESERVADOS.includes(c.toUpperCase()),
          'Ese color lo usa el calendario para los eventos')
  .nullable().optional();

// El horario lo define quien dirige el club. Un entrenador lo consulta al
// pasar asistencia, pero no le cambia el horario al club.
function soloAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

/** Lo que el horario necesita de cada clase. */
const conSede = {
  location: { select: { id: true, name: true } },
} as const;

// GET /clases — el horario completo, ordenado como se lee: por dia y por hora
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!clubId) return res.status(400).json({ error: 'Tu cuenta no está vinculada a un club' });

  const clases = await prisma.claseHorario.findMany({
    where: { clubId, activa: true },
    include: conSede,
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
    include: conSede,
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

  // Los nombres de TODO el horario, no solo los de hoy.
  //
  // El color de una clase que no escogio ninguno sale de la posicion de su
  // nombre en esta lista, y la pantalla de Inicio solo pide el dia. Sin esto
  // tendria que pedir el horario entero aparte, y las clases de hoy saldrian
  // de un color en Inicio y de otro en Ajustes.
  const nombres = await prisma.claseHorario.findMany({
    where: { clubId, activa: true },
    select: { nombre: true },
    distinct: ['nombre'],
    orderBy: { nombre: 'asc' },
  });

  res.json({
    clases: clases.map(c => ({
      ...c,
      guardada: conAsistencia.has(c.id),
      registros: conAsistencia.get(c.id) ?? 0,
    })),
    nombres: nombres.map(n => n.nombre),
    diaSinEntrenamiento: false,
  });
});

// PUT /clases/semana — una clase y todos sus dias, de un solo golpe.
//
// Una clase es una cosa que ocurre varios dias: «la de la mañana» es lunes,
// miercoles y viernes a las 6. En la base cada dia es una fila, porque la
// asistencia se toma por dia, pero quien arma el horario escribe el nombre, la
// hora y la sede UNA vez y marca los dias.
//
// Por eso esta ruta recibe el conjunto entero y no una clase suelta: crea los
// dias que faltan, actualiza los que siguen y apaga los que se desmarcaron. Con
// tres peticiones sueltas, si la segunda falla el horario queda a medias y el
// que lo abra despues no tiene como saber cual falto.
//
// `ids` son las filas que hoy forman esta clase; va vacio cuando es nueva.
router.put('/semana', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo administradores' });

  const parsed = z.object({
    ids:        z.array(z.string()).max(7).optional(),
    nombre:     z.string().min(1).max(60),
    locationId: z.string().min(1),
    // Al menos uno: una clase sin dias no aparece en ningun horario. Para
    // quitarla entera esta DELETE, que dice lo que hace.
    dias:       z.array(z.number().int().min(0).max(6)).min(1).max(7),
    hora:       z.string().regex(HORA, 'La hora debe ir en formato 24h, por ejemplo 06:00'),
    // Vacio = todas. Una clase puede recibir menores Y transicion.
    categorias: z.array(z.string().max(60)).max(20).optional(),
    color,
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  if (!await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(400).json({ error: 'La sede no pertenece a tu club' });
  }

  // Los dias repetidos se descartan: el mismo dia a la misma hora es la misma
  // clase dos veces.
  const dias = [...new Set(parsed.data.dias)];

  // Se atan al club antes de tocarlas: buscarlas solo por id dejaria editar el
  // horario de otro mandando ids ajenos.
  const actuales = parsed.data.ids?.length
    ? await prisma.claseHorario.findMany({
        where: { id: { in: parsed.data.ids }, clubId, activa: true },
        select: { id: true, diaSemana: true },
      })
    : [];

  const comun = {
    nombre:     parsed.data.nombre.trim(),
    locationId: parsed.data.locationId,
    hora:       parsed.data.hora,
    // Sin repetidas y sin vacias: dos veces «Menores» no filtra distinto, y una
    // cadena en blanco no coincide con la categoria de nadie.
    categorias: [...new Set((parsed.data.categorias ?? []).map(c => c.trim()).filter(Boolean))],
    color:      parsed.data.color ?? null,
  };

  const porDia = new Map(actuales.map(c => [c.diaSemana, c.id]));

  await prisma.$transaction([
    // Los dias que siguen conservan su fila, y con ella su asistencia: cambiar
    // la hora de la clase del lunes no puede borrar quien fue el lunes pasado.
    ...dias.filter(d => porDia.has(d)).map(d =>
      prisma.claseHorario.update({ where: { id: porDia.get(d)! }, data: comun })),

    ...dias.filter(d => !porDia.has(d)).map(d =>
      prisma.claseHorario.create({
        data: { ...comun, clubId, deporteId: carpetaDe(req), diaSemana: d },
      })),

    // Los desmarcados se apagan, no se borran: su historial de asistencia
    // sigue contando en los reportes, igual que al quitar una clase entera.
    ...actuales.filter(c => !dias.includes(c.diaSemana)).map(c =>
      prisma.claseHorario.update({ where: { id: c.id }, data: { activa: false } })),
  ]);

  emitToClub(clubId, 'attendance');
  res.json({ dias: dias.length });
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
