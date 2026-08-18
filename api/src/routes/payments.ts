import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { notifyClubStaff } from '../lib/notify';
import { v2 as cloudinary } from 'cloudinary';
import { createQueue } from '../lib/queue';
import { validarSubida } from '../lib/upload-guard';
import { createLimiter } from '../lib/rate-limit';

const fmtCOP = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const paymentSchema = z.object({
  memberId: z.string(),
  amount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'REFUNDED']).default('PENDING'),
  notes: z.string().optional(),
  // Sede a la que corresponde la mensualidad. Si no llega, se deduce del
  // deportista cuando tiene una sola.
  locationId: z.string().nullable().optional(),
});

// Todos los campos son opcionales porque es un PATCH, pero los que lleguen deben
// ser válidos: el monto alimenta el flujo de caja y la fecha se convierte a Date.
const patchPaymentSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'REFUNDED']).optional(),
  amount: z.number().positive().max(100_000_000).optional(),
  notes:  z.string().max(500).optional(),
  paidAt: z.string().datetime().optional(),
});

/**
 * Sede de un deportista, solo si tiene UNA.
 *
 * Con varias devuelve null a proposito: no hay forma de saber a que disciplina
 * correspondia esa mensualidad, y elegir una al azar ensucia justo los numeros
 * que el club va a mirar. El administrador la elige a mano en esos casos.
 */
async function sedeDelMiembro(memberId: string): Promise<string | null> {
  const sedes = await prisma.memberLocation.findMany({
    where: { memberId },
    select: { locationId: true },
    take: 2,
  });
  return sedes.length === 1 ? sedes[0].locationId : null;
}

async function createCashEntry(clubId: string, paymentId: string, amount: number, memberName: string, month: number, year: number, paidAt?: Date | null, locationId?: string | null) {
  const existing = await prisma.cashEntry.findUnique({ where: { paymentId } });
  if (existing) {
    // Ya existe el ingreso: mantener el monto sincronizado si cambió la tarifa del pago.
    if (existing.amount !== amount) {
      await prisma.cashEntry.update({ where: { paymentId }, data: { amount } });
    }
    return;
  }
  // La fecha del ingreso es el día real en que se marcó el pago (se muestra en el flujo
  // de caja). El agrupamiento por mes lo hace el filtro usando el mes/año de la cuota
  // (ver GET /cashflow), de modo que "Cobrado {mes}" e "Ingresos {mes}" coincidan aunque
  // el pago se haya hecho adelantado o atrasado.
  const date = paidAt ?? new Date();
  await prisma.cashEntry.create({
    data: {
      clubId,
      type:        'INCOME',
      amount,
      description: `Mensualidad ${memberName} — ${MONTH_NAMES[month - 1]} ${year}`,
      paymentId,
      // El ingreso hereda la sede del pago: si no, el filtro de Finanzas
      // mostraria la mensualidad en Mensualidades pero no en Flujo de caja.
      locationId: locationId ?? null,
      date,
    },
  });
}

// POST /payments/generate-month — genera pagos PENDING del mes para todos los miembros configurados
router.post('/generate-month', createLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });

  const parsed = z.object({
    month: z.number().min(1).max(12),
    year:  z.number().min(2020).max(2100),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { month, year } = parsed.data;
  const clubId = req.user.clubId ?? '';

  const queue = createQueue('bulk-payments');
  await queue.add('generate-month', { clubId, month, year });
  res.json({ ok: true, queued: true });
});

// GET /payments/notifications — pagos PENDING próximos a vencer o vencidos
router.get('/notifications', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.json({ notifications: [] });

  const clubId = req.user.clubId ?? '';
  const now = new Date();
  const today = now.getDate();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  // Pagos PENDING o OVERDUE del mes actual con miembro que tenga paymentDueDay
  const payments = await prisma.payment.findMany({
    where: {
      clubId,
      status: { in: ['PENDING', 'OVERDUE'] },
      year,
      month,
      member: { paymentDueDay: { not: null } },
    },
    include: { member: { select: { id: true, fullName: true, paymentDueDay: true } } },
  });

  const notifications = payments
    .map(p => {
      const dueDay = p.member.paymentDueDay!;
      const daysLeft = dueDay - today;
      if (daysLeft < 0) {
        return { type: 'overdue' as const, memberId: p.member.id, memberName: p.member.fullName, daysLate: Math.abs(daysLeft), paymentId: p.id };
      }
      if (daysLeft <= 3) {
        return { type: 'due_soon' as const, memberId: p.member.id, memberName: p.member.fullName, daysLeft, paymentId: p.id };
      }
      return null;
    })
    .filter(Boolean);

  res.json({ notifications });
});

