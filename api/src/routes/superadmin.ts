import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { addToAllowlist, removeFromAllowlist } from '../lib/clerk-allowlist';
import { invalidarTrustedCache, diasDePrueba } from './clubs';
import { cacheDel } from '../lib/redis';
import {
  mesesDe, gastosPorCategoria, clubesQuePagan, ingresoMensual, pulsoDelNegocio,
} from '../lib/finanzas-plataforma';
import { v2 as cloudinary } from 'cloudinary';
import { validarSubida } from '../lib/upload-guard';
import { emitToClub } from '../lib/sse';
import { notifyClubStaff } from '../lib/notify';
import { activarClubTrasPago } from '../lib/sync-suscripciones';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();

function requireSuperadmin(req: any, res: any, next: any) {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').map((e: string) => e.trim()).filter(Boolean);
  if (!req.auth || !superadminEmails.includes(req.auth.email)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

// ─── Helper: crear notificación ───────────────────────────────────────────────
async function crearNotificacion(tipo: any, titulo: string, cuerpo: string) {
  await prisma.notificacion.create({ data: { tipo, titulo, cuerpo } });
}

// ─── Clubs ────────────────────────────────────────────────────────────────────

const createClubSchema = z.object({
  clubName:   z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminName:  z.string().min(2).max(100),
  adminPhone: z.string().max(30).optional(),
  deporte:    z.string().optional(),
});

router.get('/clubs', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    include: {
      _count: { select: { members: true } },
      users: { where: { role: 'ADMIN' }, select: { email: true, name: true } },
      suscripcion: { select: { tipoPlan: true, planMonto: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ clubs });
});

router.post('/clubs', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { clubName, adminEmail, adminName, adminPhone, deporte } = parsed.data;

  const existing = await prisma.member.findFirst({ where: { email: adminEmail } });
  if (existing) return res.status(400).json({ error: 'Este email ya está registrado en otro club' });

  // Si ese correo ya tiene una cuenta de login (User) de un club anterior, la
  // reutilizamos y la re-vinculamos ya mismo — si no, queda un User "fantasma"
  // apuntando al club viejo y el GET /me resuelve el club equivocado.
  const existingUser = await prisma.user.findFirst({ where: { email: { equals: adminEmail, mode: 'insensitive' } } });

  // Mismo periodo que el auto-registro, incluida la promocion vigente: un club
  // que creamos nosotros a mano no puede recibir menos dias que uno que se
  // registra solo desde la landing
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + diasDePrueba());

  const club = await prisma.club.create({
    data: {
      name: clubName,
      trialEndsAt,
      deporte: deporte || undefined,
      members: {
        create: {
          fullName: adminName, email: adminEmail, phone: adminPhone || undefined, role: 'ADMIN',
          ...(existingUser
            ? { clerkId: existingUser.clerkId, inviteStatus: 'ACCEPTED' }
            : { inviteStatus: 'PENDING' }),
        },
      },
    },
    include: { _count: { select: { members: true } } },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { clubId: club.id, role: 'ADMIN' },
    });
  }

  await addToAllowlist(adminEmail);
  await crearNotificacion('CLUB_CREADO', 'Nuevo club registrado', `${clubName} fue creado con admin ${adminName}.`);

  res.status(201).json({ club });
});

router.patch('/clubs/:id/toggle', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const reactivating = !club.active; // false → true
  const updated = await prisma.club.update({
    where: { id },
    data: {
      active: !club.active,
      // Cualquier toggle manual es explícito — nunca dejar la bandera de
      // "desactivado automáticamente por vencimiento" contaminando esta decisión
      desactivadoPorVencimiento: false,
      // Al reactivar, limpia el trial y marca la activación como manual para
      // que el chequeo de vencimiento no lo vuelva a desactivar en el próximo
      // login; al desactivar, se limpia la marca.
      ...(reactivating
        ? { trialEndsAt: null, activadoManualmente: true }
        : { activadoManualmente: false }),
    },
  });

  if (!updated.active) {
    await crearNotificacion('CLUB_DESACTIVADO', 'Club desactivado', `${club.name} fue desactivado.`);
  }


  await invalidarTrustedCache(); // activar/desactivar cambia quién aparece en el landing
  res.json({ club: updated });
});

// Invalida las cachés que dependen del logo/datos de un club, para que el
// cambio se refleje en todas partes sin recargar (landing, ajustes, perfil).
async function invalidarCachesClub(clubId: string): Promise<void> {
  await cacheDel(`club:settings:${clubId}`);
  await cacheDel(`club:profile:${clubId}`);
  await invalidarTrustedCache();
}

