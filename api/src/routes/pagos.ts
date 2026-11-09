// La suscripción de un club a VeloClub, cobrada con Whop.
//
// El precio lo pone siempre este servidor: el navegador manda el token del
// medio de pago y la elección de la renovación, nunca un monto. Cada cobro va
// a Whop con su plan en línea en pesos (ver lib/whop.ts).
//
// La renovación automática la dispara VeloClub (lib/renovaciones.ts) con el
// medio que el club dejó guardado al pagar. No hay una ruta para prenderla sin
// pagar: el único momento en que se guarda la tarjeta es el pago.
import { Router, type Request, type Response } from 'express';
import * as Sentry from '@sentry/node';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { calcularPrecioPlan, inicioDelPeriodo, vigencia, type TipoPlan } from '../lib/pricing';
import { contarDeportistasActivos, contarDeportistasFacturables } from '../lib/deportistas';
import { validarCupon, descuentoCupon, registrarCanje } from '../lib/cupones';
import { paymentLimiter } from '../lib/rate-limit';
import { cobrarConToken, obtenerPagoWhop, reembolsarPagoWhop, comprobanteWhop, ErrorWhop } from '../lib/whop';
import { pagoExitoso } from '../lib/whop-eventos';
import { registrarReembolso } from '../lib/reembolsos';
import { registrarEvento } from '../lib/auditoria';
import { activarClubTrasPago } from '../lib/sync-suscripciones';
import { notifyClubStaff } from '../lib/notify';
import { cancelarPreapproval, reembolsarPago } from '../lib/mercadopago';
import { pasarelaDe } from '../lib/pasarela';

const router = Router();

export const TITULO_PLAN: Record<TipoPlan, string> = {
  MENSUAL: 'Plan Mensual',
  TRIMESTRAL: 'Plan Trimestral',
  ANUAL: 'Plan Anual',
};

function soloAdmin(req: Request, res: Response): boolean {
  if (!req.user) { res.status(401).json({ error: 'No autenticado' }); return false; }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Solo el administrador del club puede gestionar la suscripción' });
    return false;
  }
  return true;
}

/** La suscripción del club, creada si todavía no existe (con el precio real, no el del esquema). */
async function asegurarSuscripcion(clubId: string) {
  const existente = await prisma.clubSuscripcion.findUnique({ where: { clubId } });
  if (existente) return existente;
  const activos = await contarDeportistasActivos(clubId);
  return prisma.clubSuscripcion.create({
    data: { clubId, año: new Date().getFullYear(), planMonto: calcularPrecioPlan(activos, 'MENSUAL') },
  });
}

/**
 * Un club que venía de Mercado Pago puede tener todavía su cobro recurrente
 * allá. Al apagar la renovación o cancelar se corta también ese, para que no
 * le llegue un cobro de una pasarela que ya no usa.
 */
async function cortarRecurrenteMercadoPago(s: { id: string; clubId: string; mpPreapprovalId: string | null }) {
  if (!s.mpPreapprovalId) return;
  try {
    await cancelarPreapproval(s.mpPreapprovalId);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pagos:cortar-mp' }, extra: { clubId: s.clubId, preapprovalId: s.mpPreapprovalId } });
  }
  await prisma.clubSuscripcion.update({ where: { id: s.id }, data: { mpPreapprovalId: null } });
}

const urlAjustes = () => (process.env.WEB_ORIGIN ?? 'https://www.veloclubtech.com').replace(/\/$/, '') + '/ajustes?tab=suscripcion';

