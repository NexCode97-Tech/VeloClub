import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { addToAllowlist, removeFromAllowlist } from '../lib/clerk-allowlist';
import { v2 as cloudinary } from 'cloudinary';

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

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

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
      // Al reactivar, limpia el trial para que el club quede como pagado
      ...(reactivating ? { trialEndsAt: null } : {}),
    },
  });

  if (!updated.active) {
    await crearNotificacion('CLUB_DESACTIVADO', 'Club desactivado', `${club.name} fue desactivado.`);
  }

  res.json({ club: updated });
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
  const members = await prisma.member.findMany({ where: { clubId: id }, select: { email: true } });
  await Promise.all(members.filter(m => m.email).map(m => removeFromAllowlist(m.email!)));
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
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { email: true } });
  if (member?.email) await removeFromAllowlist(member.email);
  await prisma.member.delete({ where: { id: memberId } });
  res.json({ ok: true });
});

// ─── Suscripciones ────────────────────────────────────────────────────────────

router.get('/suscripciones', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    select: {
      id: true, name: true, active: true, createdAt: true, logoUrl: true, trialEndsAt: true,
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

// ─── Comprobantes de SuscripcionPago ─────────────────────────────────────────

// POST /superadmin/suscripciones/pagos/:pagoId/receipt
router.post('/suscripciones/pagos/:pagoId/receipt', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const { base64, fileName } = req.body as { base64: string; fileName?: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

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

export default router;