// POST /superadmin/clubs/:id/logo — el superadmin cambia el logo de cualquier club
router.post('/clubs/:id/logo', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const { base64 } = req.body as { base64?: string };
  const vLogo = validarSubida(base64, 'image');
  if (!vLogo.ok) return res.status(400).json({ error: vLogo.error });

  const club = await prisma.club.findUnique({ where: { id }, select: { logoPublicId: true } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  try {
    if (club.logoPublicId) {
      await cloudinary.uploader.destroy(club.logoPublicId).catch(() => {});
    }
    const result = await cloudinary.uploader.upload(vLogo.data, {
      folder:     'veloclub/logos',
      public_id:  `club_${id}`,
      overwrite:  true,
      transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'center', quality: 'auto:good' }],
    });
    const updated = await prisma.club.update({
      where: { id },
      data:  { logoUrl: result.secure_url, logoPublicId: result.public_id },
      select: { id: true, logoUrl: true },
    });
    await invalidarCachesClub(id);
    res.json({ club: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[superadmin logo upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /superadmin/clubs/:id/logo — el superadmin quita el logo de un club
router.delete('/clubs/:id/logo', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.findUnique({ where: { id }, select: { logoPublicId: true } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  if (club.logoPublicId) {
    await cloudinary.uploader.destroy(club.logoPublicId).catch(() => {});
  }
  await prisma.club.update({ where: { id }, data: { logoUrl: null, logoPublicId: null } });
  await invalidarCachesClub(id);
  res.json({ ok: true });
});

// PATCH /superadmin/clubs/:id/verificar — otorgar el sello (cola de verificación)
router.patch('/clubs/:id/verificar', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.update({
    where: { id },
    data: { verificationStatus: 'VERIFIED', verified: true, nameFlagged: false, rejectionReason: null, reviewedAt: new Date() },
  });
  await invalidarTrustedCache(); // verificado → ya puede aparecer en el landing
  res.json({ club });
});

// PATCH /superadmin/clubs/:id/rechazar — rechazar el club (queda no público)
router.patch('/clubs/:id/rechazar', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const { reason } = req.body as { reason?: string };
  const club = await prisma.club.update({
    where: { id },
    data: { verificationStatus: 'REJECTED', verified: false, rejectionReason: reason?.trim() || null, reviewedAt: new Date() },
  });
  await invalidarTrustedCache(); // rechazado → deja de aparecer en el landing
  res.json({ club });
});

// ─── Leads (solicitudes "Contáctenos") ────────────────────────────────────────

router.get('/leads', requireAuth, requireSuperadmin, async (_req, res) => {
  const leads = await prisma.clubLead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ leads });
});

router.patch('/leads/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const { status } = req.body as { status?: string };
  if (!['NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED'].includes(status ?? '')) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const lead = await prisma.clubLead.update({ where: { id }, data: { status: status as any } });
  res.json({ lead });
});

// PATCH /superadmin/clubs/:id — editar info del club
const editClubSchema = z.object({
  name:       z.string().min(2).max(100).optional(),
  deporte:    z.string().optional().nullable(),
  adminName:  z.string().min(2).max(100).optional(),
  adminEmail: z.string().email().optional(),
  adminPhone: z.string().max(30).optional().nullable(),
  // trialDays: número de días desde hoy. 0 = limpiar trial. null = sin cambios.
  trialDays:  z.number().int().min(0).max(365).optional().nullable(),
});

router.patch('/clubs/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const parsed = editClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { name, deporte, adminName, adminEmail, adminPhone, trialDays } = parsed.data;

  // Actualizar el club
  const clubData: Record<string, unknown> = {};
  if (name)           clubData.name    = name.trim();
  if (deporte !== undefined) clubData.deporte = deporte || null;
  if (trialDays !== undefined && trialDays !== null) {
    if (trialDays === 0) {
      clubData.trialEndsAt = null; // limpiar trial
    } else {
      // Calcular desde createdAt del club para respetar días ya transcurridos
      const currentClub = await prisma.club.findUnique({ where: { id }, select: { createdAt: true } });
      const base = currentClub?.createdAt ?? new Date();
      const t = new Date(base);
      t.setDate(t.getDate() + trialDays);
      clubData.trialEndsAt = t;
    }
  }

  const club = await prisma.club.update({ where: { id }, data: clubData });

  // Actualizar al admin del club si se enviaron datos
  if (adminName || adminEmail || adminPhone !== undefined) {
    const adminMember = await prisma.member.findFirst({
      where: { clubId: id, role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (adminMember) {
      const memberData: Record<string, unknown> = {};
      if (adminName)  memberData.fullName = adminName.trim();
      if (adminPhone !== undefined) memberData.phone = adminPhone || null;
      if (adminEmail && adminEmail !== adminMember.email) {
        // Quitar email viejo del allowlist y agregar el nuevo
        if (adminMember.email) {
          try { await removeFromAllowlist(adminMember.email); } catch { /* ignorar */ }
        }
        await addToAllowlist(adminEmail);
        memberData.email = adminEmail;
      }
      if (Object.keys(memberData).length > 0) {
        await prisma.member.update({ where: { id: adminMember.id }, data: memberData });
      }
    }
  }

  res.json({ club });
});

router.delete('/clubs/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);

  // Copia completa ANTES de borrar. Es el corazon del registro: sin esto la
  // bitacora contaria que un club desaparecio pero no permitiria rehacerlo,
  // que es exactamente lo que hizo falta cuando se perdieron cinco.
  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      users:     { select: { email: true, name: true, role: true, clerkId: true } },
      locations: { select: { name: true, address: true } },
      _count:    { select: { members: true, payments: true, cashEntries: true, attendances: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  // Los deportistas van aparte y con lo minimo para reconstruirlos: meter los
  // documentos y archivos adjuntos aca seria copiar datos sensibles a una tabla
  // que nadie mira a diario.
  const miembros = await prisma.member.findMany({
    where: { clubId: id },
    select: { fullName: true, email: true, phone: true, role: true, category: true, monthlyFee: true },
  });

  await Promise.all(
    miembros.filter(m => m.email).map(m => removeFromAllowlist(m.email!))
  );

  await prisma.club.delete({ where: { id } });


  res.json({ ok: true });
});

// GET /superadmin/clubs/:id/miembros — miembros no-STUDENT de un club
router.get('/clubs/:id/miembros', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const members = await prisma.member.findMany({
    where: { clubId: id, role: { in: ['ADMIN', 'COACH'] } },
    select: { id: true, fullName: true, email: true, phone: true, role: true, inviteStatus: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ members });
});

// POST /superadmin/clubs/:id/miembros — agregar ADMIN o COACH a un club
const addMemberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email:    z.string().email(),
  role:     z.enum(['ADMIN', 'COACH']),
});

router.post('/clubs/:id/miembros', requireAuth, requireSuperadmin, async (req, res) => {
  const clubId = String(req.params.id);
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { fullName, email, role } = parsed.data;

  const existing = await prisma.member.findFirst({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Este email ya está registrado' });

  const member = await prisma.member.create({
    data: { clubId, fullName, email, role, inviteStatus: 'PENDING' },
  });

  await addToAllowlist(email);

  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
  const roleLabel = role === 'ADMIN' ? 'administrador' : 'entrenador';
  await crearNotificacion('CLUB_CREADO', 'Nuevo miembro agregado', `${fullName} fue agregado como ${roleLabel} en ${club?.name}.`);

  res.status(201).json({ member });
});

// PATCH /superadmin/clubs/:clubId/miembros/:memberId — cambiar rol
router.patch('/clubs/:clubId/miembros/:memberId', requireAuth, requireSuperadmin, async (req, res) => {
  const memberId = String(req.params.memberId);
  const { role } = req.body;
  if (!['ADMIN', 'COACH'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });

  const antes = await prisma.member.findUnique({
    where: { id: memberId },
    select: { role: true, fullName: true, clubId: true, club: { select: { name: true } } },
  });
  const member = await prisma.member.update({ where: { id: memberId }, data: { role } });


  res.json({ member });
});

// POST /superadmin/clubs/:clubId/miembros/:memberId/allowlist — re-sync email to Clerk allowlist
router.post('/clubs/:clubId/miembros/:memberId/allowlist', requireAuth, requireSuperadmin, async (req, res) => {
  const memberId = String(req.params.memberId);
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { email: true } });
  if (!member?.email) return res.status(404).json({ error: 'Miembro no encontrado' });
  await addToAllowlist(member.email);
  res.json({ ok: true });
});

// DELETE /superadmin/clubs/:clubId/miembros/:memberId
router.delete('/clubs/:clubId/miembros/:memberId', requireAuth, requireSuperadmin, async (req, res) => {
  const memberId = String(req.params.memberId);
  // Copia antes de borrar, con lo justo para reconstruirlo. Los documentos y
  // archivos adjuntos no se copian: son datos sensibles y la bitacora no es
  // lugar para guardarlos.
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      email: true, fullName: true, phone: true, role: true, category: true,
      monthlyFee: true, clubId: true, club: { select: { name: true } },
      _count: { select: { payments: true, attendances: true } },
    },
  });
  if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

  if (member.email) await removeFromAllowlist(member.email);
  await prisma.member.delete({ where: { id: memberId } });


  res.json({ ok: true });
});