// ── POST /pagos/cobrar ───────────────────────────────────────────────────────
router.post('/cobrar', paymentLimiter, requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const { confirmationToken, renovacion, aceptaTerminos, couponCode } = req.body as {
    confirmationToken?: unknown; renovacion?: unknown; aceptaTerminos?: unknown; couponCode?: unknown;
  };

  if (pasarelaDe(clubId) !== 'whop') {
    return res.status(409).json({ error: 'Tu club todavía paga con Mercado Pago. Recarga la página.' });
  }
  if (aceptaTerminos !== true) {
    return res.status(400).json({ error: 'Debes aceptar los términos y condiciones para continuar' });
  }
  if (typeof confirmationToken !== 'string' || !confirmationToken || confirmationToken.length > 500) {
    return res.status(400).json({ error: 'Faltan los datos del pago' });
  }
  const conRenovacion = renovacion === true;

  const suscripcion = await asegurarSuscripcion(clubId);
  const club = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true, email: true } });
  const tipoPlan = suscripcion.tipoPlan as TipoPlan;
  // El 5 % va solo con la renovación: con ella solo se ofrecen tarjeta y
  // billeteras, que son los medios que guardan con qué volver a cobrar.
  const base = calcularPrecioPlan(await contarDeportistasFacturables(clubId), tipoPlan, conRenovacion);

  let cuponId: string | null = null;
  let descuento = 0;
  if (typeof couponCode === 'string' && couponCode.trim()) {
    const v = await validarCupon(couponCode, clubId);
    if (!v.ok) return res.status(400).json({ error: v.error });
    cuponId = v.cupon.id;
    descuento = descuentoCupon(base, v.cupon.porcentaje);
  }
  const monto = Math.max(0, base - descuento);
  if (monto <= 0) {
    return res.status(400).json({ error: 'Con este cupón no hay nada que cobrar. Usa «Activar con cupón».' });
  }

  // Constancia del consentimiento (Ley 1480 de 2011). La renovación en sí se
  // prende cuando el pago entra (whop-eventos.ts), no ahora.
  await prisma.clubSuscripcion.update({
    where: { id: suscripcion.id },
    data: {
      consentimientoPagoAt: new Date(),
      ...(conRenovacion ? { consentimientoRecurrenteAt: new Date() } : {}),
    },
  });

  try {
    const pago = await cobrarConToken({
      confirmationToken,
      monto,
      titulo: TITULO_PLAN[tipoPlan],
      email: req.auth?.email || club?.email || 'sin-correo@veloclubtech.com',
      guardar: conRenovacion,
      metadata: {
        suscripcionId: suscripcion.id,
        clubId,
        tipo: 'pago',
        tipoPlan,
        renovacion: conRenovacion ? 'si' : 'no',
        ...(cuponId ? { cuponId } : {}),
      },
      returnUrl: urlAjustes(),
      // El mismo token nunca cobra dos veces, aunque el club dé doble clic.
      idempotencia: ('pago-' + suscripcion.id + '-' + confirmationToken).slice(0, 255),
    });

    if (cuponId) await registrarCanje(cuponId, clubId, descuento);
    // Si ya quedó pagado se registra de una vez; el aviso de Whop llega después
    // y no duplica nada, porque todo va por whopPaymentId.
    if (pago.status === 'paid') await pagoExitoso(pago);

    return res.json({ id: pago.id, status: pago.status, clientSecret: pago.client_secret ?? null });
  } catch (err) {
    const detalle = err instanceof ErrorWhop ? err.cuerpo : err instanceof Error ? err.message : String(err);
    await registrarEvento({
      accion: 'PAGO_RECHAZADO',
      entidad: 'SuscripcionPago',
      entidadId: suscripcion.id,
      resumen: 'Whop rechazó $' + monto.toLocaleString('es-CO') + ' de ' + (club?.name ?? 'el club') + '.',
      clubId,
      clubNombre: club?.name ?? null,
      datos: { monto, pasarela: 'whop', detalle: detalle.slice(0, 500) },
    }).catch(() => undefined);
    console.warn('[pagos/cobrar] rechazado', clubId, detalle.slice(0, 300));
    if (!(err instanceof ErrorWhop) || err.status >= 500) {
      Sentry.captureException(err, { tags: { route: 'pagos/cobrar' }, extra: { clubId } });
    }
    return res.status(402).json({ error: 'El pago no pasó. Revisa los datos o intenta con otro medio.' });
  }
});

// ── GET /pagos/estado/:id ────────────────────────────────────────────────────
// Al volver de PSE, de 3D Secure o de la app del banco: se le pregunta a Whop
// por el pago en vez de esperar el aviso, para que la pantalla no se quede en
// «procesando».
router.get('/estado/:id', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const id = String(req.params.id);
  if (!/^pay_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Pago inválido' });
  try {
    const pago = await obtenerPagoWhop(id);
    if (pago.metadata?.clubId !== req.user!.clubId) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.status === 'paid') await pagoExitoso(pago);
    res.json({ status: pago.status, monto: pago.presentment_total, medio: pago.payment_method_type });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pagos/estado' } });
    res.status(502).json({ error: 'No se pudo consultar el pago' });
  }
});

// ── POST /pagos/activar-cupon ────────────────────────────────────────────────
// Un cupón del 100 % deja el total en cero: no hay nada que cobrar y no pasa
// por Whop. Se deja constancia con un pago de $0.
router.post('/activar-cupon', paymentLimiter, requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const { couponCode, aceptaTerminos } = req.body as { couponCode?: unknown; aceptaTerminos?: unknown };
  if (aceptaTerminos !== true) return res.status(400).json({ error: 'Debes aceptar los términos y condiciones para continuar' });
  if (typeof couponCode !== 'string' || !couponCode.trim()) return res.status(400).json({ error: 'Ingresa un código de cupón' });

  const v = await validarCupon(couponCode, clubId);
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (v.cupon.porcentaje < 100) return res.status(400).json({ error: 'Este cupón no cubre el total. Paga el resto con Whop.' });

  const suscripcion = await asegurarSuscripcion(clubId);
  const datos = await prisma.clubSuscripcion.findUnique({
    where: { id: suscripcion.id },
    select: { tipoPlan: true, pagos: { select: { estado: true, fecha: true } }, club: { select: { trialEndsAt: true } } },
  });
  const tipoPlan = suscripcion.tipoPlan as TipoPlan;
  const base = calcularPrecioPlan(await contarDeportistasFacturables(clubId), tipoPlan, false);

  await prisma.suscripcionPago.create({
    data: {
      suscripcionId: suscripcion.id,
      concepto: 'Suscripción VeloClub (cupón ' + v.cupon.codigo + ', 100 %)',
      monto: 0,
      fecha: inicioDelPeriodo(datos?.pagos ?? [], tipoPlan, datos?.club.trialEndsAt),
      estado: 'PAID',
    },
  });
  await prisma.clubSuscripcion.update({ where: { id: suscripcion.id }, data: { consentimientoPagoAt: new Date() } });
  await activarClubTrasPago(clubId);
  await registrarCanje(v.cupon.id, clubId, base);
  res.json({ status: 'paid' });
});

