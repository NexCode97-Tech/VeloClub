import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { addToAllowlist, removeFromAllowlist } from '../lib/clerk-allowlist';

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
});

router.get('/clubs', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    include: {
      _count: { select: { members: true } },
      users: { where: { role: 'ADMIN' }, select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ clubs });
});

router.post('/clubs', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { clubName, adminEmail, adminName } = parsed.data;

  const existing = await prisma.member.findFirst({ where: { email: adminEmail } });
  if (existing) return res.status(400).json({ error: 'Este email ya está registrado en otro club' });

  const club = await prisma.club.create({
    data: {
      name: clubName,
      members: {
        create: { fullName: adminName, email: adminEmail, role: 'ADMIN', inviteStatus: 'PENDING' },
      },
    },
    include: { _count: { select: { members: true } } },
  });

  await addToAllowlist(adminEmail);
  await crearNotificacion('CLUB_CREADO', 'Nuevo club registrado', `${clubName} fue creado con admin ${adminName}.`);

  res.status(201).json({ club });
});

router.patch('/clubs/:id/toggle', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const updated = await prisma.club.update({ where: { id }, data: { active: !club.active } });

  if (!updated.active) {
    await crearNotificacion('CLUB_DESACTIVADO', 'Club desactivado', `${club.name} fue desactivado.`);
  }

  res.json({ club: updated });
});

// PATCH /superadmin/clubs/:id — editar nombre del club
router.patch('/clubs/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const { name } = req.body;
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Nombre inválido' });
  const club = await prisma.club.update({ where: { id }, data: { name: String(name).trim() } });
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
    select: { id: true, fullName: true, email: true, role: true, inviteStatus: true },
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
      id: true, name: true, active: true,
      suscripcion: { include: { pagos: { orderBy: { createdAt: 'asc' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ clubs });
});

const suscripcionSchema = z.object({
  planMonto: z.number().positive(),
  año: z.number().int().min(2024),
});

router.post('/suscripciones/:clubId', requireAuth, requireSuperadmin, async (req, res) => {
  const clubId = String(req.params.clubId);
  const parsed = suscripcionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const suscripcion = await prisma.clubSuscripcion.upsert({
    where: { clubId },
    update: { planMonto: parsed.data.planMonto, año: parsed.data.año },
    create: { clubId, planMonto: parsed.data.planMonto, año: parsed.data.año },
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

router.patch('/suscripciones/pagos/:pagoId', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  const { estado } = req.body;
  if (!['PENDING', 'PAID', 'OVERDUE'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  const pago = await prisma.suscripcionPago.update({
    where: { id: pagoId },
    data: { estado, fecha: estado === 'PAID' ? new Date() : undefined },
  });
  res.json({ pago });
});

router.delete('/suscripciones/pagos/:pagoId', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  await prisma.suscripcionPago.delete({ where: { id: pagoId } });
  res.json({ ok: true });
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

export default router;