// ─── Suscripciones ────────────────────────────────────────────────────────────

router.get('/suscripciones', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    select: {
      id: true, name: true, active: true, createdAt: true, logoUrl: true, trialEndsAt: true,
      verificationStatus: true, nameFlagged: true,
      _count: { select: { members: true } },
      suscripcion: { include: { pagos: { orderBy: { createdAt: 'asc' } } } },
      members: { where: { role: 'ADMIN' }, select: { phone: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  const mapped = clubs.map(({ members, ...rest }) => ({ ...rest, adminPhone: members[0]?.phone ?? null }));
  res.json({ clubs: mapped });
});

const suscripcionSchema = z.object({
  planMonto: z.number().positive(),
  tipoPlan: z.enum(['MENSUAL', 'TRIMESTRAL', 'ANUAL']).default('MENSUAL'),
  año: z.number().int().min(2024),
});

router.post('/suscripciones/:clubId', requireAuth, requireSuperadmin, async (req, res) => {
  const clubId = String(req.params.clubId);
  const parsed = suscripcionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const suscripcion = await prisma.clubSuscripcion.upsert({
    where: { clubId },
    update: { planMonto: parsed.data.planMonto, tipoPlan: parsed.data.tipoPlan as any, año: parsed.data.año },
    create: { clubId, planMonto: parsed.data.planMonto, tipoPlan: parsed.data.tipoPlan as any, año: parsed.data.año },
  });
  res.json({ suscripcion });
});

const pagoSchema = z.object({
  concepto: z.string().min(1),
  monto: z.number().positive(),
  fecha: z.string().optional(),
  estado: z.enum(['PENDING', 'PAID', 'OVERDUE']).default('PAID'),
});

router.post('/suscripciones/:clubId/pagos', requireAuth, requireSuperadmin, async (req, res) => {
  const clubId = String(req.params.clubId);
  const parsed = pagoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  let suscripcion = await prisma.clubSuscripcion.findUnique({ where: { clubId } });
  if (!suscripcion) {
    suscripcion = await prisma.clubSuscripcion.create({
      data: { clubId, planMonto: 450000, año: new Date().getFullYear() },
    });
  }

  const pago = await prisma.suscripcionPago.create({
    data: {
      suscripcionId: suscripcion.id,
      concepto: parsed.data.concepto,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : new Date(),
      estado: parsed.data.estado as any,
    },
  });

  // Notificación si el pago es vencido
  if (parsed.data.estado === 'OVERDUE') {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
    await crearNotificacion(
      'PAGO_VENCIDO',
      'Pago vencido',
      `${club?.name ?? 'Un club'} tiene un pago vencido: ${parsed.data.concepto} por $${parsed.data.monto.toLocaleString('es-CO')}.`
    );
  } else if (parsed.data.estado === 'PAID') {
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
    await crearNotificacion(
      'PAGO_REGISTRADO',
      'Pago registrado',
      `${club?.name ?? 'Un club'} registró un pago: ${parsed.data.concepto} por $${parsed.data.monto.toLocaleString('es-CO')}.`
    );
  }

  res.status(201).json({ pago });
});

const editPagoSchema = z.object({
  estado:   z.enum(['PENDING', 'PAID', 'OVERDUE']).optional(),
  concepto: z.string().min(1).optional(),
  monto:    z.number().positive().optional(),
  fecha:    z.string().optional(),
});

router.patch('/suscripciones/pagos/:pagoId', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const parsed = editPagoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const data: Record<string, unknown> = {};
  if (parsed.data.estado)   data.estado = parsed.data.estado;
  if (parsed.data.concepto) data.concepto = parsed.data.concepto;
  if (parsed.data.monto)    data.monto = parsed.data.monto;
  if (parsed.data.fecha)    data.fecha = new Date(parsed.data.fecha);
  // Si se paga ahora y no se envía fecha, poner hoy
  if (parsed.data.estado === 'PAID' && !parsed.data.fecha) data.fecha = new Date();

  const pago = await prisma.suscripcionPago.update({ where: { id: pagoId }, data });
  res.json({ pago });
});

router.delete('/suscripciones/pagos/:pagoId', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  await prisma.suscripcionPago.delete({ where: { id: pagoId } });
  res.json({ ok: true });
});

