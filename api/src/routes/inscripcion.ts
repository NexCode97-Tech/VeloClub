import { Router } from 'express';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';
import { prisma, prismaClubEntero } from '../db/client';
import { fijarAlcance } from '../lib/contexto-peticion';
import { carpetaDe } from '../lib/deportes';
import { requireAuth } from '../auth/middleware';
import {
  asegurarToken, rotarToken, urlDeInscripcion, esMenor, yaExiste,
  buscarPorDocumento, soloLoQueCambia, inscripcionVigente, NOMBRE_CAMPO,
} from '../lib/inscripcion';
import { CATEGORIAS, NIVELES } from '../lib/catalogos';
import { strictLimiter, guessLimiter, inscripcionLimiter,
         inscripcionPorEnlaceLimiter } from '../lib/rate-limit';
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

/**
 * Lo que hay que saber de la carpeta para decidir si el enlace responde.
 *
 * El enlace cuelga del deporte y no del club: un club con patinaje y natacion
 * reparte dos, y cada uno mete a la gente en su carpeta sin que despues haya
 * que moverla a mano.
 */
const CARPETA_DEL_ENLACE = {
  id: true, nombre: true, activo: true,
  inscripcionAbierta: true, inscripcionVenceAt: true,
  club: { select: { id: true, name: true, active: true, logoUrl: true } },
} as const;

type CarpetaDelEnlace = {
  id: string; activo: boolean;
  inscripcionAbierta: boolean; inscripcionVenceAt: Date | null;
  club: { active: boolean };
};

/** Traduce la carpeta a los tres interruptores que decide `inscripcionVigente`. */
function estaAbierta(c: CarpetaDelEnlace): boolean {
  return inscripcionVigente({
    clubActivo:         c.club.active,
    activo:             c.activo,
    inscripcionAbierta: c.inscripcionAbierta,
    inscripcionVenceAt: c.inscripcionVenceAt,
  });
}

/**
 * La carpeta de ese token, si esta recibiendo inscripciones.
 *
 * Una que no existe, una cerrada y una vencida responden exactamente lo mismo:
 * asi un enlace viejo no sirve para confirmar que el club existe.
 *
 * Ademas fija el alcance de la peticion: de aca en adelante, todo lo que esta
 * ruta consulte o cree queda dentro de esa carpeta. Es el unico lugar donde la
 * carpeta no sale de quien inicio sesion, porque aca no hay sesion: sale del
 * enlace.
 */
async function carpetaDelEnlace(token: string) {
  const carpeta = await prismaClubEntero.deporte.findUnique({
    where: { inscripcionToken: token },
    select: CARPETA_DEL_ENLACE,
  });
  if (!carpeta || !estaAbierta(carpeta)) return null;
  fijarAlcance({ deporteId: carpeta.id });
  return carpeta;
}

/**
 * El dia calendario de una fecha, en Colombia.
 *
 * Un vencimiento guardado a las 23:59 del 30 de septiembre en hora local es el
 * 1 de octubre en UTC. Cortar por UTC le mostraria al club un dia corrido.
 */
