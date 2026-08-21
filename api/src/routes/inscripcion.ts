import { Router } from 'express';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { requireAuth } from '../auth/middleware';
import {
  asegurarToken, rotarToken, urlDeInscripcion, esMenor, yaExiste,
  reconocerPorDocumento, soloLoQueCambia, NOMBRE_CAMPO,
} from '../lib/inscripcion';
import { CATEGORIAS, NIVELES } from '../lib/catalogos';
import { strictLimiter, guessLimiter } from '../lib/rate-limit';
import { registrarEvento } from '../lib/auditoria';
import { notifyClubStaff } from '../lib/notify';
import { invalidateMembersCache } from '../lib/deportistas';
import { emitToClub } from '../lib/sse';

/**
 * Inscripcion por enlace.
 *
 * Dos mundos en el mismo archivo, separados a proposito por el middleware: las
 * rutas de arriba son PUBLICAS (las abre una familia sin cuenta) y las de abajo
 * exigen ser administrador del club.
 */
const router = Router();

// Titulo de una persona: cada palabra con su inicial en mayuscula. El mismo
// criterio que usa el resto del sistema para no tener dos formas del nombre.
function tituloDe(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLICO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /inscripcion/:token — lo que necesita pintar el formulario.
 *
 * Devuelve el minimo: nombre y logo del club para que la familia sepa donde
 * esta, y las sedes para poder elegir. Nada de la lista de deportistas ni de la
 * suscripcion: esta url la abre cualquiera que tenga el enlace.
 */
router.get('/:token', guessLimiter, async (req, res) => {
  const token = String(req.params.token);

  const club = await prisma.club.findUnique({
    where: { inscripcionToken: token },
    select: {
      id: true, name: true, logoUrl: true, active: true, inscripcionAbierta: true,
      locations: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  });

  // Un club que no existe y uno con la inscripcion cerrada responden lo mismo:
  // asi el enlace viejo no confirma que el club exista.
  if (!club || !club.active || !club.inscripcionAbierta) {
    return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  }

  res.json({
    club: { nombre: club.name, logoUrl: club.logoUrl },
    sedes: club.locations,
    categorias: CATEGORIAS,
    niveles: NIVELES,
  });
});

/**
 * POST /inscripcion/:token/reconocer — ¿este documento ya está en el club?
 *
 * La llama el formulario al salir del primer paso, para saber si lo que sigue
 * es una inscripción nueva o una actualización. Devuelve el nombre solo cuando
 * documento y fecha coinciden: si respondiera con el nombre viendo solo el
 * documento, sería una forma de sacar nombres probando cédulas.
 */
router.post('/:token/reconocer', guessLimiter, async (req, res) => {
  const club = await prisma.club.findUnique({
    where: { inscripcionToken: String(req.params.token) },
    select: { id: true, active: true, inscripcionAbierta: true },
  });
  if (!club || !club.active || !club.inscripcionAbierta) {
    return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  }

  const parsed = z.object({
    docNumber: z.string().min(3).max(30),
    birthDate: z.string().min(8),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos incompletos.' });

  const quien = await reconocerPorDocumento({ clubId: club.id, ...parsed.data });

  if (quien.estado === 'ajeno') {
    return res.status(409).json({
      campo: 'docNumber',
      error: 'Ese documento ya está registrado en este club y los datos no coinciden. Si crees que es un error, habla con el club.',
    });
  }

  res.json(quien.estado === 'nuevo'
    ? { modo: 'nuevo' }
    : { modo: 'actualiza', nombre: quien.nombre, tieneCuenta: quien.tieneCuenta });
});

const inscripcionSchema = z.object({
  fullName:  z.string().min(2).max(100),
  birthDate: z.string().min(8),
  docType:   z.string().min(1).max(10),
  docNumber: z.string().min(3).max(30),
  phone:     z.string().min(5).max(30),
  // Quien ya esta en el club y tiene cuenta no los manda: su acceso no se toca
  // desde el formulario. Se exigen mas abajo, cuando la inscripcion es nueva.
  email:     z.string().email().max(120).optional(),
  password:  z.string().min(8).max(100).optional(),
  // Del acudiente. Solo se exigen cuando el deportista es menor, y eso se
  // decide aca con la fecha, no confiando en lo que diga el cliente.
  guardianName:      z.string().max(100).optional(),
  guardianRelation:  z.string().max(40).optional(),
  guardianDocNumber: z.string().max(30).optional(),
  guardianPhone:     z.string().max(30).optional(),
  locationId: z.string().min(1),
  category:   z.string().max(60).optional(),
  tipo:       z.string().max(40).optional(),
  eps:        z.string().max(80).optional(),
  gender:     z.string().max(20).optional(),
  rh:         z.string().max(5).optional(),
  allergies:  z.string().max(500).optional(),
  aceptaTerminos: z.literal(true),
});

/**
 * POST /inscripcion/:token — la familia envia sus datos.
 *
 * Crea el deportista en estado PENDIENTE y su cuenta de acceso con la
 * contrasena que eligieron. La cuenta existe desde ya, pero no sirve hasta que
 * el club apruebe: quien manda es el estado del miembro, no la cuenta.
 */
router.post('/:token', strictLimiter, async (req, res) => {
  const token = String(req.params.token);

  const club = await prisma.club.findUnique({
    where: { inscripcionToken: token },
    select: { id: true, name: true, active: true, inscripcionAbierta: true },
  });
  if (!club || !club.active || !club.inscripcionAbierta) {
    return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  }

  const parsed = inscripcionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Revisa los datos del formulario.', detalle: parsed.error.issues });
  }
  const d = parsed.data;

  const nacimiento = new Date(d.birthDate);
  if (Number.isNaN(nacimiento.getTime()) || nacimiento > new Date()) {
    return res.status(400).json({ error: 'La fecha de nacimiento no es válida.' });
  }

  // Un menor sin acudiente no se registra: es quien autoriza el tratamiento de
  // sus datos, no el niño.
  if (esMenor(nacimiento) && !d.guardianName?.trim()) {
    return res.status(400).json({ error: 'Falta el nombre del acudiente.' });
  }

  // La sede tiene que ser de este club: sin esta comprobacion, el cuerpo del
  // formulario podria apuntar a la sede de otro.
  const sede = await prisma.location.findFirst({
    where: { id: d.locationId, clubId: club.id },
    select: { id: true },
  });
  if (!sede) return res.status(400).json({ error: 'La sede seleccionada no existe.' });

  // ¿Es alguien que ya está en el club completando sus datos, o alguien nuevo?
  const quien = await reconocerPorDocumento({
    clubId: club.id, docNumber: d.docNumber, birthDate: d.birthDate,
  });

  if (quien.estado === 'ajeno') {
    return res.status(409).json({
      campo: 'docNumber',
      error: 'Ese documento ya está registrado en este club y los datos no coinciden. Si crees que es un error, habla con el club.',
    });
  }

  // ── Ya está en el club: se guarda lo que cambia y espera visto bueno ──────
  if (quien.estado === 'reconocido') {
    const actual = await prisma.member.findUnique({
      where: { id: quien.id },
      select: {
        fullName: true, phone: true, docType: true, docNumber: true, birthDate: true,
        emergencyContact: true, emergencyPhone: true, guardianRelation: true,
        guardianDocNumber: true, eps: true, gender: true, rh: true, allergies: true,
        category: true, tipo: true, active: true, email: true,
      },
    });
    if (!actual) return res.status(404).json({ error: 'Ese deportista ya no está en el club.' });

    const cambios = soloLoQueCambia(actual as Record<string, unknown>, {
      fullName: tituloDe(d.fullName),
      phone: d.phone,
      docType: d.docType,
      birthDate: d.birthDate,
      emergencyContact: d.guardianName?.trim(),
      emergencyPhone: d.guardianPhone?.trim(),
      guardianRelation: d.guardianRelation?.trim(),
      guardianDocNumber: d.guardianDocNumber?.trim(),
      eps: d.eps?.trim(),
      gender: d.gender,
      rh: d.rh,
      allergies: d.allergies?.trim(),
      category: d.category,
      tipo: d.tipo,
      // El correo solo entra si todavía no tiene: cambiar el de alguien con
      // cuenta sería quedarse con su acceso.
      ...(actual.email || quien.tieneCuenta ? {} : { email: d.email?.trim().toLowerCase() }),
    });

    if (Object.keys(cambios).length === 0) {
      return res.json({ ok: true, modo: 'sin_cambios', nombre: actual.fullName });
    }

    // Una sola actualización a la vez: la nueva reemplaza a la anterior, para
    // que el club revise lo último que mandaron y no una fila de versiones.
    await prisma.member.update({
      where: { id: quien.id },
      data: { cambiosPendientes: { enviadoEn: new Date().toISOString(), cambios } },
    });

    await registrarEvento({
      accion: 'ACTUALIZACION_RECIBIDA',
      entidad: 'Member',
      entidadId: quien.id,
      resumen: `${actual.fullName} envió ${Object.keys(cambios).length} cambio(s) por el enlace de ${club.name}.`,
      clubId: club.id,
      clubNombre: club.name,
      datos: { campos: Object.keys(cambios) },
    });

    await notifyClubStaff(club.id, {
      tipo: 'ACTUALIZACION_RECIBIDA',
      titulo: 'Datos actualizados',
      cuerpo: `${actual.fullName} envió cambios en su ficha y esperan tu visto bueno.`,
      link: '/dashboard/miembros',
    }).catch(() => { /* el aviso no puede tumbar la actualizacion */ });

    emitToClub(club.id, 'members');
    return res.json({ ok: true, modo: 'actualiza', nombre: actual.fullName });
  }

  // ── Inscripción nueva: acá sí hacen falta correo y contraseña ────────────
  if (!d.email || !d.password) {
    return res.status(400).json({
      campo: !d.email ? 'email' : 'password',
      error: !d.email ? 'Falta el correo.' : 'Falta la contraseña.',
    });
  }

  const choque = await yaExiste({ clubId: club.id, email: d.email });
  if (choque.correo) {
    return res.status(409).json({
      campo: 'email',
      error: 'Ese correo ya está registrado en este club. Cada deportista necesita el suyo para entrar a la app.',
    });
  }

  // La cuenta se crea antes que el miembro: si Clerk rechaza el correo o la
  // contrasena, no queda un deportista a medias en la base.
  let clerkId: string | null = null;
  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    const [nombre, ...resto] = tituloDe(d.fullName).split(' ');
    const cuenta = await clerk.users.createUser({
      emailAddress: [d.email!.trim()],
      password: d.password!,
      firstName: nombre,
      lastName: resto.join(' ') || undefined,
      skipPasswordChecks: false,
    });
    clerkId = cuenta.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[inscripcion] no se pudo crear la cuenta', msg);
    // Clerk responde con detalle util (correo ya usado en otro club, clave
    // debil). Se traduce a algo accionable en vez del error crudo.
    const yaUsado = /already|taken|exists/i.test(msg);
    const claveDebil = /password|pwned|breach|weak|common/i.test(msg);
    if (yaUsado) {
      return res.status(409).json({ campo: 'email', error: 'Ese correo ya tiene una cuenta. Usa otro para este deportista.' });
    }
    if (claveDebil) {
      return res.status(400).json({ campo: 'password', error: 'Esa contraseña es muy fácil de adivinar. Elige otra.' });
    }
    Sentry.captureException(err, { tags: { route: 'inscripcion/enviar' }, extra: { clubId: club.id } });
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' });
  }

  try {
    const miembro = await prisma.member.create({
      data: {
        clubId: club.id,
        fullName: tituloDe(d.fullName),
        email: d.email!.trim().toLowerCase(),
        phone: d.phone,
        birthDate: nacimiento,
        docType: d.docType,
        docNumber: d.docNumber.trim(),
        emergencyContact:  d.guardianName?.trim() || null,
        emergencyPhone:    d.guardianPhone?.trim() || null,
        guardianRelation:  d.guardianRelation?.trim() || null,
        guardianDocNumber: d.guardianDocNumber?.trim() || null,
        eps: d.eps?.trim() || null,
        gender: d.gender || null,
        rh: d.rh || null,
        allergies: d.allergies?.trim() || null,
        category: d.category || null,
        tipo: d.tipo || null,
        role: 'STUDENT',
        clerkId,
        inviteStatus: 'ACCEPTED',
        origen: 'FORMULARIO',
        inscripcion: 'PENDIENTE',
        locations: { create: [{ locationId: sede.id }] },
      },
      select: { id: true, fullName: true },
    });

    await registrarEvento({
      accion: 'INSCRIPCION_RECIBIDA',
      entidad: 'Member',
      entidadId: miembro.id,
      resumen: `${miembro.fullName} se inscribió por el enlace de ${club.name} y espera visto bueno.`,
      clubId: club.id,
      clubNombre: club.name,
      datos: { origen: 'FORMULARIO' },
    });

    await notifyClubStaff(club.id, {
      tipo: 'INSCRIPCION_RECIBIDA',
      titulo: 'Nueva inscripción',
      cuerpo: `${miembro.fullName} se inscribió por el enlace y espera tu visto bueno.`,
      link: '/dashboard/miembros',
    }).catch(() => { /* el aviso no puede tumbar la inscripcion */ });

    await invalidateMembersCache(club.id);
    emitToClub(club.id, 'members');

    res.status(201).json({ ok: true, nombre: miembro.fullName });
  } catch (err) {
    // El miembro no se creo pero la cuenta si: se borra para que el correo
    // quede libre y la familia pueda volver a intentar.
    if (clerkId) {
      try {
        const { createClerkClient } = await import('@clerk/backend');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        await clerk.users.deleteUser(clerkId);
      } catch { /* si falla, queda la cuenta huerfana y se limpia aparte */ }
    }
    console.error('[inscripcion] no se pudo crear el miembro', err instanceof Error ? err.message : err);
    Sentry.captureException(err, { tags: { route: 'inscripcion/enviar' }, extra: { clubId: club.id } });
    res.status(500).json({ error: 'No se pudo completar la inscripción. Intenta de nuevo.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DEL CLUB — de aca para abajo, todo exige sesion
// ─────────────────────────────────────────────────────────────────────────────

function soloAdmin(req: import('express').Request, res: import('express').Response): boolean {
  if (!req.user) { res.status(401).json({ error: 'No autenticado' }); return false; }
  if (req.user.role !== 'ADMIN') { res.status(403).json({ error: 'Solo el administrador puede gestionar la inscripción' }); return false; }
  return true;
}

/** GET /inscripcion/club/estado — el enlace, el avance y cuantos esperan. */
router.get('/club/estado', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  if (!clubId) return res.status(400).json({ error: 'Tu cuenta no está vinculada a un club' });

  const [club, pendientes, aprobados] = await Promise.all([
    prisma.club.findUnique({
      where: { id: clubId },
      select: { inscripcionToken: true, inscripcionAbierta: true, inscripcionEsperados: true },
    }),
    prisma.member.count({
      where: {
        clubId,
        OR: [{ inscripcion: 'PENDIENTE' }, { cambiosPendientes: { not: Prisma.DbNull } }],
      },
    }),
    prisma.member.count({ where: { clubId, inscripcion: 'APROBADO', origen: 'FORMULARIO' } }),
  ]);

  // El enlace solo se muestra al administrador, que es quien lo reparte. El
  // entrenador ve el conteo pero no la url.
  const esAdmin = req.user.role === 'ADMIN';
  const token = esAdmin ? await asegurarToken(clubId) : null;

  res.json({
    abierta: club?.inscripcionAbierta ?? false,
    esperados: club?.inscripcionEsperados ?? null,
    url: token ? urlDeInscripcion(token) : null,
    pendientes,
    recibidos: aprobados + pendientes,
  });
});

const configSchema = z.object({
  abierta:   z.boolean().optional(),
  esperados: z.number().int().min(0).max(5000).nullable().optional(),
});

/** PATCH /inscripcion/club/estado — abrir, cerrar, o decir cuantos se esperan. */
router.patch('/club/estado', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  // Abrir por primera vez tiene que dejar un enlace listo para copiar.
  if (parsed.data.abierta) await asegurarToken(clubId);

  const club = await prisma.club.update({
    where: { id: clubId },
    data: {
      ...(parsed.data.abierta !== undefined ? { inscripcionAbierta: parsed.data.abierta } : {}),
      ...(parsed.data.esperados !== undefined ? { inscripcionEsperados: parsed.data.esperados } : {}),
    },
    select: { inscripcionToken: true, inscripcionAbierta: true, inscripcionEsperados: true },
  });

  res.json({
    abierta: club.inscripcionAbierta,
    esperados: club.inscripcionEsperados,
    url: club.inscripcionToken ? urlDeInscripcion(club.inscripcionToken) : null,
  });
});

/** POST /inscripcion/club/rotar — el enlace anterior deja de servir. */
router.post('/club/rotar', requireAuth, strictLimiter, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const token = await rotarToken(clubId);
  res.json({ url: urlDeInscripcion(token) });
});

/**
 * GET /inscripcion/club/pendientes — lo que espera visto bueno.
 *
 * Dos cosas distintas en la misma bandeja: inscripciones nuevas y cambios que
 * mandó alguien que ya estaba en el club. Van juntas porque para el director es
 * el mismo trabajo, revisar y decidir; lo que cambia es qué se le muestra.
 */
router.get('/club/pendientes', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const campos = {
    id: true, fullName: true, email: true, phone: true, birthDate: true,
    docType: true, docNumber: true, category: true, tipo: true, eps: true,
    gender: true, rh: true, allergies: true,
    emergencyContact: true, emergencyPhone: true, guardianRelation: true,
    pictureUrl: true, createdAt: true,
    locations: { select: { location: { select: { id: true, name: true } } } },
  } as const;

  const [nuevas, actualizaciones] = await Promise.all([
    prisma.member.findMany({
      where: { clubId, inscripcion: 'PENDIENTE' },
      orderBy: { createdAt: 'asc' },
      select: campos,
    }),
    prisma.member.findMany({
      where: { clubId, cambiosPendientes: { not: Prisma.DbNull } },
      orderBy: { updatedAt: 'asc' },
      select: { ...campos, cambiosPendientes: true, updatedAt: true },
    }),
  ]);

  res.json({
    pendientes: nuevas.map(p => ({ ...p, modo: 'nuevo' as const })),
    // El club no necesita la ficha entera para decidir: necesita ver qué se
    // mueve. Cada cambio llega con su nombre legible ya resuelto.
    actualizaciones: actualizaciones.map(m => {
      const guardado = (m.cambiosPendientes ?? {}) as { enviadoEn?: string; cambios?: Record<string, { antes: unknown; despues: unknown }> };
      const cambios = guardado.cambios ?? {};
      return {
        id: m.id,
        fullName: m.fullName,
        pictureUrl: m.pictureUrl,
        birthDate: m.birthDate,
        enviadoEn: guardado.enviadoEn ?? m.updatedAt.toISOString(),
        locations: m.locations,
        cambios: Object.entries(cambios).map(([campo, v]) => ({
          campo,
          etiqueta: NOMBRE_CAMPO[campo] ?? campo,
          antes: v.antes,
          despues: v.despues,
        })),
      };
    }),
  });
});

/** POST /inscripcion/club/:id/aplicar — el club acepta los cambios. */
router.post('/club/:id/aplicar', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const id = String(req.params.id);

  const miembro = await prisma.member.findFirst({
    where: { id, clubId, cambiosPendientes: { not: Prisma.DbNull } },
    select: { id: true, fullName: true, cambiosPendientes: true },
  });
  if (!miembro) return res.status(404).json({ error: 'Ese deportista no tiene cambios esperando.' });

  const guardado = (miembro.cambiosPendientes ?? {}) as { cambios?: Record<string, { despues: unknown }> };
  const cambios = guardado.cambios ?? {};

  // Se aplica campo por campo y solo lo que se guardó como cambio: nunca el
  // cuerpo de la petición, que podría traer cualquier cosa.
  const datos: Record<string, unknown> = {};
  for (const [campo, v] of Object.entries(cambios)) {
    datos[campo] = campo === 'birthDate' && typeof v.despues === 'string'
      ? new Date(v.despues)
      : v.despues;
  }

  await prisma.member.update({
    where: { id },
    data: { ...datos, cambiosPendientes: Prisma.DbNull },
  });

  await invalidateMembersCache(clubId);
  emitToClub(clubId, 'members');
  res.json({ ok: true, aplicados: Object.keys(cambios).length });
});

/** DELETE /inscripcion/club/:id/cambios — el club los descarta. */
router.delete('/club/:id/cambios', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const id = String(req.params.id);

  const { count } = await prisma.member.updateMany({
    where: { id, clubId, cambiosPendientes: { not: Prisma.DbNull } },
    data: { cambiosPendientes: Prisma.DbNull },
  });
  if (count === 0) return res.status(404).json({ error: 'Ese deportista no tiene cambios esperando.' });

  emitToClub(clubId, 'members');
  res.json({ ok: true });
});

/** POST /inscripcion/club/:id/aprobar — le da acceso a la plataforma. */
router.post('/club/:id/aprobar', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const id = String(req.params.id);

  const miembro = await prisma.member.findFirst({
    where: { id, clubId, inscripcion: 'PENDIENTE' },
    select: { id: true, fullName: true },
  });
  if (!miembro) return res.status(404).json({ error: 'Esa inscripción ya no está pendiente.' });

  await prisma.member.update({
    where: { id },
    data: { inscripcion: 'APROBADO', aprobadoAt: new Date() },
  });

  await invalidateMembersCache(clubId);
  emitToClub(clubId, 'members');
  res.json({ ok: true });
});