// ─── Pagos por Bre-B pendientes de verificación ──────────────────────────────
//
// Una transferencia a una llave Bre-B no le avisa a nadie: no hay webhook que
// pueda acreditarla. Estos pagos nacen PENDING con el comprobante que subió el
// club y solo salen de ahí por decisión de un superadministrador.
//
// La regla de oro es que subir un comprobante no activa nada. Si activara,
// bastaría con subir cualquier imagen para tener el plan gratis.

// GET /superadmin/suscripciones/breb-pendientes
router.get('/suscripciones/breb-pendientes', requireAuth, requireSuperadmin, async (_req, res) => {
  const pagos = await prisma.suscripcionPago.findMany({
    // mpPaymentId nulo es lo que los distingue: un PENDING de PSE o Efecty sí
    // tiene id de Mercado Pago y lo acredita el webhook, no una persona.
    where: { estado: 'PENDING', mpPaymentId: null },
    orderBy: { createdAt: 'asc' },   // primero el que más lleva esperando
    include: { suscripcion: { include: { club: { select: { id: true, name: true, email: true } } } } },
  });

  res.json({
    pagos: pagos.map(p => ({
      id: p.id,
      concepto: p.concepto,
      monto: p.monto,
      creadoEn: p.createdAt,
      comprobanteUrl: p.receiptUrl,
      club: p.suscripcion.club,
      tipoPlan: p.suscripcion.tipoPlan,
    })),
  });
});

// POST /superadmin/suscripciones/pagos/:pagoId/aprobar
router.post('/suscripciones/pagos/:pagoId/aprobar', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);

  const pago = await prisma.suscripcionPago.findUnique({
    where: { id: pagoId },
    include: { suscripcion: { include: { club: { select: { id: true, name: true, trialEndsAt: true } } } } },
  });
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  if (pago.estado === 'PAID') return res.status(409).json({ error: 'Ese pago ya estaba aprobado' });

  const club = pago.suscripcion.club;

  // Igual que en los otros medios: si el club todavía está en su prueba, el
  // período pagado arranca cuando la prueba termina, para no comerse días
  // gratis que ya se habían prometido.
  const ahora = new Date();
  const fecha = club.trialEndsAt && club.trialEndsAt > ahora ? club.trialEndsAt : ahora;

  const actualizado = await prisma.suscripcionPago.update({
    where: { id: pagoId },
    data: { estado: 'PAID', fecha },
  });

  await activarClubTrasPago(club.id);

  await notifyClubStaff(club.id, {
    tipo: 'suscripcion',
    titulo: 'Pago verificado',
    cuerpo: `Confirmamos tu transferencia por $${pago.monto.toLocaleString('es-CO')}. Tu plan quedó activo.`,
    link: '/dashboard/ajustes?tab=suscripcion',
  });

  res.json({ pago: actualizado });
});

