import { Router, Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma, prismaClubEntero } from '../db/client';
import { emitToClub } from '../lib/sse';
import { revokeClerkAccess, revokeClerkSessions } from '../lib/clerk-sesiones';
import { notifyClubStaff } from '../lib/notify';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { sedesSonDelClub } from '../lib/sedes';

import { invalidateMembersCache } from '../lib/deportistas';
import { yaExiste } from '../lib/inscripcion';
import { validarSubida } from '../lib/upload-guard';
import { uploadLimiter, createLimiter } from '../lib/rate-limit';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

const memberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  docType: z.string().optional(),
  docNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  guardianRelation: z.string().max(40).optional(),
  guardianDocNumber: z.string().max(30).optional(),
  eps: z.string().optional(),
  gender: z.string().max(20).optional(),
  rh: z.string().max(5).optional(),
  allergies: z.string().max(500).optional(),
  category: z.string().optional(),
  tipo: z.string().optional(),
  paymentDueDay: z.number().min(1).max(31).nullable().optional(),
  monthlyFee: z.number().positive().nullable().optional(),
  locationIds: z.array(z.string()).optional(),
  role: z.enum(['ADMIN', 'ENTRENADOR', 'DEPORTISTA']).optional(),
});

// La url debe ser del propio Cloudinary: es lo único que el frontend renderiza y
// lo único que un borrado posterior debe poder tocar.
const uploadSchema = z.object({
  field: z.enum(['picture', 'doc', 'insurance']),
  url: z.string().url().startsWith('https://res.cloudinary.com/'),
  publicId: z.string().min(1).max(200),
});

function getId(req: Request): string {
  return String(req.params.id);
}

// La gestion de miembros (crear, editar, eliminar, subir archivos) es exclusiva
// del administrador. El entrenador y el deportista tienen acceso de lectura, y
// cada quien puede editar sus propios datos de contacto por su cuenta.
function esAdmin(req: Request): boolean {
  return req.user?.role === 'ADMIN';
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

// GET /members
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  // Un DEPORTISTA necesita el listado para mostrar nombres en resultados, pero no
  // los datos personales (documento, EPS, contacto de emergencia, archivos ni
  // cuota). La llave de caché incluye el alcance para no servirle a un ADMIN la
  // versión reducida ni a un DEPORTISTA la completa.
  const isStudent = req.user.role === 'DEPORTISTA';
  // El deporte va en la clave por la misma razon que en sedes: una lista
  // cacheada por club se la serviria entera a la carpeta de al lado.
  const cacheKey = `members:${clubId}:${req.deporteId ?? ''}:${isStudent ? 'student' : 'staff'}`;

  const cached = await cacheGet<{ members: unknown[] }>(cacheKey);
  if (cached) return res.json(cached);

  // Los que llegaron por el enlace y esperan visto bueno no salen en la lista:
  // viven en su propia bandeja hasta que alguien los acepte. Si aparecieran
  // aca, el club los contaria como suyos y les pasaria asistencia sin haberlos
  // aceptado.
  const soloAprobados = { clubId, inscripcion: 'APROBADO' as const };

  const members = isStudent
    ? await prisma.member.findMany({
        where: soloAprobados,
        select: { id: true, fullName: true, pictureUrl: true, role: true, category: true, tipo: true, active: true },
        orderBy: { fullName: 'asc' },
      })
    : await prisma.member.findMany({
        where: soloAprobados,
        select: {
          id: true, fullName: true, email: true, phone: true, birthDate: true,
          pictureUrl: true, docType: true, docNumber: true, docFileUrl: true,
          insuranceFileUrl: true, emergencyContact: true, emergencyPhone: true,
          guardianRelation: true, guardianDocNumber: true, eps: true,
          gender: true, rh: true, allergies: true,
          category: true, tipo: true, paymentDueDay: true, monthlyFee: true,
          role: true, active: true, clerkId: true, inviteStatus: true,
          origen: true, aprobadoAt: true, createdAt: true,
          locations: { include: { location: true } },
        },
        orderBy: { fullName: 'asc' },
      });

  await cacheSet(cacheKey, { members }, 300); // 5 min
  res.json({ members });
});

