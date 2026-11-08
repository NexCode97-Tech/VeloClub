// Avisos de Whop sobre los pagos de la suscripción.
//
// Va montado ANTES de express.json en index.ts: la firma se calcula sobre los
// bytes exactos que mandó Whop, y un cuerpo ya parseado y vuelto a serializar
// no la pasa. Es público (Whop no trae sesión de Clerk), así que lo único que
// lo protege es la firma: sin firma válida no se toca nada.
import express, { Router } from 'express';
import * as Sentry from '@sentry/node';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { pagoExitoso, pagoFallido, pagoPideAccion, reembolsoODisputa } from '../lib/whop-eventos';
import type { PagoWhop } from '../lib/whop';

const router = Router();

interface EventoWhop {
  type: string;
  data: Record<string, unknown>;
}

function cabeceras(req: express.Request): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') salida[k] = v;
    else if (Array.isArray(v)) salida[k] = v.join(',');
  }
  return salida;
}

router.post('/', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  let evento: EventoWhop;
  try {
    const cuerpo = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    evento = unwrapWebhook<EventoWhop>(cuerpo, { headers: cabeceras(req), key: process.env.WHOP_WEBHOOK_SECRET });
  } catch (err) {
    console.warn('[whop/webhook] firma inválida', err instanceof Error ? err.message : err);
    Sentry.captureMessage('Webhook de Whop con firma inválida', { level: 'warning', tags: { route: 'whop/webhook' } });
    return res.status(400).json({ error: 'Firma inválida' });
  }

  // Whop espera respuesta en menos de 5 segundos: se contesta ya y se procesa
  // después. Si algo falla, Whop no reintenta, pero el pago queda en su panel y
  // la ruta de estado lo recoge cuando el club vuelve a la pantalla.
  res.status(200).json({ recibido: true });

  try {
    const d = evento.data;
    switch (evento.type) {
      case 'payment.succeeded':
        await pagoExitoso(d as unknown as PagoWhop);
        break;
      case 'payment.failed':
        await pagoFallido(d as unknown as PagoWhop);
        break;
      case 'payment.requires_action':
        await pagoPideAccion(d as unknown as PagoWhop);
        break;
      case 'refund.created':
      case 'refund.updated':
        if (d.status === 'succeeded' && typeof d.payment_id === 'string') await reembolsoODisputa(d.payment_id);
        break;
      case 'dispute.created': {
        // La disputa trae el pago completo en `payment`, no su id suelto.
        const pago = d.payment as { id?: unknown } | undefined;
        const id = typeof d.payment_id === 'string' ? d.payment_id : typeof pago?.id === 'string' ? pago.id : null;
        if (id) await reembolsoODisputa(id, true);
        break;
      }
    }
  } catch (err) {
    console.error('[whop/webhook]', evento.type, err instanceof Error ? err.message : err);
    Sentry.captureException(err, { tags: { route: 'whop/webhook', evento: evento.type } });
  }
});

export default router;
