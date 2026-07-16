import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { notifyClubStaff } from '../lib/notify';
import { calcularPrecioPlan, vigencia, type TipoPlan } from '../lib/pricing';
import {
  crearPreferenciaCheckout, crearPreapproval, cancelarPreapproval,
  obtenerPago, obtenerPreapproval, verificarFirmaWebhook, buscarPagoPorReferencia,
  listarMediosPago, crearPagoDirecto, type MedioPago,
} from '../lib/mercadopago';

const router = Router();

function requireAdmin(req: import('express').Request, res: import('express').Response): boolean {
  if (!req.user) { res.status(401).json({ error: 'No autenticado' }); return false; }
  if (req.user.role !== 'ADMIN') { res.status(403).json({ error: 'Solo el administrador del club puede gestionar la suscripción' }); return false; }
  return true;
}

async function suscripcionDelClub(clubId: string) {
  return prisma.clubSuscripcion.upsert({
    where: { clubId },
    update: {},
    create: { clubId, año: new Date().getFullYear() },
    include: { pagos: true },
  });
}

// ── GET /mercadopago/mi-suscripcion — estado + precio calculado ─────────────
router.get('/mi-suscripcion', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const [suscripcion, cantidadDeportistas] = await Promise.all([
    suscripcionDelClub(clubId),
    prisma.member.count({ where: { clubId, role: 'STUDENT' } }),
  ]);

  const precio = calcularPrecioPlan(cantidadDeportistas, suscripcion.tipoPlan as TipoPlan, suscripcion.autoRenew);
  const vig = vigencia(suscripcion.pagos, suscripcion.tipoPlan as TipoPlan);

  res.json({
    suscripcion: { ...suscripcion, planMonto: precio },
    cantidadDeportistas,
    vigencia: vig,
  });
});

// ── GET /mercadopago/planes — precios de los 3 planes para elegir ───────────
router.get('/planes', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const cantidadDeportistas = await prisma.member.count({ where: { clubId, role: 'STUDENT' } });
  const planes = (['MENSUAL', 'TRIMESTRAL', 'ANUAL'] as TipoPlan[]).map(tipoPlan => ({
    tipoPlan,
    precio: calcularPrecioPlan(cantidadDeportistas, tipoPlan),
    precioConAutoRenew: calcularPrecioPlan(cantidadDeportistas, tipoPlan, true),
  }));

  res.json({ cantidadDeportistas, planes });
});

// ── POST /mercadopago/set-plan — elegir el tipo de plan antes de pagar ──────
router.post('/set-plan', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const { tipoPlan } = req.body as { tipoPlan?: string };
  if (!tipoPlan || !['MENSUAL', 'TRIMESTRAL', 'ANUAL'].includes(tipoPlan)) {
    return res.status(400).json({ error: 'tipoPlan inválido' });
  }

  const suscripcion = await suscripcionDelClub(clubId);
  await prisma.clubSuscripcion.update({
    where: { id: suscripcion.id },
    data: { tipoPlan: tipoPlan as TipoPlan },
  });

  res.json({ ok: true });
});

// ── GET /mercadopago/metodos-pago — medios disponibles para pagar en la app ─
// Cache en memoria (1h): la lista de medios de la cuenta casi nunca cambia.
let mediosCache: { data: MedioPago[]; expiresAt: number } | null = null;

router.get('/metodos-pago', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (!mediosCache || mediosCache.expiresAt < Date.now()) {
      const data = await listarMediosPago();
      mediosCache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
    }
    const activos = mediosCache.data.filter(m => m.status === 'active');

    const tarjetas = activos.filter(m => m.payment_type_id === 'credit_card' || m.payment_type_id === 'debit_card');
    const pse = activos.find(m => m.id === 'pse');
    const efecty = activos.find(m => m.id === 'efecty');

    res.json({
      tarjeta: tarjetas.length > 0,
      pse: pse ? { disponible: true, bancos: pse.financial_institutions ?? [] } : { disponible: false, bancos: [] },
      efecty: !!efecty,
    });
  } catch (err) {
    console.error('[mercadopago/metodos-pago]', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'No se pudieron cargar los medios de pago' });
  }
});