// GET /members/birthdays — miembros con cumpleaños en los próximos 30 días
router.get('/birthdays', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const all = await prisma.member.findMany({
    where: { clubId, active: true, birthDate: { not: null } },
    select: { id: true, fullName: true, birthDate: true, pictureUrl: true, role: true },
  });

  // Normalizar "hoy" a medianoche para comparar solo por fecha
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = all
    .filter(m => m.birthDate)
    .map(m => {
      const bd = m.birthDate!;
      // Próxima ocurrencia del cumpleaños (este año o el siguiente)
      const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { id: m.id, fullName: m.fullName, pictureUrl: m.pictureUrl, role: m.role, birthDate: m.birthDate, daysUntil: diff };
    })
    .filter(m => m.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);

  res.json({ birthdays: result });
});

// GET /members/me — retorna el Member vinculado al usuario autenticado
router.get('/me', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const member = await prisma.member.findFirst({
    where: {
      clubId: req.user.clubId ?? '',
      OR: [
        { clerkId: req.auth?.clerkId },
        ...(req.auth?.email ? [{ email: { equals: req.auth.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { id: true, fullName: true, role: true, pictureUrl: true, phone: true, category: true, tipo: true, email: true, createdAt: true },
  });
  if (!member) return res.json({ member: null });
  res.json({ member });
});


/**
 * Hasta cuando vale el carnet.
 *
 * La vigencia va atada a la mensualidad: el carnet vale hasta el ultimo dia del
 * mes mas reciente que el deportista tiene pago. Se mira el mes pagado y no la
 * fecha del pago porque quien paga adelantado tiene que quedar cubierto hasta
 * donde pago, no hasta hoy.
 *
 * Sin un solo pago registrado el carnet NO sale vencido, sale sin fecha. Hay
 * clubes que todavia no llevan las mensualidades en la plataforma, y marcarles
 * a todo el mundo el carnet como vencido seria acusarlos de una mora que nadie
 * registro.
 */
async function vigenciaDe(memberId: string): Promise<{
  estado: 'vigente' | 'vencido' | 'sin_registro';
  hasta: string | null;
}> {
  const pagado = await prisma.payment.findFirst({
    where: { memberId, status: 'PAID' },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: { year: true, month: true },
  });
  if (!pagado) {
    const alguno = await prisma.payment.count({ where: { memberId } });
    if (alguno === 0) return { estado: 'sin_registro', hasta: null };
    return { estado: 'vencido', hasta: null };
  }

  // Dia cero del mes siguiente es el ultimo del mes pagado, sin tabla de dias.
  const fin = new Date(Date.UTC(pagado.year, pagado.month, 0, 12));
  const hoy = new Date();
  return {
    estado: fin.getTime() >= hoy.getTime() ? 'vigente' : 'vencido',
    hasta: fin.toISOString().slice(0, 10),
  };
}

/**
 * GET /members/verificar — ¿este correo o este documento ya están usados?
 *
 * La usa el formulario mientras alguien escribe, para avisar en el momento en
 * vez de al guardar, cuando ya llenó toda la ficha. Devuelve si está ocupado y
 * nada más: decir de quién es le mostraría a un administrador el dato de otra
 * persona, y bastaría con probar números para ir sacando nombres.
 *
 * Nunca reemplaza la comprobación del guardado. Dos pestañas abiertas pueden
 * pasar las dos por acá y chocar después; la que manda es la de POST y PATCH.
 */
router.get('/verificar', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!clubId) return res.json({ correo: false, documento: false });

  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const docNumber = typeof req.query.docNumber === 'string' ? req.query.docNumber : undefined;
  const excepto = typeof req.query.excepto === 'string' ? req.query.excepto : undefined;

  const ocupado = await yaExiste({ clubId, email, docNumber, exceptoMemberId: excepto });
  res.json(ocupado);
});

// ── Ojo con el orden ──────────────────────────────────────────────────────────
// Express atiende la PRIMERA ruta que encaja, no la mas especifica. Todo lo que
// cuelgue de /members con un solo tramo y nombre fijo tiene que ir ARRIBA de
// `/:id`, o `/:id` se lo come. Le paso a `/verificar`: entraba como si
// «verificar» fuera el id de alguien, devolvia 404, y el aviso de correo o
// documento repetido no salia nunca porque el formulario se traga el error.
// GET /members/:id
router.get('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);
  const member = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
    include: { locations: { include: { location: true } } },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
  res.json({ member });
});

/**
 * GET /members/:id/carnet - todo lo que el carnet digital necesita.
 *
 * Va en su propia ruta y no colgado de GET /:id porque el carnet lo abre
 * tambien el deportista, y ese no puede ver la ficha completa de nadie, ni la
 * suya con los campos administrativos. Aca sale lo justo del carnet.
 *
 * Quien puede abrirlo:
 *  - ADMIN, cualquiera de su club.
 *  - ENTRENADOR, los de su carpeta. No hace falta escribirlo: el cliente de
 *    Prisma ya filtra por deporte, asi que la consulta no ve mas alla.
 *  - DEPORTISTA, el suyo y solo el suyo.
 */
router.get('/:id/carnet', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);
  const clubId = req.user.clubId ?? '';

  const member = await prisma.member.findFirst({
    where: { id, clubId },
    select: {
      id: true, fullName: true, pictureUrl: true, clerkId: true, email: true,
      docType: true, docNumber: true, birthDate: true, gender: true,
      category: true, tipo: true, role: true, active: true, createdAt: true,
      rh: true, allergies: true, eps: true,
      emergencyContact: true, emergencyPhone: true, guardianRelation: true,
      deporte: { select: { nombre: true } },
      locations: { select: { location: { select: { name: true } } } },
    },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  // El deportista solo puede sacar el suyo. Se compara contra el clerkId y, si
  // la ficha todavia no lo tiene, contra el correo, que es como /me resuelve
  // el mismo vinculo.
  if (req.user.role === 'DEPORTISTA') {
    const propio = (member.clerkId && member.clerkId === req.auth?.clerkId)
      || (!!member.email && !!req.auth?.email && member.email.toLowerCase() === req.auth.email.toLowerCase());
    if (!propio) return res.status(403).json({ error: 'Solo puedes ver tu propio carnet' });
  }

  const club = await prismaClubEntero.club.findUnique({
    where: { id: clubId },
    select: {
      name: true, city: true, logoUrl: true,
      colorPrimario: true, colorSecundario: true, carnetMarcaAgua: true,
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const vigencia = await vigenciaDe(member.id);

  res.json({
    carnet: {
      miembro: {
        id: member.id,
        nombre: member.fullName,
        foto: member.pictureUrl,
        docTipo: member.docType,
        docNumero: member.docNumber,
        nacimiento: member.birthDate,
        categoria: member.category,
        tipo: member.tipo,
        rol: member.role,
        activo: member.active,
        desde: member.createdAt,
        rh: member.rh,
        alergias: member.allergies,
        eps: member.eps,
        acudiente: member.emergencyContact,
        acudienteTelefono: member.emergencyPhone,
        acudienteParentesco: member.guardianRelation,
        sede: member.locations[0]?.location.name ?? null,
        deporte: member.deporte?.nombre ?? null,
      },
      club: {
        nombre: club.name,
        ciudad: club.city,
        logo: club.logoUrl,
        colorPrimario: club.colorPrimario,
        colorSecundario: club.colorSecundario,
        marcaAgua: club.carnetMarcaAgua,
      },
      vigencia,
    },
  });
});

// POST /members
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { locationIds, birthDate, ...rest } = parsed.data;
  rest.fullName = toTitleCase(rest.fullName);

  if (locationIds && !await sedesSonDelClub(locationIds, req.user.clubId ?? '')) {
    return res.status(403).json({ error: 'Una o más sedes no pertenecen a este club' });
  }


  // Correo y documento no se repiten dentro del club. La base todavia no lo
  // garantiza con un indice, asi que la comprobacion de verdad es esta.
  const ocupado = await yaExiste({
    clubId: req.user.clubId ?? '',
    email: rest.email,
    docNumber: rest.docNumber,
  });
  if (ocupado.documento) {
    return res.status(409).json({ campo: 'docNumber', error: 'Ese documento ya está registrado en este club' });
  }
  if (ocupado.correo) {
    return res.status(409).json({ campo: 'email', error: 'Ese correo ya está registrado en este club' });
  }

  let member;
  try {
    member = await prisma.member.create({
      data: {
        ...rest,
        email: rest.email || undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        clubId: req.user.clubId ?? '',
        deporteId: carpetaDe(req),
        locations: locationIds?.length
          ? { create: locationIds.map((locId) => ({ locationId: locId })) }
          : undefined,
      },
      include: {
        locations: { include: { location: true } },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Ese correo ya está registrado en este club' });
    }
    const msg = err instanceof Error ? err.message : 'Error al crear el miembro';
    return res.status(500).json({ error: msg });
  }

  await invalidateMembersCache(req.user.clubId ?? '', req.deporteId ?? '');
  emitToClub(req.user.clubId ?? '', 'members');
  await notifyClubStaff(req.user.clubId ?? '', {
    tipo: 'NEW_MEMBER',
    titulo: 'Nuevo miembro',
    cuerpo: `${member.fullName} fue agregado al club.`,
    link: '/dashboard/miembros',
  }, req.auth?.clerkId);
  res.status(201).json({ member });
});

// PATCH /members/bulk-fee — configura tarifa + día de cobro de forma masiva.
// Solo aplica a los deportistas (DEPORTISTA) que aún NO tienen tarifa (no pisa
// tarifas individuales). Actualiza también los cobros pendientes de esos miembros.
router.patch('/bulk-fee', createLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });

  const parsed = z.object({
    monthlyFee:    z.number().positive(),
    paymentDueDay: z.number().int().min(1).max(31),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { monthlyFee, paymentDueDay } = parsed.data;
  const clubId = req.user.clubId ?? '';

  // Solo los deportistas sin tarifa configurada
  const targets = await prisma.member.findMany({
    where: { clubId, role: 'DEPORTISTA', monthlyFee: null },
    select: { id: true },
  });
  const ids = targets.map(t => t.id);
  if (ids.length === 0) return res.json({ updated: 0 });

  await prisma.member.updateMany({
    where: { id: { in: ids } },
    data: { monthlyFee, paymentDueDay },
  });

  // Reflejar el valor en cobros aún no pagados de esos miembros (los PAID no se tocan)
  await prisma.payment.updateMany({
    where: { memberId: { in: ids }, clubId, status: { in: ['PENDING', 'OVERDUE'] } },
    data: { amount: monthlyFee },
  });

  await invalidateMembersCache(clubId, req.deporteId ?? '');
  emitToClub(clubId, 'members');
  emitToClub(clubId, 'payments');
  res.json({ updated: ids.length });
});

// PUT /members/:id
router.put('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { locationIds, birthDate, ...rest } = parsed.data;
  if (rest.fullName) rest.fullName = toTitleCase(rest.fullName);

  if (locationIds && !await sedesSonDelClub(locationIds, req.user.clubId ?? '')) {
    return res.status(403).json({ error: 'Una o más sedes no pertenecen a este club' });
  }


  // Al editar, el propio miembro no cuenta como choque consigo mismo. Y solo se
  // revisa lo que de verdad cambio: si alguien viejo ya venia con el correo
  // repetido, corregirle el telefono no puede quedar bloqueado por eso.
  const ocupadoEd = await yaExiste({
    clubId: req.user.clubId ?? '',
    email:     rest.email     !== existing.email     ? rest.email     : undefined,
    docNumber: rest.docNumber !== existing.docNumber ? rest.docNumber : undefined,
    exceptoMemberId: id,
  });
  if (ocupadoEd.documento) {
    return res.status(409).json({ campo: 'docNumber', error: 'Ese documento ya está registrado en este club' });
  }
  if (ocupadoEd.correo) {
    return res.status(409).json({ campo: 'email', error: 'Ese correo ya está registrado en este club' });
  }

  if (locationIds !== undefined) {
    await prisma.memberLocation.deleteMany({ where: { memberId: id } });
  }


  const member = await prisma.member.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email || undefined,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      locations: locationIds?.length
        ? { create: locationIds.map((locId) => ({ locationId: locId })) }
        : undefined,
    },
    include: {
      locations: { include: { location: true } },
    },
  });

  // Si cambió la tarifa mensual, reflejarla en los pagos aún no pagados
  // (PENDING / OVERDUE). Los pagos ya cobrados (PAID) no se tocan.
  if (typeof rest.monthlyFee === 'number' && rest.monthlyFee > 0) {
    await prisma.payment.updateMany({
      where: {
        memberId: id,
        clubId: req.user.clubId ?? '',
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      data: { amount: rest.monthlyFee },
    });
  }

  // Sincronizar rol en User y revocar sesiones si el rol cambió
  if (rest.role && member.clerkId) {
    await prisma.user.updateMany({
      where: { clerkId: member.clerkId },
      data:  { role: rest.role },
    });
    // Forzar nuevo login para que el JWT refleje el rol actualizado
    const roleCambio = existing.role !== rest.role;
    if (roleCambio) await revokeClerkSessions(member.clerkId);
  }

  await invalidateMembersCache(req.user.clubId ?? '', req.deporteId ?? '');
  emitToClub(req.user.clubId ?? '', 'members');
  res.json({ member });
});

// PATCH /members/me/contact — el usuario actualiza su propio teléfono.
// Resuelve el Member desde el token (no depende de un id enviado por el cliente).
// IMPORTANTE: definir antes de '/:id/contact' para que no lo capture la ruta con :id.
router.patch('/me/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  // Primero por clerkId, que es el vínculo firme, y solo si no aparece, por
  // correo. Los miembros que crea el superadmin arrancan sin clerkId hasta su
  // primer ingreso, y por eso hace falta la segunda búsqueda.
  //
  // Las dos iban juntas en un `OR`, y ahí estaba el error. Con dos fichas del
  // mismo correo, una ya vinculada y otra sin vincular, el `OR` podía devolver
  // cualquiera de las dos: sin `orderBy` el orden no está garantizado. Si
  // devolvía la que no tiene clerkId, el auto-vinculado de abajo intentaba
  // escribir un clerkId que ya era de la otra.
  const porClerk = req.auth?.clerkId
    ? await prisma.member.findFirst({
        where: { clubId: req.user.clubId ?? '', clerkId: req.auth.clerkId },
      })
    : null;

  const existing = porClerk ?? (req.auth?.email
    ? await prisma.member.findFirst({
        where: {
          clubId: req.user.clubId ?? '',
          email: { equals: req.auth.email, mode: 'insensitive' as const },
        },
      })
    : null);

  if (!existing) return res.status(404).json({ error: 'No encontramos tu perfil de miembro' });

  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() || null : null;
  const salida = {
    id: true, fullName: true, role: true, pictureUrl: true,
    phone: true, email: true, category: true, tipo: true, createdAt: true,
  } as const;

  // El auto-vinculado se intenta, pero no manda.
  //
  // `Member.clerkId` es único en toda la tabla, no por club ni por deporte, así
  // que la ficha que ya tenga esa cuenta puede estar donde la búsqueda de
  // arriba no la ve: en otro deporte del club, que el filtro de carpeta
  // esconde, o en otro club. La base rechaza el update y antes se caía la
  // petición entera, con lo cual el usuario no podía ni guardar su teléfono,
  // que es lo único que vino a hacer. Ahora el teléfono se guarda y el vínculo
  // se queda pendiente.
  try {
    const member = await prisma.member.update({
      where: { id: existing.id },
      data: { phone, ...(existing.clerkId ? {} : { clerkId: req.auth?.clerkId }) },
      select: salida,
    });
    return res.json({ member });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    const member = await prisma.member.update({
      where: { id: existing.id },
      data: { phone },
      select: salida,
    });
    return res.json({ member });
  }
});