// POST /superadmin/suscripciones/pagos/:pagoId/rechazar
router.post('/suscripciones/pagos/:pagoId/rechazar', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const { motivo } = req.body as { motivo?: string };

  const pago = await prisma.suscripcionPago.findUnique({
    where: { id: pagoId },
    include: { suscripcion: { select: { clubId: true } } },
  });
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  if (pago.estado === 'PAID') return res.status(409).json({ error: 'Ese pago ya fue aprobado' });

  // Se borra en vez de marcarse rechazado: así el club puede volver a intentar
  // (el bloqueo es "un pendiente a la vez") y no le queda un registro de deuda
  // que no debe. Qué se borró y quién lo borró queda en la bitácora.
  if (pago.receiptPublicId) {
    try { await cloudinary.uploader.destroy(pago.receiptPublicId, { resource_type: 'image' }); } catch { /* ignorar */ }
  }
  await prisma.suscripcionPago.delete({ where: { id: pagoId } });

  await notifyClubStaff(pago.suscripcion.clubId, {
    tipo: 'suscripcion',
    titulo: 'No pudimos verificar tu pago',
    cuerpo: motivo?.trim()
      ? `${motivo.trim()} Puedes intentar de nuevo desde Ajustes.`
      : 'No encontramos la transferencia. Revisa el comprobante e intenta de nuevo desde Ajustes.',
    link: '/dashboard/ajustes?tab=suscripcion',
  });

  res.json({ ok: true });
});

// ─── Pagos rechazados ────────────────────────────────────────────────────────
//
// Un rechazo no crea ninguna fila de pago, así que antes no quedaba en ningún
// lado: cuando un club decía "no me deja pagar" había que ir a consultarle a
// Mercado Pago con credenciales de producción. Ahora se registra en la bitácora
// y esto lo devuelve para verlo desde el panel.

// GET /superadmin/pagos-rechazados
router.get('/pagos-rechazados', requireAuth, requireSuperadmin, async (req, res) => {
  const dias = Math.min(90, Math.max(1, Number(req.query.dias ?? 7)));
  const desde = new Date(Date.now() - dias * 86_400_000);

  const registros = await prisma.auditoria.findMany({
    where: { accion: 'PAGO_RECHAZADO', createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    dias,
    rechazos: registros.map(r => {
      const d = (r.datos ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        cuando: r.createdAt,
        club: r.clubNombre,
        clubId: r.clubId,
        medio: String(d.medio ?? '—'),
        motivo: String(d.motivo ?? '—'),
        monto: Number(d.monto ?? 0),
        bancoId: d.bancoId ? String(d.bancoId) : null,
      };
    }),
  });
});

// ─── Comprobantes de SuscripcionPago ─────────────────────────────────────────

// POST /superadmin/suscripciones/pagos/:pagoId/receipt
router.post('/suscripciones/pagos/:pagoId/receipt', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const { base64, fileName } = req.body as { base64: string; fileName?: string };
  const vComprobante = validarSubida(base64, 'doc');
  if (!vComprobante.ok) return res.status(400).json({ error: vComprobante.error });

  const pago = await prisma.suscripcionPago.findUnique({ where: { id: pagoId } });
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

  // Destruir comprobante anterior si existe
  if (pago.receiptPublicId) {
    try { await cloudinary.uploader.destroy(pago.receiptPublicId, { resource_type: 'image' }); } catch { /* ignorar */ }
  }

  const uploaded = await cloudinary.uploader.upload(base64, {
    folder: 'veloclub/comprobantes-suscripcion',
    public_id: `pago_${pagoId}_${Date.now()}`,
    resource_type: 'image',
  });

  const updated = await prisma.suscripcionPago.update({
    where: { id: pagoId },
    data: { receiptUrl: uploaded.secure_url, receiptPublicId: uploaded.public_id },
  });

  res.json({ pago: updated });
});

// DELETE /superadmin/suscripciones/pagos/:pagoId/receipt
router.delete('/suscripciones/pagos/:pagoId/receipt', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const pago = await prisma.suscripcionPago.findUnique({ where: { id: pagoId } });
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

  if (pago.receiptPublicId) {
    try { await cloudinary.uploader.destroy(pago.receiptPublicId, { resource_type: 'image' }); } catch { /* ignorar */ }
  }

  const updated = await prisma.suscripcionPago.update({
    where: { id: pagoId },
    data: { receiptUrl: null, receiptPublicId: null },
  });

  res.json({ pago: updated });
});

// ─── Notificaciones ───────────────────────────────────────────────────────────

router.get('/notificaciones', requireAuth, requireSuperadmin, async (_req, res) => {
  const notifs = await prisma.notificacion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ notificaciones: notifs });
});

router.patch('/notificaciones/:id/leer', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const n = await prisma.notificacion.update({ where: { id }, data: { leida: true } });
  res.json({ notificacion: n });
});

router.patch('/notificaciones/leer-todas', requireAuth, requireSuperadmin, async (_req, res) => {
  await prisma.notificacion.updateMany({ where: { leida: false }, data: { leida: true } });
  res.json({ ok: true });
});