// ── POST /mercadopago/pagar — pago único dentro de la app (Checkout API) ────
// Mensajes amigables para los rechazos más comunes de tarjeta
const RECHAZO_MSG: Record<string, string> = {
  cc_rejected_insufficient_amount:   'La tarjeta no tiene fondos suficientes.',
  cc_rejected_bad_filled_card_number:'Revisa el número de la tarjeta.',
  cc_rejected_bad_filled_date:       'Revisa la fecha de vencimiento.',
  cc_rejected_bad_filled_security_code: 'Revisa el código de seguridad (CVV).',
  cc_rejected_bad_filled_other:      'Revisa los datos de la tarjeta.',
  cc_rejected_call_for_authorize:    'Tu banco requiere que autorices este pago. Llámalos e intenta de nuevo.',
  cc_rejected_card_disabled:         'La tarjeta está inactiva. Comunícate con tu banco.',
  cc_rejected_high_risk:             'El pago fue rechazado por seguridad. Intenta con otro medio de pago.',
  cc_rejected_max_attempts:          'Llegaste al límite de intentos. Intenta con otra tarjeta.',
  cc_rejected_duplicated_payment:    'Ya hiciste un pago por este valor hace poco. Espera unos minutos.',
};

router.post('/pagar', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const {
    metodo, aceptaTerminos, cardTokenId, paymentMethodId,
    docType, docNumber, personType, bancoId,
  } = req.body as {
    metodo?: 'CARD' | 'PSE' | 'EFECTY'; aceptaTerminos?: boolean;
    cardTokenId?: string; paymentMethodId?: string;
    docType?: string; docNumber?: string; personType?: string; bancoId?: string;
  };

  if (aceptaTerminos !== true) {
    return res.status(400).json({ error: 'Debes aceptar los términos y condiciones para continuar' });
  }
  if (!metodo || !['CARD', 'PSE', 'EFECTY'].includes(metodo)) {
    return res.status(400).json({ error: 'Medio de pago inválido' });
  }
  if (!docNumber || !/^[0-9]{4,15}$/.test(docNumber)) {
    return res.status(400).json({ error: 'Número de documento inválido' });
  }
  if (metodo === 'CARD' && (!cardTokenId || !paymentMethodId)) {
    return res.status(400).json({ error: 'Faltan los datos de la tarjeta' });
  }
  if (metodo === 'PSE' && !bancoId) {
    return res.status(400).json({ error: 'Selecciona tu banco' });
  }

  const [suscripcion, cantidadDeportistas, club] = await Promise.all([
    suscripcionDelClub(clubId),
    prisma.member.count({ where: { clubId, role: 'STUDENT' } }),
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true, email: true } }),
  ]);

  const monto = calcularPrecioPlan(cantidadDeportistas, suscripcion.tipoPlan as TipoPlan, suscripcion.autoRenew);
  const payerEmail = req.auth?.email || club?.email || 'sin-correo@veloclubtech.com';
  const reference = `sub-${suscripcion.id}-${Date.now()}`;
  const description = `Suscripción VeloClub — ${club?.name ?? 'Club'}`;

  // Registrar el consentimiento (Ley 1480 de 2011)
  await prisma.clubSuscripcion.update({
    where: { id: suscripcion.id },
    data: { consentimientoPagoAt: new Date() },
  });

  const identification = { type: docType || 'CC', number: docNumber };

  let payload: Record<string, unknown>;
  if (metodo === 'CARD') {
    payload = {
      transaction_amount: monto,
      token: cardTokenId,
      installments: 1,
      payment_method_id: paymentMethodId,
      description,
      external_reference: reference,
      payer: { email: payerEmail, identification },
    };
  } else if (metodo === 'PSE') {
    payload = {
      transaction_amount: monto,
      payment_method_id: 'pse',
      description,
      external_reference: reference,
      payer: {
        email: payerEmail,
        entity_type: personType === 'juridica' ? 'association' : 'individual',
        identification,
      },
      transaction_details: { financial_institution: bancoId },
      callback_url: `${process.env.WEB_ORIGIN}/dashboard/ajustes?tab=suscripcion`,
      additional_info: { ip_address: req.ip ?? '127.0.0.1' },
    };
  } else {
    payload = {
      transaction_amount: monto,
      payment_method_id: 'efecty',
      description,
      external_reference: reference,
      payer: { email: payerEmail, identification },
    };
  }

  try {
    const pago = await crearPagoDirecto(payload);

    if (pago.status === 'approved') {
      // Registrar de una vez (el webhook queda de respaldo, idempotente por mpPaymentId)
      const yaRegistrado = await prisma.suscripcionPago.findUnique({ where: { mpPaymentId: String(pago.id) } });
      if (!yaRegistrado) {
        await prisma.suscripcionPago.create({
          data: {
            suscripcionId: suscripcion.id,
            concepto: 'Pago suscripción',
            monto: pago.transaction_amount,
            fecha: new Date(),
            estado: 'PAID',
            mpPaymentId: String(pago.id),
          },
        });
      }
      return res.json({ status: 'approved' });
    }

    if (pago.status === 'pending' || pago.status === 'in_process') {
      // PSE redirige al banco; Efecty entrega el cupón para pagar en un punto físico
      return res.json({
        status: 'pending',
        redirectUrl: pago.transaction_details?.external_resource_url ?? null,
      });
    }

    const msg = RECHAZO_MSG[pago.status_detail] ?? 'El pago fue rechazado. Intenta con otro medio de pago.';
    return res.status(402).json({ error: msg });
  } catch (err) {
    console.error('[mercadopago/pagar]', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'No se pudo procesar el pago. Intenta de nuevo.' });
  }
});