// PATCH /members/:id/contact — actualiza solo teléfono y correo (usado desde Mi Perfil)
router.patch('/:id/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Mi Perfil usa esta ruta para que cada quien edite su propio telefono y
  // correo. Sobre los datos de otra persona solo puede escribir el administrador.
  const esPropio = !!req.auth?.clerkId && existing.clerkId === req.auth.clerkId;
  if (!esPropio && !esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });

  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() || null : null;
  const email = typeof req.body.email === 'string' ? req.body.email.trim() || null : null;

  const member = await prisma.member.update({
    where: { id },
    data: { phone, email: email || undefined },
    select: { id: true, fullName: true, role: true, pictureUrl: true, phone: true, email: true, category: true, tipo: true },
  });

  res.json({ member });
});

// PATCH /members/:id/estado — pausa temporal, no borrado.
// Los deportistas se van de vacaciones en noviembre y vuelven en febrero: en vez
// de eliminarlos y volver a crearlos (perdiendo asistencias, resultados y
// pagos), se desactivan y se reactivan conservando todo.
const estadoSchema = z.object({ active: z.boolean() });

router.patch('/:id/estado', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });

  const parsed = estadoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const id = getId(req);
  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Un administrador que se desactive a sí mismo se deja fuera de su propio club
  // sin nadie que pueda revertirlo desde la app.
  if (!parsed.data.active && existing.clerkId && existing.clerkId === req.auth?.clerkId) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
  }

  const member = await prisma.member.update({
    where: { id },
    data: {
      active: parsed.data.active,
      desactivadoAt: parsed.data.active ? null : new Date(),
    },
    include: { locations: { include: { location: true } } },
  });

  // Al desactivar se cierran las sesiones abiertas para que el bloqueo sea
  // inmediato y no espere a que caduque el token. La barrera de verdad es GET
  // /me, que responde 'inactive' y manda a /inactivo. La cuenta no se banea:
  // reactivar debe ser un clic, no una reinvitación.
  if (!parsed.data.active && existing.clerkId) {
    try { await revokeClerkSessions(existing.clerkId); } catch { /* el gate de /me igual bloquea */ }
  }

  await invalidateMembersCache(req.user.clubId ?? '', req.deporteId ?? '');
  emitToClub(req.user.clubId ?? '', 'members');
  res.json({ member });
});