// POST /superadmin/fix-member-names — normalizar todos los nombres a Title Case
// GET /superadmin/suscripciones-fantasma — diagnostico, no toca nada
//
// Una suscripcion fantasma es una fila que se creo sola, sin que el club haya
// pagado nunca: la pantalla de suscripcion hacia un upsert al consultarla, asi
// que heredaba los valores por defecto del esquema (450.000 mensual, un precio
// que ya no existe). En el superadmin esos clubes se veian como plan pago.
router.get('/suscripciones-fantasma', requireAuth, requireSuperadmin, async (_req, res) => {
  const suscripciones = await prisma.clubSuscripcion.findMany({
    include: {
      club:  { select: { id: true, name: true, trialEndsAt: true, active: true } },
      pagos: { select: { id: true, estado: true } },
    },
  });

  const fantasma = suscripciones
    .filter(s => !s.pagos.some(p => p.estado === 'PAID'))
    .map(s => ({
      clubId:      s.club.id,
      club:        s.club.name,
      planMonto:   s.planMonto,
      tipoPlan:    s.tipoPlan,
      trialEndsAt: s.club.trialEndsAt,
      enPrueba:    !!s.club.trialEndsAt && s.club.trialEndsAt > new Date(),
      pagos:       s.pagos.length,
    }));

  res.json({ total: suscripciones.length, fantasma });
});

// POST /superadmin/suscripciones-fantasma/limpiar — borra esas filas
//
// Se borran en vez de corregirles el monto porque no representan nada: el club
// no ha elegido plan ni ha pagado. Si despues elige o paga, el flujo la vuelve
// a crear con el precio calculado. Solo toca suscripciones sin ningun pago
// registrado, asi que no puede afectar a un club que si pago.
router.post('/suscripciones-fantasma/limpiar', requireAuth, requireSuperadmin, async (_req, res) => {
  const suscripciones = await prisma.clubSuscripcion.findMany({
    include: { pagos: { select: { id: true } } },
  });

  const sinPagos = suscripciones.filter(s => s.pagos.length === 0);
  if (sinPagos.length > 0) {
    await prisma.clubSuscripcion.deleteMany({ where: { id: { in: sinPagos.map(s => s.id) } } });
  }

  res.json({ ok: true, revisadas: suscripciones.length, eliminadas: sinPagos.length });
});

router.post('/fix-member-names', requireAuth, requireSuperadmin, async (_req, res) => {
  function toTitleCase(str: string): string {
    return str.toLowerCase().split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ').trim();
  }
  const members = await prisma.member.findMany({ select: { id: true, fullName: true } });
  let updated = 0;
  for (const m of members) {
    const normalized = toTitleCase(m.fullName);
    if (normalized !== m.fullName) {
      await prisma.member.update({ where: { id: m.id }, data: { fullName: normalized } });
      updated++;
    }
  }
  res.json({ ok: true, total: members.length, updated });
});

// POST /superadmin/backfill-author-clerk-ids — rellena authorClerkId en posts/comentarios viejos
router.post('/backfill-author-clerk-ids', requireAuth, requireSuperadmin, async (_req, res) => {
  const members = await prisma.member.findMany({
    where: { clerkId: { not: null } },
    select: { clerkId: true, fullName: true },
  });

  let updatedPosts    = 0;
  let updatedComments = 0;

  for (const m of members) {
    if (!m.clerkId) continue;

    const rPosts = await prisma.post.updateMany({
      where: { authorName: m.fullName, authorClerkId: null },
      data:  { authorClerkId: m.clerkId },
    });
    updatedPosts += rPosts.count;

    const rComments = await prisma.postComment.updateMany({
      where: { authorName: m.fullName, authorClerkId: null },
      data:  { authorClerkId: m.clerkId },
    });
    updatedComments += rComments.count;
  }

  res.json({ ok: true, updatedPosts, updatedComments });
});

// ─── Cupones de descuento ─────────────────────────────────────────────────────

const cuponSchema = z.object({
  codigo:     z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/, 'Solo letras, números, punto, guion y guion bajo'),
  porcentaje: z.number().int().min(1).max(100),
  activo:     z.boolean().optional(),
  expiraEn:   z.string().datetime().nullable().optional(),
  maxUsos:    z.number().int().min(1).nullable().optional(),
});

const cuponUpdateSchema = cuponSchema.partial();

// Listar cupones con su conteo de canjes
router.get('/cupones', requireAuth, requireSuperadmin, async (_req, res) => {
  const cupones = await prisma.cupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { canjes: true } } },
  });
  res.json({ cupones });
});

// Crear cupón
router.post('/cupones', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = cuponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
  const { codigo, porcentaje, activo, expiraEn, maxUsos } = parsed.data;

  const codigoNorm = codigo.trim().toUpperCase();
  const existente = await prisma.cupon.findUnique({ where: { codigo: codigoNorm } });
  if (existente) return res.status(409).json({ error: 'Ya existe un cupón con ese código' });

  const cupon = await prisma.cupon.create({
    data: {
      codigo: codigoNorm,
      porcentaje,
      activo: activo ?? true,
      expiraEn: expiraEn ? new Date(expiraEn) : null,
      maxUsos: maxUsos ?? null,
    },
    include: { _count: { select: { canjes: true } } },
  });
  res.status(201).json({ cupon });
});

