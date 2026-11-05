import * as Sentry from '@sentry/node';
import { prisma } from '../db/client';

/**
 * Un reembolso queda en los libros como salida, y el pago que lo originó sigue
 * contado como lo que entró.
 *
 * Antes el pago reembolsado pasaba a REFUNDED y nada más: desaparecía de
 * finanzas como si nunca hubiera entrado, y la devolución no aparecía en ningún
 * lado. El 5 de noviembre de 2026 se reembolsaron $306.000 a LANDI y a
 * Correcaminos y el panel no mostraba ni el ingreso ni la salida.
 *
 * Ahora son dos movimientos, cada uno en su mes: el ingreso cuando se cobró y
 * el reembolso cuando se devolvió. La salida va en `GastoPlataforma` con la
 * categoría REEMBOLSOS, así la gráfica, el saldo y «En qué se va» la muestran
 * sin código aparte.
 *
 * Entra por tres lados y tiene que poder correr tres veces sin duplicar nada:
 * la cancelación dentro de la prueba, el aviso de Mercado Pago y el barrido
 * periódico, que también recoge lo que se devuelva a mano desde el panel de
 * Mercado Pago. De eso se encarga `origen`, que es único.
 *
 * Nunca lanza: anotar el reembolso no puede tumbar lo que lo originó.
 */
export async function registrarReembolso(params: {
  mpPaymentId: string;
  monto: number;
  fecha?: Date | null;
}): Promise<boolean> {
  try {
    if (!(params.monto > 0)) return false;

    const pago = await prisma.suscripcionPago.findUnique({
      where: { mpPaymentId: params.mpPaymentId },
      select: { id: true, estado: true, monto: true, suscripcion: { select: { club: { select: { name: true } } } } },
    });
    if (!pago) return false;

    // Un reembolso parcial deja el pago en pie: lo devuelto sale como gasto y
    // el resto sigue cubriendo el período.
    const total = params.monto >= pago.monto - 0.5;
    if (total && pago.estado !== 'REFUNDED') {
      await prisma.suscripcionPago.update({ where: { id: pago.id }, data: { estado: 'REFUNDED' } });
    }

    const club = pago.suscripcion.club?.name;
    await prisma.gastoPlataforma.upsert({
      where:  { origen: `reembolso:${params.mpPaymentId}` },
      update: { monto: params.monto },
      create: {
        origen: `reembolso:${params.mpPaymentId}`,
        fecha: params.fecha ?? new Date(),
        monto: params.monto,
        categoria: 'REEMBOLSOS',
        descripcion: club ? `Reembolso a ${club}` : 'Reembolso',
      },
    });
    return true;
  } catch (err) {
    console.error('[registrar-reembolso]', params.mpPaymentId, err instanceof Error ? err.message : err);
    Sentry.captureException(err, { tags: { tarea: 'registrar-reembolso' }, extra: { mpPaymentId: params.mpPaymentId } });
    return false;
  }
}

/**
 * Barrido: pregunta a Mercado Pago por los pagos recientes y anota los que
 * tengan algo devuelto.
 *
 * Es lo que atrapa un reembolso hecho a mano desde el panel de Mercado Pago, que
 * no pasa por ninguna ruta nuestra. Solo mira los últimos 120 días: un reembolso
 * se hace sobre un cobro reciente, y preguntar por todo el histórico en cada
 * vuelta serían cientos de llamadas para nada.
 *
 * Corre junto a la conciliación de comisiones, cada 20 minutos.
 */
export async function conciliarReembolsos(): Promise<number> {
  const { obtenerPago } = await import('./mercadopago');
  const desde = new Date(Date.now() - 120 * 86_400_000);

  const [pagos, yaAnotados] = await Promise.all([
    prisma.suscripcionPago.findMany({
      where: { estado: { in: ['PAID', 'REFUNDED'] }, mpPaymentId: { not: null }, createdAt: { gte: desde } },
      select: { mpPaymentId: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.gastoPlataforma.findMany({
      where: { origen: { startsWith: 'reembolso:' } },
      select: { origen: true },
    }),
  ]);

  const anotados = new Set(yaAnotados.map(g => g.origen));
  let nuevos = 0;

  for (const p of pagos) {
    const id = String(p.mpPaymentId);
    if (anotados.has(`reembolso:${id}`)) continue;
    try {
      const mp = await obtenerPago(id);
      const devuelto = Number(mp.transaction_amount_refunded ?? 0);
      if (devuelto <= 0) continue;
      const ultimo = (mp.refunds ?? []).map(r => r.date_created).filter(Boolean).sort().pop();
      if (await registrarReembolso({ mpPaymentId: id, monto: devuelto, fecha: ultimo ? new Date(ultimo) : new Date() })) nuevos++;
    } catch (err) {
      console.error('[conciliar-reembolsos]', id, err instanceof Error ? err.message : err);
    }
  }
  return nuevos;
}
