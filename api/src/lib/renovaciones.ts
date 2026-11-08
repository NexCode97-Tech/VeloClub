// La renovación automática con Whop la dispara VeloClub.
//
// Whop solo guarda la tarjeta (o la billetera) que el club dejó al pagar. La
// fecha y el monto los ponemos nosotros: se cobra cuando termina lo cubierto,
// con el precio del tramo de deportistas de ese día. Con Mercado Pago pasaba al
// revés y cobró antes de tiempo (LANDI y Correcaminos, 5 nov 2026).
//
// El resultado del cobro llega por el aviso de Whop (payment.succeeded o
// payment.failed), que es donde se registra el pago o se agenda el reintento.
import * as Sentry from '@sentry/node';
import { prisma } from '../db/client';
import { calcularPrecioPlan, type TipoPlan } from './pricing';
import { contarDeportistasFacturables } from './deportistas';
import { cobrarRenovacion } from './whop';
import { pagoFallido } from './whop-eventos';

const TITULO_PLAN: Record<TipoPlan, string> = {
  MENSUAL: 'Plan Mensual',
  TRIMESTRAL: 'Plan Trimestral',
  ANUAL: 'Plan Anual',
};

// Mientras llega el aviso de Whop, la fecha se corre esta ventana para que el
// siguiente turno del temporizador no lo vuelva a intentar.
const ESPERA_AVISO_MS = 6 * 60 * 60 * 1000;

interface Candidata {
  autoRenew: boolean;
  canceladaAt: Date | null;
  whopMemberId: string | null;
  whopPaymentMethodId: string | null;
  proximoCobroAt: Date | null;
}

export function tocaCobrar(s: Candidata, ahora = new Date()): boolean {
  return s.autoRenew && !s.canceladaAt && !!s.whopMemberId && !!s.whopPaymentMethodId
    && !!s.proximoCobroAt && s.proximoCobroAt <= ahora;
}

/**
 * La llave del cobro de un período. Whop devuelve el mismo pago si se repite
 * la llave, así que un reintento del temporizador nunca cobra dos veces. Se
 * arma con el día agendado y el número de intento: un reintento por fallo es
 * un cobro distinto y necesita su propia llave.
 */
export function llaveRenovacion(suscripcionId: string, proximoCobroAt: Date, intento: number): string {
  return 'renov-' + suscripcionId + '-' + proximoCobroAt.toISOString().slice(0, 10) + '-' + intento;
}

export async function cobrarRenovacionesVencidas(ahora = new Date()): Promise<{ cobradas: number; fallidas: number }> {
  if (process.env.PAGOS_PROVEEDOR !== 'whop') return { cobradas: 0, fallidas: 0 };

  const candidatas = await prisma.clubSuscripcion.findMany({
    where: {
      autoRenew: true,
      canceladaAt: null,
      proximoCobroAt: { lte: ahora },
      whopPaymentMethodId: { not: null },
      whopMemberId: { not: null },
    },
  });

  let cobradas = 0;
  let fallidas = 0;
  for (const s of candidatas) {
    if (!tocaCobrar(s, ahora)) continue;
    const tipoPlan = s.tipoPlan as TipoPlan;
    try {
      const monto = calcularPrecioPlan(await contarDeportistasFacturables(s.clubId), tipoPlan, true);
      const llave = llaveRenovacion(s.id, s.proximoCobroAt!, s.intentosFallidos);
      await prisma.clubSuscripcion.update({
        where: { id: s.id },
        data: { proximoCobroAt: new Date(ahora.getTime() + ESPERA_AVISO_MS) },
      });
      const pago = await cobrarRenovacion({
        memberId: s.whopMemberId!,
        paymentMethodId: s.whopPaymentMethodId!,
        monto,
        titulo: TITULO_PLAN[tipoPlan],
        metadata: { suscripcionId: s.id, clubId: s.clubId, tipo: 'renovacion', tipoPlan },
        idempotencia: llave,
      });
      if (pago.status === 'failed' || pago.status === 'void' || pago.status === 'uncollectible') {
        await pagoFallido(pago);
        fallidas++;
      } else {
        cobradas++;
      }
    } catch (err) {
      fallidas++;
      console.error('[renovaciones] club', s.clubId, err instanceof Error ? err.message : err);
      Sentry.captureException(err, { tags: { tarea: 'renovaciones' }, extra: { clubId: s.clubId } });
    }
  }

  if (candidatas.length > 0) console.log('[renovaciones] ' + cobradas + ' cobradas, ' + fallidas + ' fallidas de ' + candidatas.length);
  return { cobradas, fallidas };
}