// Editar / activar / desactivar cupón
router.patch('/cupones/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = cuponUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
  const { codigo, porcentaje, activo, expiraEn, maxUsos } = parsed.data;

  const actual = await prisma.cupon.findUnique({ where: { id: String(req.params.id) } });
  if (!actual) return res.status(404).json({ error: 'Cupón no encontrado' });

  let codigoNorm: string | undefined;
  if (codigo !== undefined) {
    codigoNorm = codigo.trim().toUpperCase();
    const otro = await prisma.cupon.findUnique({ where: { codigo: codigoNorm } });
    if (otro && otro.id !== actual.id) return res.status(409).json({ error: 'Ya existe un cupón con ese código' });
  }

  const cupon = await prisma.cupon.update({
    where: { id: actual.id },
    data: {
      ...(codigoNorm !== undefined ? { codigo: codigoNorm } : {}),
      ...(porcentaje !== undefined ? { porcentaje } : {}),
      ...(activo !== undefined ? { activo } : {}),
      ...(expiraEn !== undefined ? { expiraEn: expiraEn ? new Date(expiraEn) : null } : {}),
      ...(maxUsos !== undefined ? { maxUsos: maxUsos ?? null } : {}),
    },
    include: { _count: { select: { canjes: true } } },
  });
  res.json({ cupon });
});

// Eliminar cupón (borra también sus canjes por cascade)
router.delete('/cupones/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const actual = await prisma.cupon.findUnique({ where: { id: String(req.params.id) } });
  if (!actual) return res.status(404).json({ error: 'Cupón no encontrado' });
  await prisma.cupon.delete({ where: { id: actual.id } });
  res.json({ ok: true });
});

// ─── Moderación de contenido ──────────────────────────────────────────────────
//
// La otra mitad de lo que prometen los Terminos: poder retirar contenido "de
// oficio". Vive en el superadmin y no en el club porque el feed publico cruza
// clubes, y darle a un club poder sobre lo que publica otro seria peor que no
// tener moderacion.

// GET /superadmin/reportes?estado=PENDIENTE
router.get('/reportes', requireAuth, requireSuperadmin, async (req, res) => {
  const estado = String(req.query.estado ?? 'PENDIENTE').toUpperCase();
  const filtro = ['PENDIENTE', 'ELIMINADO', 'DESESTIMADO'].includes(estado)
    ? { estado: estado as 'PENDIENTE' | 'ELIMINADO' | 'DESESTIMADO' }
    : {};

  const reportes = await prisma.reporte.findMany({
    where: filtro,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // El contenido puede haber desaparecido —el autor lo borro— o haber cambiado
  // desde que se reporto. Se marca para que el superadmin no juzgue a ciegas.
  const postIds    = [...new Set(reportes.map(r => r.postId))];
  const commentIds = reportes.map(r => r.commentId).filter((v): v is string => !!v);

  const [posts, comments, clubes] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, content: true, imageUrl: true, scope: true },
    }),
    commentIds.length
      ? prisma.postComment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, content: true },
        })
      : Promise.resolve([]),
    prisma.club.findMany({
      where: { id: { in: [...new Set(reportes.map(r => r.clubId).filter((v): v is string => !!v))] } },
      select: { id: true, name: true },
    }),
  ]);

  const porPost    = new Map(posts.map(p => [p.id, p]));
  const porComment = new Map(comments.map(c => [c.id, c]));
  const porClub    = new Map(clubes.map(c => [c.id, c.name]));

  res.json({
    reportes: reportes.map(r => {
      const actual = r.commentId ? porComment.get(r.commentId) : porPost.get(r.postId);
      const post   = porPost.get(r.postId);
      return {
        ...r,
        clubNombre:     r.clubId ? porClub.get(r.clubId) ?? null : null,
        existe:         !!actual,
        contenidoActual: actual?.content ?? null,
        imagenUrl:      r.commentId ? null : post?.imageUrl ?? null,
        alcance:        post?.scope ?? null,
      };
    }),
    pendientes: await prisma.reporte.count({ where: { estado: 'PENDIENTE' } }),
  });
});

const resolverSchema = z.object({
  accion: z.enum(['ELIMINAR', 'DESESTIMAR']),
});

// PATCH /superadmin/reportes/:id — retirar el contenido o desestimar el reporte
router.patch('/reportes/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = resolverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const reporte = await prisma.reporte.findUnique({ where: { id: String(req.params.id) } });
  if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });

  if (parsed.data.accion === 'ELIMINAR') {
    // Si el contenido ya no existe la operacion igual se da por hecha: el
    // objetivo era que no siguiera publicado, y no lo esta.
    if (reporte.commentId) {
      await prisma.postComment.deleteMany({ where: { id: reporte.commentId } });
    } else {
      await prisma.post.deleteMany({ where: { id: reporte.postId } });
    }
    // Los demas reportes sobre lo mismo se cierran solos: ya no hay nada que
    // revisar y dejarlos en la cola obliga a resolver dos veces.
    await prisma.reporte.updateMany({
      where: {
        postId: reporte.postId,
        commentId: reporte.commentId,
        estado: 'PENDIENTE',
      },
      data: {
        estado: 'ELIMINADO',
        resueltoPor: req.auth?.email ?? null,
        resueltoEn: new Date(),
      },
    });


    if (reporte.clubId) emitToClub(reporte.clubId, 'posts');
  } else {
    await prisma.reporte.update({
      where: { id: reporte.id },
      data: {
        estado: 'DESESTIMADO',
        resueltoPor: req.auth?.email ?? null,
        resueltoEn: new Date(),
      },
    });
  }

  res.json({ ok: true });
});

