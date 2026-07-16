import * as Sentry from '@sentry/node';
import { prisma } from '../db/client';
import { calcularPrecioPlan, vigencia, type TipoPlan } from './pricing';
import { actualizarMontoPreapproval } from './mercadopago';
import { notifyClubStaff } from './notify';

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
      Sentry.captureException(err, { tags: { route: 'sync-suscripciones-monto' }, extra: { clubId: s.clubId, preapprovalId: s.mpPreapprovalId } });
      fallidas.push(s.clubId);
    }
  }

  console.log(`[sync-suscripciones-monto] ${actualizadas} suscripciones actualizadas de ${suscripciones.length} revisadas`);
  return { revisadas: suscripciones.length, actualizadas, fallidas };
}

const DIAS_AVISO = 3;

// Dunning proactivo: clubes SIN renovación automática cuyo plan vence en pocos
// días — un solo aviso por vencimiento (guardado en ultimoIntentoFallidoAt para
// no repetirlo cada día hasta el próximo ciclo de pago).
export async function recordarVencimientosProximos(): Promise<{ avisados: number }> {
  const suscripciones = await prisma.clubSuscripcion.findMany({
    where: { autoRenew: false },
    include: { pagos: true },
  });

  let avisados = 0;
  for (const s of suscripciones) {
    try {
      const vig = vigencia(s.pagos, s.tipoPlan as TipoPlan);
      if (!vig || vig.vencido || vig.diasRestantes > DIAS_AVISO) continue;

      // Ya avisado para este ciclo si el último aviso fue después del último pago
      const ultimoPago = s.pagos.filter(p => p.estado === 'PAID' && p.fecha)
        .reduce((a, b) => (!a || (b.fecha! > a.fecha!) ? b : a), null as { fecha: Date | null } | null);
      if (s.ultimoIntentoFallidoAt && ultimoPago?.fecha && s.ultimoIntentoFallidoAt > ultimoPago.fecha) continue;

      await prisma.clubSuscripcion.update({ where: { id: s.id }, data: { ultimoIntentoFallidoAt: new Date() } });
      await notifyClubStaff(s.clubId, {
        tipo: 'PAGO_PROXIMO_VENCER',
        titulo: vig.diasRestantes === 0 ? 'Tu plan vence hoy' : `Tu plan vence en ${vig.diasRestantes} día${vig.diasRestantes !== 1 ? 's' : ''}`,
        cuerpo: 'Paga ahora o activa la renovación automática desde Ajustes para no perder acceso a VeloClub.',
        link: '/dashboard/ajustes?tab=suscripcion',
      });
      avisados++;
    } catch (err) {
      console.error(`[recordar-vencimientos] club ${s.clubId}:`, err instanceof Error ? err.message : err);
      Sentry.captureException(err, { tags: { route: 'recordar-vencimientos' }, extra: { clubId: s.clubId } });
    }
  }

  console.log(`[recordar-vencimientos] ${avisados} clubes avisados`);
  return { avisados };
}