// GET /payments?month=&year=&status=
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const month    = req.query.month  ? parseInt(String(req.query.month))  : null;
  const year     = req.query.year   ? parseInt(String(req.query.year))   : null;
  const status   = req.query.status ? String(req.query.status)           : null;
  // Filtro por deportista: trae su historial completo para el panel de Finanzas
  const memberId = req.query.memberId ? String(req.query.memberId)       : null;
  // 'GENERAL' pide las cuotas sin sede; omitirlo trae todas.
  const sede     = req.query.locationId ? String(req.query.locationId)   : null;

  const where: Record<string, unknown> = { clubId };
  if (month  !== null) where.month  = month;
  if (year   !== null) where.year   = year;
  if (status)          where.status = status;
  if (memberId)        where.memberId = memberId;
  if (sede)            where.locationId = sede === 'GENERAL' ? null : sede;

  // Un STUDENT solo puede ver su propio historial. Antes se devolvían todos los
  // pagos del club (con email y teléfono de cada miembro) y el filtrado ocurría
  // en el cliente, así que los datos igual viajaban al navegador.
  if (req.user.role === 'STUDENT') {
    const self = await prisma.member.findFirst({
      where: {
        clubId,
        OR: [
          { clerkId: req.auth?.clerkId },
          ...(req.auth?.email ? [{ email: { equals: req.auth.email, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!self) return res.json({ payments: [] });
    where.memberId = self.id;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      member:   { select: { id: true, fullName: true, email: true, phone: true } },
      location: { select: { id: true, name: true } },
    },
    // Para el historial de un deportista importa el orden cronológico del período
    orderBy: memberId ? [{ year: 'desc' }, { month: 'desc' }] : { createdAt: 'desc' },
  });

  res.json({ payments });
});

// POST /payments
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const { dueDate, paidAt, ...rest } = parsed.data;
  const clubId = req.user.clubId ?? '';

  const payment = await prisma.payment.create({
    data: {
      ...rest,
      clubId,
      locationId: rest.locationId ?? await sedeDelMiembro(rest.memberId),
      dueDate: dueDate ? new Date(dueDate) : null,
      paidAt:  paidAt  ? new Date(paidAt)  : rest.status === 'PAID' ? new Date() : null,
    },
    include: { member: { select: { id: true, fullName: true, email: true } } },
  });

  if (payment.status === 'PAID') {
    await createCashEntry(clubId, payment.id, payment.amount, payment.member.fullName, payment.month, payment.year, payment.paidAt, payment.locationId);
    await notifyClubStaff(clubId, {
      tipo: 'PAYMENT_RECEIVED',
      titulo: 'Pago recibido',
      cuerpo: `${payment.member.fullName} pagó ${MONTH_NAMES[payment.month - 1]} (${fmtCOP(payment.amount)}).`,
      link: '/dashboard/finanzas',
    }, req.auth?.clerkId);
  }

  emitToClub(clubId, 'payments');
  res.status(201).json({ payment });
});

// PATCH /payments/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const id = String(req.params.id);
  const clubId = req.user.clubId ?? '';

  const existing = await prisma.payment.findFirst({
    where: { id, clubId },
    include: { member: { select: { fullName: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  // Antes solo se validaba el estado: amount podía llegar negativo o gigante y
  // se propagaba al CashEntry, y un paidAt basura producía una fecha inválida.
  const parsedPatch = patchPaymentSchema.safeParse(req.body);
  if (!parsedPatch.success) return res.status(400).json({ error: parsedPatch.error.issues });
  const { status, paidAt, notes, amount } = parsedPatch.data;

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (amount !== undefined) data.amount = amount;
  if (notes  !== undefined) data.notes  = notes;
  if (paidAt)               data.paidAt = new Date(paidAt);
  else if (status === 'PAID' && !existing.paidAt) data.paidAt = new Date();

  // Si la cuota quedo sin sede —se genero antes de que existiera el campo, o el
  // deportista tenia varias y ahora tiene una—, se intenta deducir al pagarla.
  if (!existing.locationId) {
    const sede = await sedeDelMiembro(existing.memberId);
    if (sede) data.locationId = sede;
  }

  const payment = await prisma.payment.update({
    where: { id },
    data,
    include: { member: { select: { id: true, fullName: true, email: true } } },
  });

  if (payment.status === 'PAID') {
    await createCashEntry(
      clubId, payment.id,
      payment.amount,
      existing.member.fullName,
      payment.month, payment.year,
      payment.paidAt,
      payment.locationId
    );
    // Notificar solo cuando el pago pasa a PAID (no si ya lo estaba)
    if (existing.status !== 'PAID') {
      await notifyClubStaff(clubId, {
        tipo: 'PAYMENT_RECEIVED',
        titulo: 'Pago recibido',
        cuerpo: `${existing.member.fullName} pagó ${MONTH_NAMES[payment.month - 1]} (${fmtCOP(payment.amount)}).`,
        link: '/dashboard/finanzas',
      }, req.auth?.clerkId);
    }
  }

  emitToClub(clubId, 'payments');
  res.json({ payment });
});

// DELETE /payments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });
  const id = String(req.params.id);

  const existing = await prisma.payment.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  await prisma.cashEntry.deleteMany({ where: { paymentId: id } });
  await prisma.payment.delete({ where: { id } });


  emitToClub(req.user.clubId ?? '', 'payments');
  res.json({ ok: true });
});

// POST /payments/:id/receipt — subir comprobante de pago
router.post('/:id/receipt', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });

  const id = String(req.params.id);
  const { base64 } = req.body as { base64: string };
  const vRecibo = validarSubida(base64, 'doc');
  if (!vRecibo.ok) return res.status(400).json({ error: vRecibo.error });

  const clubId = req.user.clubId ?? '';
  const existing = await prisma.payment.findFirst({ where: { id, clubId } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  try {
    // Eliminar comprobante anterior si existe
    if (existing.receiptPublicId) {
      await cloudinary.uploader.destroy(existing.receiptPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder:    'veloclub/receipts',
      public_id: `receipt_${id}`,
      overwrite: true,
    });

    const payment = await prisma.payment.update({
      where: { id },
      data:  { receiptUrl: result.secure_url, receiptPublicId: result.public_id },
      select: { id: true, receiptUrl: true },
    });

    emitToClub(clubId, 'payments');
    res.json({ payment });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[receipt upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// POST /payments/:id/my-receipt — el deportista sube el comprobante de SU pago.
// El pago queda "en revisión" (no se marca pagado); se notifica al staff.
router.post('/:id/my-receipt', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const id = String(req.params.id);
  const { base64 } = req.body as { base64: string };
  const vMiRecibo = validarSubida(base64, 'doc');
  if (!vMiRecibo.ok) return res.status(400).json({ error: vMiRecibo.error });

  // Resolver el miembro del deportista (los STUDENT no tienen req.user)
  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { clerkId: req.auth.clerkId },
        ...(req.auth.email ? [{ email: { equals: req.auth.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { id: true, fullName: true, clubId: true },
  });
  if (!member) return res.status(404).json({ error: 'No encontramos tu perfil de miembro' });

  // El pago debe pertenecer a este miembro y no estar ya pagado
  const existing = await prisma.payment.findFirst({ where: { id, memberId: member.id } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });
  if (existing.status === 'PAID') return res.status(400).json({ error: 'Este pago ya está registrado como pagado' });

  try {
    if (existing.receiptPublicId) {
      await cloudinary.uploader.destroy(existing.receiptPublicId).catch(() => {});
    }
    const result = await cloudinary.uploader.upload(base64, {
      folder:    'veloclub/receipts',
      public_id: `receipt_${id}`,
      overwrite: true,
    });
    const payment = await prisma.payment.update({
      where: { id },
      data:  { receiptUrl: result.secure_url, receiptPublicId: result.public_id },
      select: { id: true, receiptUrl: true },
    });

    emitToClub(member.clubId, 'payments');
    await notifyClubStaff(member.clubId, {
      tipo: 'RECEIPT_UPLOADED',
      titulo: 'Comprobante por verificar',
      cuerpo: `${member.fullName} subió el comprobante de ${MONTH_NAMES[existing.month - 1]}.`,
      link: '/dashboard/finanzas',
    });
    res.json({ payment });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[my-receipt upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /payments/:id/receipt — eliminar comprobante
router.delete('/:id/receipt', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Sin permisos' });

  const id = String(req.params.id);
  const clubId = req.user.clubId ?? '';
  const existing = await prisma.payment.findFirst({ where: { id, clubId } });
  if (!existing) return res.status(404).json({ error: 'Pago no encontrado' });

  if (existing.receiptPublicId) {
    await cloudinary.uploader.destroy(existing.receiptPublicId).catch(() => {});
  }

  await prisma.payment.update({
    where: { id },
    data:  { receiptUrl: null, receiptPublicId: null },
  });

  emitToClub(clubId, 'payments');
  res.json({ ok: true });
});

export default router;