// ─── Finanzas de la plataforma ───────────────────────────────────────────────
//
// La caja del negocio: lo que entra por las suscripciones de los clubes y lo
// que sale por sostenerlo. Nada de esto se cruza con el flujo de caja de un
// club, que es plata de otra persona.

/** El primer dia de ese mes, en UTC. */
function inicioDeMes(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /superadmin/finanzas?rango=mes|6m|anio  ·  o desde=&hasta=
 *
 * Ninguno de los rangos se sale del ano en curso: al decir «este ano» o «los
 * ultimos seis meses» nadie se refiere a septiembre del ano pasado. Para mirar
 * mas atras estan `desde` y `hasta`, que es justo lo que hacen los selectores
 * de fecha de la pantalla.
 *
 * Todo llega ya sumado. Traer los pagos crudos para agregarlos en el navegador
 * funciona con nueve filas y se cae con mil.
 */
router.get('/finanzas', requireAuth, requireSuperadmin, async (req, res) => {
  const ahora = new Date();
  const enero = new Date(Date.UTC(ahora.getUTCFullYear(), 0, 1));
  const finDeEsteMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));

  const qDesde = String(req.query.desde ?? '');
  const qHasta = String(req.query.hasta ?? '');
  const aMano = FECHA.test(qDesde) && FECHA.test(qHasta);

  const rango = aMano ? 'fechas' : String(req.query.rango ?? '6m');

  let desde: Date, hasta: Date;
  if (aMano) {
    desde = inicioDeMes(new Date(`${qDesde}T12:00:00Z`));
    const h = new Date(`${qHasta}T12:00:00Z`);
    // Hasta el primer dia del mes siguiente al elegido, para que ese mes entre
    // completo y no cortado por el dia que se haya escogido.
    hasta = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, 1));
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde) {
      return res.status(400).json({ error: 'Ese rango de fechas no es válido.' });
    }
  } else {
    hasta = finDeEsteMes;
    if (rango === 'mes') {
      desde = inicioDeMes(ahora);
    } else if (rango === 'anio') {
      desde = enero;
    } else {
      // Seis meses contando el actual, pero sin salirse del ano.
      const seis = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 5, 1));
      desde = seis < enero ? enero : seis;
    }
  }

  const [porMes, categorias, clubes, mensual, pulso] = await Promise.all([
    mesesDe(desde, hasta),
    gastosPorCategoria(desde, hasta),
    clubesQuePagan(),
    ingresoMensual(),
    pulsoDelNegocio(),
  ]);

  res.json({ meses: porMes, categorias, clubes, mensual, pulso, rango, desde, hasta });
});

const gastoSchema = z.object({
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto:       z.number().positive().max(1_000_000_000),
  categoria:   z.enum(['INFRAESTRUCTURA', 'COMISIONES', 'PUBLICIDAD', 'HERRAMIENTAS', 'OTROS']),
  descripcion: z.string().trim().min(2).max(200),
});

/** GET /superadmin/finanzas/gastos — los ultimos registrados. */
router.get('/finanzas/gastos', requireAuth, requireSuperadmin, async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 30, 1), 200);
  const gastos = await prisma.gastoPlataforma.findMany({
    orderBy: { fecha: 'desc' },
    take: limite,
  });
  res.json({ gastos });
});

/** POST /superadmin/finanzas/gastos — se registran a mano, no hay de donde sacarlos. */
router.post('/finanzas/gastos', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = gastoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Revisa los datos del gasto.', detalle: parsed.error.issues });
  const d = parsed.data;

  // Al mediodia UTC: guardado a medianoche, cualquier huso al oeste lo corre al
  // dia anterior y el gasto se contaria en el mes que no es.
  const fecha = new Date(`${d.fecha}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'Esa fecha no es válida.' });

  const gasto = await prisma.gastoPlataforma.create({
    data: {
      fecha,
      monto: d.monto,
      categoria: d.categoria,
      descripcion: d.descripcion,
      registradoPor: req.auth?.clerkId ?? null,
    },
  });

  res.status(201).json({ gasto });
});

/**
 * DELETE /superadmin/finanzas/gastos/:id
 *
 * Los que tienen `origen` no se borran: los puso el sistema leyendo lo que
 * cobro la pasarela, asi que borrarlos seria negar una plata que de verdad
 * salio. Ademas el barrido los volveria a crear en la vuelta siguiente.
 */
router.delete('/finanzas/gastos/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const { count } = await prisma.gastoPlataforma.deleteMany({
    where: { id: String(req.params.id), origen: null },
  });
  if (count === 0) {
    return res.status(404).json({ error: 'Ese gasto ya no existe o lo registró el sistema.' });
  }
  res.json({ ok: true });
});

export default router;