// ── POST /pagos/renovacion/apagar ────────────────────────────────────────────
// Se olvida la tarjeta y no hay más cobros. Lo pagado sigue hasta que venza.
router.post('/renovacion/apagar', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const s = await prisma.clubSuscripcion.findUnique({ where: { clubId: req.user!.clubId ?? '' } });
  if (!s) return res.status(404).json({ error: 'Suscripción no encontrada' });
  await cortarRecurrenteMercadoPago(s);
  await prisma.clubSuscripcion.update({
    where: { id: s.id },
    data: { autoRenew: false, whopPaymentMethodId: null, proximoCobroAt: null, intentosFallidos: 0 },
  });
  res.json({ ok: true });
});

// ── POST /pagos/cancelar ─────────────────────────────────────────────────────
// «Me voy»: apaga la renovación y marca la suscripción como cancelada. El club
// sigue activo hasta que venza lo pagado. Si el último pago todavía no empezó a
// correr (se pagó durante la prueba), no alcanzó a usar ni un día y se le
// devuelve entero.
router.post('/cancelar', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const s = await prisma.clubSuscripcion.findUnique({ where: { clubId }, include: { pagos: true } });
  if (!s) return res.status(404).json({ error: 'Suscripción no encontrada' });

  const vig = vigencia(s.pagos, s.tipoPlan as TipoPlan);
  if (!vig || vig.vencido) return res.status(400).json({ error: 'No tienes una suscripción activa para cancelar' });

  const pagados = s.pagos.filter(p => p.estado === 'PAID' && p.fecha);
  const ultimo = pagados.reduce<typeof pagados[number] | null>((a, b) => (!a || b.fecha! > a.fecha! ? b : a), null);

  let reembolsado = false;
  if (ultimo && ultimo.fecha! > new Date() && ultimo.monto > 0 && (ultimo.whopPaymentId || ultimo.mpPaymentId)) {
    try {
      // El pago se devuelve por la pasarela por la que entró.
      if (ultimo.whopPaymentId) {
        await reembolsarPagoWhop(ultimo.whopPaymentId, 'reembolso-' + ultimo.whopPaymentId);
        await registrarReembolso({ whopPaymentId: ultimo.whopPaymentId, monto: ultimo.monto });
      } else {
        await reembolsarPago(ultimo.mpPaymentId!);
        await registrarReembolso({ mpPaymentId: ultimo.mpPaymentId!, monto: ultimo.monto });
      }
      reembolsado = true;
    } catch (err) {
      console.error('[pagos/cancelar] no se pudo reembolsar', err instanceof Error ? err.message : err);
      Sentry.captureException(err, { tags: { route: 'pagos/cancelar:reembolso' }, extra: { clubId, pagoId: ultimo.whopPaymentId ?? ultimo.mpPaymentId } });
    }
  }
  await cortarRecurrenteMercadoPago(s);

  await prisma.clubSuscripcion.update({
    where: { id: s.id },
    data: { autoRenew: false, whopPaymentMethodId: null, proximoCobroAt: null, intentosFallidos: 0, canceladaAt: new Date() },
  });

  await notifyClubStaff(clubId, {
    tipo: 'SUSCRIPCION_CANCELADA',
    titulo: 'Suscripción cancelada',
    cuerpo: reembolsado
      ? 'Cancelaste tu suscripción antes de que empezara a correr. Te devolvimos el pago completo.'
      : 'Cancelaste tu suscripción. Tu club sigue activo ' + vig.diasRestantes + ' día' + (vig.diasRestantes !== 1 ? 's' : '')
        + ' más y no se harán nuevos cobros. Puedes reactivarla cuando quieras.',
    link: '/ajustes?tab=suscripcion',
  });

  res.json({ ok: true, reembolsado, diasRestantes: reembolsado ? 0 : vig.diasRestantes });
});

// ── GET /pagos/:id/comprobante ───────────────────────────────────────────────
// El comprobante oficial de Whop en PDF. Solo de un pago del propio club.
router.get('/:id/comprobante', requireAuth, async (req, res) => {
  if (!soloAdmin(req, res)) return;
  const id = String(req.params.id);
  if (!/^pay_[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'Pago inválido' });
  try {
    const pago = await obtenerPagoWhop(id);
    if (pago.metadata?.clubId !== req.user!.clubId) return res.status(404).json({ error: 'Pago no encontrado' });
    const pdf = await comprobanteWhop(id);
    if (!pdf.url) return res.status(502).json({ error: 'Whop no entregó el comprobante' });
    res.json({ url: pdf.url });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'pagos/comprobante' } });
    res.status(502).json({ error: 'No se pudo generar el comprobante' });
  }
});

export default router;