function enBogota(d: Date): string {
  return new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Borra una cuenta que quedo sin dueno. Nunca tumba lo que la llamo. */
async function borrarCuenta(clerkId: string): Promise<void> {
  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    await clerk.users.deleteUser(clerkId);
  } catch (err) {
    console.error('[inscripcion] no se pudo borrar la cuenta', err instanceof Error ? err.message : err);
  }
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

  const carpeta = await carpetaDelEnlace(token);
  if (!carpeta) {
    return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  }

  // Las sedes salen ya acotadas a la carpeta: `carpetaDelEnlace` fijo el
  // alcance de la peticion, asi que el formulario de natacion nunca ofrece una
  // sede de patinaje.
  const sedes = await prisma.location.findMany({
    where: { clubId: carpeta.club.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  res.json({
    club: { nombre: carpeta.club.name, logoUrl: carpeta.club.logoUrl },
    deporte: carpeta.nombre,
    sedes,
    categorias: CATEGORIAS,
    niveles: NIVELES,
  });
});

/**
 * POST /inscripcion/:token/reconocer — ¿de quién es este documento?
 *
 * Es la primera pantalla del formulario, y de su respuesta depende todo lo que
 * sigue. A quien ya está en el club se le devuelve su ficha para que la revise y
 * complete, en vez de hacerle escribir de nuevo lo que el club ya tiene.
 */
router.post('/:token/reconocer', guessLimiter, async (req, res) => {
  const carpeta = await carpetaDelEnlace(String(req.params.token));
  if (!carpeta) return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  const club = carpeta.club;

  const parsed = z.object({ docNumber: z.string().min(3).max(30) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos incompletos.' });

  const quien = await buscarPorDocumento({ clubId: club.id, docNumber: parsed.data.docNumber });

  // El caso ambiguo no se le explica a quien llena: no es su problema que el
  // club tenga dos fichas con el mismo numero. Sigue como inscripcion nueva y
  // el club resuelve el choque cuando le llegue a la bandeja.
  if (quien.estado !== 'reconocido') return res.json({ modo: 'nuevo' });

  res.json({ modo: 'actualiza', tieneCuenta: quien.tieneCuenta, ficha: quien.ficha });
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
 * Crea el deportista ya aprobado y su cuenta de acceso con la contrasena que
 * eligieron. De aca sale entrando: no hay bandeja de por medio.
 */
router.post('/:token', inscripcionLimiter, inscripcionPorEnlaceLimiter, async (req, res) => {
  const carpeta = await carpetaDelEnlace(String(req.params.token));
  if (!carpeta) return res.status(404).json({ error: 'Esta inscripción no está disponible.' });
  const club = carpeta.club;

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
  const quien = await buscarPorDocumento({ clubId: club.id, docNumber: d.docNumber });

  // ── Ya está en el club: se guarda lo que cambia y espera visto bueno ──────
  if (quien.estado === 'reconocido') {
    const actual = await prisma.member.findUnique({
      where: { id: quien.id },
      select: {
        fullName: true, phone: true, docType: true, docNumber: true, birthDate: true,
        emergencyContact: true, emergencyPhone: true, guardianRelation: true,
        guardianDocNumber: true, eps: true, gender: true, rh: true, allergies: true,
        category: true, tipo: true, active: true, email: true, clerkId: true,
        cambiosPendientes: true,
      },
    });
    if (!actual) return res.status(404).json({ error: 'Ese deportista ya no está en el club.' });

    const correo = d.email?.trim().toLowerCase();

    // Quien no tiene cuenta la crea acá mismo. Sin esto llenaría el formulario
    // completo, elegiría una contraseña, y seguiría sin poder entrar a la app.
    if (!quien.tieneCuenta && (!correo || !d.password)) {
      return res.status(400).json({
        campo: !correo ? 'email' : 'password',
        error: !correo ? 'Falta el correo.' : 'Falta la contraseña.',
      });
    }

    if (correo && correo !== (actual.email ?? '').toLowerCase()) {
      const choque = await yaExiste({ clubId: club.id, email: correo, exceptoMemberId: quien.id });
      if (choque.correo) {
        return res.status(409).json({
          campo: 'email',
          error: 'Ese correo ya está registrado en este club. Cada deportista necesita el suyo para entrar a la app.',
        });
      }
    }

    const cambios = soloLoQueCambia(actual as Record<string, unknown>, {
      fullName: tituloDe(d.fullName),
      phone: d.phone,
      docType: d.docType,
      birthDate: d.birthDate,
      email: correo,
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
    });

    // Sin cuenta no hay nada que decidir sobre el acceso, así que un envío sin
    // cambios no deja trabajo pendiente. Con cuenta por crear sí, aunque los
    // datos sean idénticos: falta que el club le abra la puerta.
    if (Object.keys(cambios).length === 0 && quien.tieneCuenta) {
      return res.json({ ok: true, modo: 'sin_cambios', nombre: actual.fullName });
    }

    // La cuenta se crea ya, pero no se pega a la ficha: eso pasa cuando el club
    // aprueba. Entre lo uno y lo otro la cuenta existe y no lleva a ningún lado.
    let cuentaNueva: string | null = null;
    if (!quien.tieneCuenta) {
      try {
        const { createClerkClient } = await import('@clerk/backend');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const [nombre, ...resto] = tituloDe(d.fullName).split(' ');
        const cuenta = await clerk.users.createUser({
          emailAddress: [correo!],
          password: d.password!,
          firstName: nombre,
          lastName: resto.join(' ') || undefined,
          skipPasswordChecks: false,
        });
        cuentaNueva = cuenta.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already|taken|exists/i.test(msg)) {
          return res.status(409).json({ campo: 'email', error: 'Ese correo ya tiene una cuenta. Usa otro para este deportista.' });
        }
        if (/password|pwned|breach|weak|common/i.test(msg)) {
          return res.status(400).json({ campo: 'password', error: 'Esa contraseña es muy fácil de adivinar. Elige otra.' });
        }
        console.error('[inscripcion] no se pudo crear la cuenta del reconocido', msg);
        Sentry.captureException(err, { tags: { route: 'inscripcion/actualizar' }, extra: { clubId: club.id } });
        return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' });
      }
    }

    // Si ya había mandado datos antes, esa tanda se reemplaza. La cuenta que
    // venía con ella se borra: si no, queda un usuario de Clerk sin dueño.
    const previo = (actual.cambiosPendientes ?? {}) as { cuentaClerkId?: string };
    if (previo.cuentaClerkId && previo.cuentaClerkId !== cuentaNueva) {
      await borrarCuenta(previo.cuentaClerkId);
    }

    // Una sola actualización a la vez: la nueva reemplaza a la anterior, para
    // que el club revise lo último que mandaron y no una fila de versiones.
    await prisma.member.update({
      where: { id: quien.id },
      data: {
        cambiosPendientes: {
          enviadoEn: new Date().toISOString(),
          cambios,
          ...(cuentaNueva ? { cuentaClerkId: cuentaNueva } : {}),
        },
      },
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
        // La carpeta sale del enlace por el que entro, no de un menu: es lo que
        // hace que un club con dos deportes no tenga que repartir despues a
        // mano a los que se inscribieron.
        deporteId: carpeta.id,
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
        role: 'DEPORTISTA',
        clerkId,
        inviteStatus: 'ACCEPTED',
        origen: 'FORMULARIO',
        // Entra aprobado, sin pasar por una bandeja.
        //
        // El enlace ES la autorizacion: el club decide a quien se lo manda, y
        // pedirle despues que apruebe uno por uno a los que el mismo invito era
        // pedirle dos veces lo mismo. Mientras tanto la familia quedaba
        // registrada pero sin poder entrar, sin nadie que le explicara por que.
        //
        // Lo que se pierde: cualquiera con el enlace entra directo y cuenta
        // para el precio del plan. Contra eso estan el interruptor de
        // inscripcion, la fecha de vencimiento y «Rotar enlace», que invalida
        // el anterior. Ver `inscripcionVigente` en `lib/inscripcion.ts`.
        inscripcion: 'APROBADO',
        aprobadoAt: new Date(),
        locations: { create: [{ locationId: sede.id }] },
      },
      select: { id: true, fullName: true },
    });

    await registrarEvento({
      accion: 'INSCRIPCION_RECIBIDA',
      entidad: 'Member',
      entidadId: miembro.id,
      resumen: `${miembro.fullName} se inscribió por el enlace de ${club.name}.`,
      clubId: club.id,
      clubNombre: club.name,
      datos: { origen: 'FORMULARIO' },
    });

    await notifyClubStaff(club.id, {
      tipo: 'INSCRIPCION_RECIBIDA',
      titulo: 'Nueva inscripción',
      cuerpo: `${miembro.fullName} se inscribió por el enlace y ya está en tu lista.`,
      link: '/dashboard/miembros',
    }).catch(() => { /* el aviso no puede tumbar la inscripcion */ });

    await invalidateMembersCache(club.id, carpeta.id);
    emitToClub(club.id, 'members');

    res.status(201).json({ ok: true, nombre: miembro.fullName });
  } catch (err) {
    // El miembro no se creo pero la cuenta si: se borra para que el correo
    // quede libre y pueda volver a intentar.
    if (clerkId) await borrarCuenta(clerkId);
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

  // El enlace es de la carpeta en la que esta parado quien pregunta. Un club
  // con patinaje y natacion ve dos enlaces distintos, uno en cada deporte.
  const deporteId = carpetaDe(req);

  const [carpeta, pendientes, aprobados] = await Promise.all([
    prisma.deporte.findUnique({
      where: { id: deporteId },
      select: {
        inscripcionToken: true, inscripcionAbierta: true,
        inscripcionEsperados: true, inscripcionVenceAt: true,
      },
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
  const token = esAdmin ? await asegurarToken(deporteId) : null;

  const vence = carpeta?.inscripcionVenceAt ?? null;

  res.json({
    abierta: carpeta?.inscripcionAbierta ?? false,
    esperados: carpeta?.inscripcionEsperados ?? null,
    // La fecha se manda como aaaa-mm-dd, que es lo que lee un input date. Se
    // corta en hora de Colombia y no en UTC: guardada al filo de la noche, en
    // UTC ya es el día siguiente y el club vería una fecha corrida.
    vence: vence ? enBogota(vence) : null,
    vencido: !!(vence && vence < new Date()),
    url: token ? urlDeInscripcion(token) : null,
    pendientes,
    recibidos: aprobados + pendientes,
  });
});

const configSchema = z.object({
  abierta:   z.boolean().optional(),
  esperados: z.number().int().min(0).max(5000).nullable().optional(),
  /** aaaa-mm-dd, o null para quitar el vencimiento. */
  vence:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** PATCH /inscripcion/club/estado — abrir, cerrar, o decir cuantos se esperan. */
router.patch('/club/estado', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const deporteId = carpetaDe(req);

  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  // Abrir por primera vez tiene que dejar un enlace listo para copiar.
  if (parsed.data.abierta) await asegurarToken(deporteId);

  // El dia elegido cuenta completo: vence al final de ese dia en Colombia, no
  // al empezarlo. Quien lo llene esa misma tarde alcanza.
  const vence = parsed.data.vence === undefined
    ? undefined
    : parsed.data.vence === null
      ? null
      : new Date(`${parsed.data.vence}T23:59:59-05:00`);

  if (vence !== undefined && vence !== null && Number.isNaN(vence.getTime())) {
    return res.status(400).json({ error: 'Esa fecha no es válida.' });
  }

  const carpeta = await prisma.deporte.update({
    where: { id: deporteId },
    data: {
      ...(parsed.data.abierta !== undefined ? { inscripcionAbierta: parsed.data.abierta } : {}),
      ...(parsed.data.esperados !== undefined ? { inscripcionEsperados: parsed.data.esperados } : {}),
      ...(vence !== undefined ? { inscripcionVenceAt: vence } : {}),
    },
    select: {
      inscripcionToken: true, inscripcionAbierta: true,
      inscripcionEsperados: true, inscripcionVenceAt: true,
    },
  });

  res.json({
    abierta: carpeta.inscripcionAbierta,
    esperados: carpeta.inscripcionEsperados,
    vence: carpeta.inscripcionVenceAt ? enBogota(carpeta.inscripcionVenceAt) : null,
    url: carpeta.inscripcionToken ? urlDeInscripcion(carpeta.inscripcionToken) : null,
  });
});

/** POST /inscripcion/club/rotar — el enlace anterior deja de servir. */
router.post('/club/rotar', requireAuth, strictLimiter, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const token = await rotarToken(carpetaDe(req));
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

  // ¿Alguna de las nuevas trae un documento que ya está en otra ficha? Pasa
  // cuando el club cargó dos veces a la misma persona, o cuando puso un número
  // de relleno en varias. No se puede resolver solo: se marca para que el club
  // mire si es la misma persona antes de dejar dos fichas iguales.
  const docs = nuevas.map(n => n.docNumber).filter((x): x is string => !!x);
  const repetidos = new Set<string>();
  if (docs.length > 0) {
    const grupos = await prisma.member.groupBy({
      by: ['docNumber'],
      where: { clubId, docNumber: { in: docs } },
      _count: { _all: true },
    });
    for (const g of grupos) {
      if (g._count._all > 1 && g.docNumber) repetidos.add(g.docNumber);
    }
  }

  res.json({
    pendientes: nuevas.map(p => ({
      ...p,
      modo: 'nuevo' as const,
      duplicado: !!(p.docNumber && repetidos.has(p.docNumber)),
    })),
    // El club no necesita la ficha entera para decidir: necesita ver qué se
    // mueve. Cada cambio llega con su nombre legible ya resuelto.
    actualizaciones: actualizaciones.map(m => {
      const guardado = (m.cambiosPendientes ?? {}) as {
        enviadoEn?: string;
        cambios?: Record<string, { antes: unknown; despues: unknown }>;
        cuentaClerkId?: string;
      };
      const cambios = guardado.cambios ?? {};
      return {
        id: m.id,
        fullName: m.fullName,
        pictureUrl: m.pictureUrl,
        birthDate: m.birthDate,
        docType: m.docType,
        docNumber: m.docNumber,
        enviadoEn: guardado.enviadoEn ?? m.updatedAt.toISOString(),
        // Cuando trae cuenta por estrenar, aprobar no es solo corregir datos:
        // es el momento en que la persona puede entrar a la app.
        estrenaCuenta: !!guardado.cuentaClerkId,
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
    select: { id: true, fullName: true, clerkId: true, email: true, cambiosPendientes: true },
  });
  if (!miembro) return res.status(404).json({ error: 'Ese deportista no tiene cambios esperando.' });

  const guardado = (miembro.cambiosPendientes ?? {}) as {
    cambios?: Record<string, { despues: unknown }>;
    cuentaClerkId?: string;
  };
  const cambios = guardado.cambios ?? {};

  // Se aplica campo por campo y solo lo que se guardó como cambio: nunca el
  // cuerpo de la petición, que podría traer cualquier cosa.
  const datos: Record<string, unknown> = {};
  for (const [campo, v] of Object.entries(cambios)) {
    datos[campo] = campo === 'birthDate' && typeof v.despues === 'string'
      ? new Date(v.despues)
      : v.despues;
  }

  // Acá se entrega el acceso. La cuenta existía desde que mandó el formulario,
  // pero hasta este momento no llevaba a ninguna ficha.
  if (guardado.cuentaClerkId && !miembro.clerkId) {
    datos.clerkId = guardado.cuentaClerkId;
    datos.inviteStatus = 'ACCEPTED';
  }

  // Quien ya tenía cuenta y cambió su correo: hay que moverlo también en Clerk,
  // porque ahí es donde inicia sesión. Con un correo en la app y otro en la
  // ficha, la próxima vez que entre no se reconocería como el mismo.
  const correoNuevo = typeof cambios.email?.despues === 'string' ? cambios.email.despues : null;
  if (correoNuevo && miembro.clerkId) {
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const creado = await clerk.emailAddresses.createEmailAddress({
        userId: miembro.clerkId,
        emailAddress: correoNuevo,
        verified: true,
        primary: true,
      });
      // El anterior se retira para que no quede como segunda forma de entrar.
      const cuenta = await clerk.users.getUser(miembro.clerkId);
      for (const dir of cuenta.emailAddresses) {
        if (dir.id !== creado.id) await clerk.emailAddresses.deleteEmailAddress(dir.id);
      }
    } catch (err) {
      console.error('[inscripcion] no se pudo mover el correo en Clerk', err instanceof Error ? err.message : err);
      Sentry.captureException(err, { tags: { route: 'inscripcion/aplicar' }, extra: { memberId: id } });
      return res.status(502).json({
        error: 'Se cambió el correo pero no se pudo actualizar su acceso. Intenta de nuevo en un momento.',
      });
    }
  }

  await prisma.member.update({
    where: { id },
    data: { ...datos, cambiosPendientes: Prisma.DbNull },
  });

  await invalidateMembersCache(clubId, carpetaDe(req));
  emitToClub(clubId, 'members');
  res.json({ ok: true, aplicados: Object.keys(cambios).length });
});

/** DELETE /inscripcion/club/:id/cambios — el club los descarta. */
router.delete('/club/:id/cambios', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const id = String(req.params.id);

  const miembro = await prisma.member.findFirst({
    where: { id, clubId, cambiosPendientes: { not: Prisma.DbNull } },
    select: { cambiosPendientes: true },
  });
  if (!miembro) return res.status(404).json({ error: 'Ese deportista no tiene cambios esperando.' });

  await prisma.member.update({ where: { id }, data: { cambiosPendientes: Prisma.DbNull } });

  // La cuenta que venía con esos datos se va con ellos: nunca se enlazó a la
  // ficha, y dejarla viva mantendría ese correo ocupado en Clerk.
  const guardado = (miembro.cambiosPendientes ?? {}) as { cuentaClerkId?: string };
  if (guardado.cuentaClerkId) await borrarCuenta(guardado.cuentaClerkId);

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

  await invalidateMembersCache(clubId, carpetaDe(req));
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

  await invalidateMembersCache(clubId, carpetaDe(req));
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

  if (miembro.clerkId) await borrarCuenta(miembro.clerkId);

  await prisma.member.delete({ where: { id } });
  await invalidateMembersCache(clubId, carpetaDe(req));
  emitToClub(clubId, 'members');
  res.json({ ok: true });
});

export default router;