// DELETE /members/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Nadie puede borrarse a si mismo. El borrado revoca el acceso en Clerk y
  // banea la cuenta, asi que quien lo hiciera quedaria fuera de su propio club
  // sin forma de volver a entrar; y si era el unico administrador, el club se
  // queda sin nadie que pueda gestionarlo.
  //
  // Se compara por clerkId, como en el endpoint de estado, y ademas por correo:
  // un miembro invitado que todavia no vinculo su cuenta no tiene clerkId, pero
  // sigue siendo la misma persona.
  const mismoClerk = !!existing.clerkId && existing.clerkId === req.auth?.clerkId;
  const mismoCorreo = !!existing.email && !!req.auth?.email
    && existing.email.trim().toLowerCase() === req.auth.email.trim().toLowerCase();
  if (mismoClerk || mismoCorreo) {
    return res.status(400).json({
      error: 'No puedes eliminar tu propio usuario. Pídele a otro administrador que lo haga.',
    });
  }

  // Revocar acceso Clerk: banear la cuenta si existe
  if (existing.clerkId) {
    await revokeClerkAccess(existing.clerkId);
  }

  const resumenPrevio = await prisma.member.findUnique({
    where: { id },
    select: { _count: { select: { payments: true, attendances: true } } },
  }).catch(() => null);

  await prisma.member.delete({ where: { id } });


  // Desvincular el User (cuenta de login) si seguía apuntando a este club — si no se
  // limpia, un correo reutilizado en otro club queda con el login "fantasma" del club
  // viejo (el GET /me lo resuelve por User antes que por Member).
  //
  // Pero solo si a la persona no le queda OTRO registro de miembro en el mismo
  // club. Sin esta comprobacion, borrar un registro duplicado desvinculaba la
  // cuenta de alguien que sigue perteneciendo al club: se quedaba sin poder
  // abrir Ajustes (GET /clubs/settings buscaba un club con id vacio y respondia
  // 404) y sin poder asignar sedes al crear miembros. Le paso a tres cuentas,
  // entre ellas dos administradores.
  const identidad = [
    ...(existing.clerkId ? [{ clerkId: existing.clerkId }] : []),
    ...(existing.email ? [{ email: existing.email }] : []),
  ];

  if (identidad.length > 0) {
    const leQuedaOtroMiembro = await prisma.member.findFirst({
      where: { clubId: req.user.clubId ?? '', OR: identidad },
      select: { id: true },
    });

    if (!leQuedaOtroMiembro) {
      await prisma.user.updateMany({
        where: { clubId: req.user.clubId ?? '', OR: identidad },
        data: { clubId: null },
      });
    }
  }

  await invalidateMembersCache(req.user.clubId ?? '', req.deporteId ?? '');
  emitToClub(req.user.clubId ?? '', 'members');
  res.json({ ok: true });
});