// ── POST /mercadopago/checkout — pago único ──────────────────────────────────
router.post('/checkout', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const [suscripcion, cantidadDeportistas, club] = await Promise.all([
    suscripcionDelClub(clubId),
    prisma.member.count({ where: { clubId, role: 'STUDENT' } }),
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true, email: true } }),
  ]);

  const monto = calcularPrecioPlan(cantidadDeportistas, suscripcion.tipoPlan as TipoPlan, suscripcion.autoRenew);
  const payerEmail = req.auth?.email || club?.email || 'sin-correo@veloclubtech.com';

  try {
    const pref = await crearPreferenciaCheckout({
      reference: `sub-${suscripcion.id}-${Date.now()}`,
      amount: monto,
      description: `Suscripción VeloClub — ${club?.name ?? 'Club'}`,
      payerEmail,
      backUrl: `${process.env.WEB_ORIGIN}/dashboard/ajustes`,
    });
    res.json({ initPoint: pref.init_point });
  } catch (err) {
    console.error('[mercadopago/checkout]', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'No se pudo iniciar el pago' });
  }
});

// ── POST /mercadopago/subscribe — activar renovación automática ─────────────
router.post('/subscribe', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';
  const { cardTokenId, aceptaTerminos } = req.body as { cardTokenId?: string; aceptaTerminos?: boolean };
  if (!cardTokenId) return res.status(400).json({ error: 'cardTokenId requerido' });
  if (aceptaTerminos !== true) {
    return res.status(400).json({ error: 'Debes autorizar los cobros recurrentes para activar la renovación automática' });
  }

  const [suscripcion, cantidadDeportistas, club] = await Promise.all([
    suscripcionDelClub(clubId),
    prisma.member.count({ where: { clubId, role: 'STUDENT' } }),
    prisma.club.findUnique({ where: { id: clubId }, select: { name: true, email: true } }),
  ]);

  const monto = calcularPrecioPlan(cantidadDeportistas, suscripcion.tipoPlan as TipoPlan, true);
  const payerEmail = req.auth?.email || club?.email || 'sin-correo@veloclubtech.com';
  const meses = suscripcion.tipoPlan === 'MENSUAL' ? 1 : suscripcion.tipoPlan === 'TRIMESTRAL' ? 3 : 12;

  try {
    const preapproval = await crearPreapproval({
      reference: suscripcion.id,
      amount: monto,
      payerEmail,
      cardTokenId,
      frequency: meses,
      frequencyType: 'months',
      backUrl: `${process.env.WEB_ORIGIN}/dashboard/ajustes`,
    });

    await prisma.clubSuscripcion.update({
      where: { id: suscripcion.id },
      data: {
        autoRenew: true,
        mpPreapprovalId: preapproval.id,
        mpPayerEmail: payerEmail,
        ultimoMontoSincronizado: monto,
        intentosFallidos: 0,
        consentimientoRecurrenteAt: new Date(),
      },
    });

    // El Preapproval cobra el primer período de inmediato — intentamos confirmarlo
    // ya mismo (en vez de esperar solo al webhook) para que el front no siga
    // mostrando "Pagar suscripción ahora" mientras el webhook llega.
    try {
      const pago = await buscarPagoPorReferencia(suscripcion.id);
      if (pago && pago.status === 'approved') {
        const yaRegistrado = await prisma.suscripcionPago.findUnique({ where: { mpPaymentId: String(pago.id) } });
        if (!yaRegistrado) {
          await prisma.suscripcionPago.create({
            data: {
              suscripcionId: suscripcion.id,
              concepto: 'Renovación automática',
              monto: pago.transaction_amount,
              fecha: new Date(),
              estado: 'PAID',
              mpPaymentId: String(pago.id),
            },
          });
        }
      }
    } catch (err) {
      console.error('[mercadopago/subscribe] no se pudo confirmar el primer cobro de inmediato', err instanceof Error ? err.message : err);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[mercadopago/subscribe]', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'No se pudo activar la renovación automática' });
  }
});