/** POST /inscripcion/club/aprobar-todos — el club acepta la tanda completa. */
router.post('/club/aprobar-todos', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const { count } = await prisma.member.updateMany({
    where: { clubId, inscripcion: 'PENDIENTE' },
    data: { inscripcion: 'APROBADO', aprobadoAt: new Date() },
  });

  await invalidateMembersCache(clubId);
  emitToClub(clubId, 'members');
  res.json({ ok: true, aprobados: count });
});

/**
 * DELETE /inscripcion/club/:id — rechaza la inscripcion.
 *
 * Borra el registro y su cuenta, para que ese correo y ese documento queden
 * libres. Un rechazo que dejara el rastro impediria que la persona correcta se
 * inscribiera despues con los mismos datos.
 */
router.delete('/club/:id', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const id = String(req.params.id);

  const miembro = await prisma.member.findFirst({
    where: { id, clubId, inscripcion: 'PENDIENTE' },
    select: { id: true, fullName: true, clerkId: true },
  });
  if (!miembro) return res.status(404).json({ error: 'Esa inscripción ya no está pendiente.' });

  if (miembro.clerkId) {
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      await clerk.users.deleteUser(miembro.clerkId);
    } catch (err) {
      console.error('[inscripcion] no se pudo borrar la cuenta rechazada', err instanceof Error ? err.message : err);
    }
  }

  await prisma.member.delete({ where: { id } });
  await invalidateMembersCache(clubId);
  emitToClub(clubId, 'members');
  res.json({ ok: true });
});

export default router;