// POST /members/:id/upload
router.post('/:id/upload', uploadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);

  const existing = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
  });
  if (!existing) return res.status(404).json({ error: 'Miembro no encontrado' });

  // Antes se guardaba cualquier url y publicId del cuerpo. Eso permitía apuntar
  // los campos de archivo a un dominio externo, o guardar el publicId de otro
  // tenant de Cloudinary que un borrado posterior habría eliminado.
  const parsedUpload = uploadSchema.safeParse(req.body);
  if (!parsedUpload.success) return res.status(400).json({ error: parsedUpload.error.issues });
  const { field, url, publicId } = parsedUpload.data;

  const fieldMap: Record<string, object> = {
    picture: { pictureUrl: url, picturePublicId: publicId },
    doc: { docFileUrl: url, docFilePublicId: publicId },
    insurance: { insuranceFileUrl: url, insurancePublicId: publicId },
  };

  const member = await prisma.member.update({
    where: { id },
    data: fieldMap[field],
  });
  res.json({ member });
});

// POST /members/me/picture — deportista sube su propia foto de perfil
router.post('/me/picture', uploadLimiter, requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const member = await prisma.member.findFirst({
    where: { clerkId: req.auth.clerkId },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  const { base64 } = req.body as { base64: string };
  const vFoto = validarSubida(base64, 'image');
  if (!vFoto.ok) return res.status(400).json({ error: vFoto.error });

  try {
    // Eliminar foto anterior si existe
    if (member.picturePublicId) {
      await cloudinary.uploader.destroy(member.picturePublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/members',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    });

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { pictureUrl: result.secure_url, picturePublicId: result.public_id },
    });

    res.json({ pictureUrl: updated.pictureUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al subir imagen';
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /members/:id/archivo — el club sube el documento o la póliza.
 *
 * Recibe el archivo en base64 y lo sube desde el servidor, igual que la foto de
 * perfil. El endpoint viejo de arriba espera una url ya subida a Cloudinary, lo
 * que obligaría al navegador a hablar con Cloudinary por su cuenta; este sigue
 * el camino que usa el resto del proyecto.
 */
router.post('/:id/archivo', uploadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!esAdmin(req)) return res.status(403).json({ error: 'Solo administradores' });
  const id = getId(req);

  const parsed = z.object({
    campo:  z.enum(['doc', 'insurance']),
    base64: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { campo, base64 } = parsed.data;

  // Un documento puede llegar como foto o como PDF, así que se valida con el
  // criterio de documento y no con el de imagen.
  const v = validarSubida(base64, 'doc');
  if (!v.ok) return res.status(400).json({ error: v.error });

  const member = await prisma.member.findFirst({
    where: { id, clubId: req.user.clubId ?? '' },
    select: { id: true, docFilePublicId: true, insurancePublicId: true },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  try {
    // El anterior se borra: si no, cada reemplazo deja basura pagada en
    // Cloudinary que nadie va a volver a mirar.
    const anterior = campo === 'doc' ? member.docFilePublicId : member.insurancePublicId;
    if (anterior) {
      await cloudinary.uploader.destroy(anterior, { resource_type: 'image' }).catch(() => {});
    }

    const subido = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/documentos',
      resource_type: 'auto',
    });

    const datos = campo === 'doc'
      ? { docFileUrl: subido.secure_url, docFilePublicId: subido.public_id }
      : { insuranceFileUrl: subido.secure_url, insurancePublicId: subido.public_id };

    const actualizado = await prisma.member.update({ where: { id }, data: datos });
    await invalidateMembersCache(req.user.clubId ?? '', req.deporteId ?? '');

    res.json({
      url: campo === 'doc' ? actualizado.docFileUrl : actualizado.insuranceFileUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al subir el archivo';
    res.status(500).json({ error: msg });
  }
});

export default router;