// ── POST /mercadopago/unsubscribe — desactivar renovación automática ────────
router.post('/unsubscribe', requireAuth, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const clubId = req.user!.clubId ?? '';

  const suscripcion = await prisma.clubSuscripcion.findUnique({ where: { clubId } });
  if (!suscripcion) return res.status(404).json({ error: 'Suscripción no encontrada' });

  if (suscripcion.mpPreapprovalId) {
    try { await cancelarPreapproval(suscripcion.mpPreapprovalId); }
    catch (err) { console.error('[mercadopago/unsubscribe]', err instanceof Error ? err.message : err); }
  }

  await prisma.clubSuscripcion.update({
    where: { id: suscripcion.id },
    data: { autoRenew: false, mpPreapprovalId: null, intentosFallidos: 0 },
  });

  res.json({ ok: true });
});

// ── POST /mercadopago/webhook — notificaciones de pago (publico, verificado) ─
router.post('/webhook', async (req, res) => {
  // Responder rápido siempre — Mercado Pago reintenta si no recibe 2xx
  res.status(200).json({ received: true });

  try {
    const topic = (req.query.type as string) ?? (req.body?.type as string);
    const dataId = (req.query['data.id'] as string) ?? (req.body?.data?.id as string);
    if (!dataId || (topic !== 'payment' && topic !== 'subscription_preapproval')) return;

    const firmaValida = verificarFirmaWebhook({
      xSignature: req.headers['x-signature'] as string | undefined,
      xRequestId: req.headers['x-request-id'] as string | undefined,
      dataId: String(dataId),
    });
    if (!firmaValida) {
      console.error('[mercadopago/webhook] firma invalida, ignorando evento', dataId);
      return;
    }

    // ── Cambios de estado de la suscripcion (cancelada, pausada, etc.) ────────
    if (topic === 'subscription_preapproval') {
      const preapproval = await obtenerPreapproval(String(dataId));
      if (preapproval.status === 'authorized') return; // sigue activa, nada que hacer

      const suscripcion = await prisma.clubSuscripcion.findFirst({ where: { mpPreapprovalId: preapproval.id } });
      if (!suscripcion || !suscripcion.autoRenew) return;

      await prisma.clubSuscripcion.update({
        where: { id: suscripcion.id },
        data: { autoRenew: false, mpPreapprovalId: null },
      });
      await notifyClubStaff(suscripcion.clubId, {
        tipo: 'PAGO_VENCIDO',
        titulo: 'Renovación automática desactivada',
        cuerpo: 'Mercado Pago canceló la renovación automática de tu suscripción. Actívala de nuevo o paga manualmente desde Ajustes.',
        link: '/dashboard/ajustes',
      });
      return;
    }

    const pago = await obtenerPago(String(dataId));
    if (pago.status !== 'approved' || !pago.external_reference) return;

    // external_reference: "sub-{suscripcionId}-{timestamp}" (checkout) o "{suscripcionId}" (preapproval)
    const suscripcionId = pago.external_reference.startsWith('sub-')
      ? pago.external_reference.split('-')[1]
      : pago.external_reference;

    const suscripcion = await prisma.clubSuscripcion.findUnique({ where: { id: suscripcionId } });
    if (!suscripcion) return;

    // Idempotencia: si ya registramos este mpPaymentId, no duplicar
    const yaRegistrado = await prisma.suscripcionPago.findUnique({ where: { mpPaymentId: String(pago.id) } });
    if (yaRegistrado) return;

    await prisma.suscripcionPago.create({
      data: {
        suscripcionId: suscripcion.id,
        concepto: suscripcion.autoRenew ? 'Renovación automática' : 'Pago suscripción',
        monto: pago.transaction_amount,
        fecha: new Date(),
        estado: 'PAID',
        mpPaymentId: String(pago.id),
      },
    });

    await prisma.clubSuscripcion.update({
      where: { id: suscripcion.id },
      data: { intentosFallidos: 0 },
    });

    await notifyClubStaff(suscripcion.clubId, {
      tipo: 'PAGO_REGISTRADO',
      titulo: 'Suscripción pagada',
      cuerpo: `Se registró el pago de tu suscripción a VeloClub por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pago.transaction_amount)}.`,
      link: '/dashboard/ajustes',
    });
  } catch (err) {
    console.error('[mercadopago/webhook]', err instanceof Error ? err.message : err);
  }
});

export default router;
