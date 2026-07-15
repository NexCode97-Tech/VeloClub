import { prisma } from '../db/client';
import { calcularPrecioPlan, type TipoPlan } from './pricing';
import { actualizarMontoPreapproval } from './mercadopago';

// Revisa las suscripciones con renovación automática activa y, si el club
// cambió de tramo de deportistas, actualiza el monto en Mercado Pago antes de
// que se dispare el próximo cobro automático (que MP gestiona por su cuenta).
// Se usa tanto desde el endpoint HTTP /cron/sync-suscripciones-monto como
// desde el temporizador interno en index.ts.
export async function sincronizarMontosSuscripciones(): Promise<{ revisadas: number; actualizadas: number; fallidas: string[] }> {
  const suscripciones = await prisma.clubSuscripcion.findMany({
    where: { autoRenew: true, mpPreapprovalId: { not: null } },
  });

  let actualizadas = 0;
  const fallidas: string[] = [];

  for (const s of suscripciones) {
    try {
      const cantidadDeportistas = await prisma.member.count({
        where: { clubId: s.clubId, role: 'STUDENT' },
      });
      const montoActual = calcularPrecioPlan(cantidadDeportistas, s.tipoPlan as TipoPlan, true);

      if (montoActual !== s.ultimoMontoSincronizado) {
        await actualizarMontoPreapproval(s.mpPreapprovalId!, montoActual);
        await prisma.clubSuscripcion.update({
          where: { id: s.id },
          data: { ultimoMontoSincronizado: montoActual },
        });
        actualizadas++;
      }
    } catch (err) {
      console.error(`[sync-suscripciones-monto] club ${s.clubId}:`, err instanceof Error ? err.message : err);
      fallidas.push(s.clubId);
    }
  }

  console.log(`[sync-suscripciones-monto] ${actualizadas} suscripciones actualizadas de ${suscripciones.length} revisadas`);
  return { revisadas: suscripciones.length, actualizadas, fallidas };
}
