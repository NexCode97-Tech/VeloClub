import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { addToAllowlist, removeFromAllowlist } from '../lib/clerk-allowlist';

const router = Router();

// Middleware: solo superadmin (verifica email directamente, sin depender de la BD)
function requireSuperadmin(req: any, res: any, next: any) {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').map((e: string) => e.trim()).filter(Boolean);
  if (!req.auth || !superadminEmails.includes(req.auth.email)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminName: z.string().min(2).max(100),
});

// GET /superadmin/clubs
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

// POST /superadmin/clubs — crea club + pre-registra admin
router.post('/clubs', requireAuth, requireSuperadmin, async (req, res) => {
  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { clubName, adminEmail, adminName } = parsed.data;

  // Check email not already used
  const existing = await prisma.member.findFirst({ where: { email: adminEmail } });
  if (existing) return res.status(400).json({ error: 'Este email ya está registrado en otro club' });

  const club = await prisma.club.create({
    data: {
      name: clubName,
      members: {
        create: {
          fullName: adminName,
          email: adminEmail,
          role: 'ADMIN',
          inviteStatus: 'PENDING',
        },
      },
    },
    include: { _count: { select: { members: true } } },
  });

  // Agregar email del admin al allowlist de Clerk
  await addToAllowlist(adminEmail);

  res.status(201).json({ club });
});

// PATCH /superadmin/clubs/:id/toggle — activar/desactivar
router.patch('/clubs/:id/toggle', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const updated = await prisma.club.update({
    where: { id },
    data: { active: !club.active },
  });
  res.json({ club: updated });
});

// DELETE /superadmin/clubs/:id
router.delete('/clubs/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const id = String(req.params.id);

  // Quitar emails de los miembros del allowlist de Clerk
  const members = await prisma.member.findMany({ where: { clubId: id }, select: { email: true } });
  await Promise.all(members.filter(m => m.email).map(m => removeFromAllowlist(m.email!)));

  await prisma.club.delete({ where: { id } });
  res.json({ ok: true });
});

// ─── Suscripciones (finanzas de plataforma) ───────────────────────────────────

// GET /superadmin/suscripciones — trae todos los clubs con su suscripcion y pagos
router.get('/suscripciones', requireAuth, requireSuperadmin, async (_req, res) => {
  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      name: true,
      active: true,
      suscripcion: {
        include: {
          pagos: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ clubs });
});

// POST /superadmin/suscripciones/:clubId — crea o actualiza suscripcion del club
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

// POST /superadmin/suscripciones/:clubId/pagos — registra un abono
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

  // Buscar o crear suscripcion
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
  res.status(201).json({ pago });
});

// PATCH /superadmin/suscripciones/pagos/:pagoId — actualiza estado de un pago
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

// DELETE /superadmin/suscripciones/pagos/:pagoId
router.delete('/suscripciones/pagos/:pagoId', requireAuth, requireSuperadmin, async (req, res) => {
  const pagoId = String(req.params.pagoId);
  await prisma.suscripcionPago.delete({ where: { id: pagoId } });
  res.json({ ok: true });
});

export default router;
