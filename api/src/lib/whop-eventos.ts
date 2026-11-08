// Lo que hace VeloClub con cada aviso de Whop sobre un pago.
//
// Todo pago nuestro sale con `metadata.suscripcionId` y `metadata.tipo`
// (`pago` cuando lo hace el club desde Mi suscripción, `renovacion` cuando lo
// dispara VeloClub). Lo que llegue sin `suscripcionId` no es de la plataforma
// y se ignora.
//
// Whop entrega cada aviso al menos una vez, y el pago además puede quedar
// registrado desde la respuesta directa de la ruta de cobro. Por eso todo va
// por `whopPaymentId`, que es único: correr dos veces no duplica nada.
import * as Sentry from '@sentry/node';
import { prisma } from '../db/client';
import { inicioDelPeriodo, type TipoPlan } from './pricing';
import { activarClubTrasPago } from './sync-suscripciones';
import { notifyClubStaff } from './notify';
import { registrarReembolso } from './reembolsos';
import { registrarEvento } from './auditoria';
import { registrarComisionWhop } from './finanzas-plataforma';
import { comisionEnPesos, obtenerPagoWhop, type PagoWhop } from './whop';

const DIAS_PLAN: Record<TipoPlan, number> = { MENSUAL: 30, TRIMESTRAL: 90, ANUAL: 365 };
export const MAX_INTENTOS = 3;
const DIAS_ENTRE_INTENTOS = 3;
const DIA = 86_400_000;
const AJUSTES = '/ajustes?tab=suscripcion';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export function finDeCobertura(inicio: Date, tipoPlan: TipoPlan): Date {
  return new Date(inicio.getTime() + DIAS_PLAN[tipoPlan] * DIA);
}

/** Después de un cobro de renovación que no pasó: cuándo se reintenta, o si se apaga. */
export function siguienteIntento(intentosPrevios: number, ahora = new Date()) {
  const intentos = intentosPrevios + 1;
  if (intentos >= MAX_INTENTOS) return { intentos, apagar: true, proximo: null };
  return { intentos, apagar: false, proximo: new Date(ahora.getTime() + DIAS_ENTRE_INTENTOS * DIA) };
}

export function esNuestro(p: { metadata: Record<string, string> | null }): boolean {
  return !!p.metadata?.suscripcionId;
}

/**
 * Un pago que entró. Lo registra, activa el club y, si el club tiene la
 * renovación prendida, guarda el medio y agenda el próximo cobro al final de
 * la cobertura nueva.
 */
export async function pagoExitoso(p: PagoWhop): Promise<void> {
  if (!esNuestro(p)) return;

  const suscripcion = await prisma.clubSuscripcion.findUnique({
    where: { id: p.metadata!.suscripcionId },
    include: {
      pagos: { select: { estado: true, fecha: true } },
      club: { select: { name: true, trialEndsAt: true } },
    },
  });
  if (!suscripcion) return;

  const ya = await prisma.suscripcionPago.findUnique({ where: { whopPaymentId: p.id } });
  if (ya?.estado === 'PAID') return;

  const tipoPlan = suscripcion.tipoPlan as TipoPlan;
  // La fecha se calcula antes de activar el club: activarlo borra trialEndsAt,
  // y el período pagado tiene que empezar cuando termina la prueba.
  const inicio = inicioDelPeriodo(suscripcion.pagos, tipoPlan, suscripcion.club.trialEndsAt);
  const monto = Number(p.presentment_total ?? 0);
  const esRenovacion = p.metadata!.tipo === 'renovacion';

  await prisma.suscripcionPago.upsert({
    where: { whopPaymentId: p.id },
    update: { estado: 'PAID', monto },
    create: {
      suscripcionId: suscripcion.id,
      concepto: esRenovacion ? 'Renovación automática' : 'Pago suscripción',
      monto,
      fecha: inicio,
      estado: 'PAID',
      whopPaymentId: p.id,
      medio: p.payment_method_type,
    },
  });

  const guardaMedio = suscripcion.autoRenew && !!p.payment_method_id && !!p.member_id;
  await prisma.clubSuscripcion.update({
    where: { id: suscripcion.id },
    data: {
      intentosFallidos: 0,
      ultimoIntentoFallidoAt: null,
      ...(guardaMedio ? { whopMemberId: p.member_id, whopPaymentMethodId: p.payment_method_id } : {}),
      proximoCobroAt: suscripcion.autoRenew ? finDeCobertura(inicio, tipoPlan) : null,
    },
  });

  await activarClubTrasPago(suscripcion.clubId);
  await registrarComisionWhop({
    whopPaymentId: p.id,
    monto: comisionEnPesos(p),
    fecha: p.paid_at ? new Date(p.paid_at) : new Date(),
    club: suscripcion.club.name,
  });
  await notifyClubStaff(suscripcion.clubId, {
    tipo: 'PAGO_REGISTRADO',
    titulo: esRenovacion ? 'Renovamos tu suscripción' : 'Suscripción pagada',
    cuerpo: 'Se registró el pago de tu suscripción a VeloClub por ' + pesos(monto) + '.',
    link: AJUSTES,
  });
}

/** Un cobro de renovación que no pasó: se reintenta en tres días, y al tercero se apaga. */
export async function pagoFallido(p: PagoWhop): Promise<void> {
  if (!esNuestro(p) || p.metadata!.tipo !== 'renovacion') return;
  const s = await prisma.clubSuscripcion.findUnique({ where: { id: p.metadata!.suscripcionId } });
  if (!s || !s.autoRenew) return;

  const r = siguienteIntento(s.intentosFallidos);
  await prisma.clubSuscripcion.update({
    where: { id: s.id },
    data: r.apagar
      ? { autoRenew: false, intentosFallidos: 0, proximoCobroAt: null, whopPaymentMethodId: null }
      : { intentosFallidos: r.intentos, ultimoIntentoFallidoAt: new Date(), proximoCobroAt: r.proximo },
  });

  await notifyClubStaff(s.clubId, r.apagar
    ? {
        tipo: 'PAGO_VENCIDO',
        titulo: 'Renovación automática desactivada',
        cuerpo: 'No pudimos cobrar tu renovación después de ' + MAX_INTENTOS + ' intentos. Paga desde Ajustes para no perder el acceso.',
        link: AJUSTES,
      }
    : {
        tipo: 'PAGO_VENCIDO',
        titulo: 'No pudimos cobrar tu renovación',
        cuerpo: 'Lo volvemos a intentar en ' + DIAS_ENTRE_INTENTOS + ' días (intento ' + r.intentos + ' de ' + MAX_INTENTOS
          + '). Revisa que tu tarjeta tenga fondos.',
        link: AJUSTES,
      });
}

/** El banco pidió confirmar un cobro de renovación: se le manda al club el enlace de Whop. */
export async function pagoPideAccion(p: PagoWhop): Promise<void> {
  if (!esNuestro(p) || !p.recovery_url) return;
  const s = await prisma.clubSuscripcion.findUnique({ where: { id: p.metadata!.suscripcionId } });
  if (!s) return;
  await notifyClubStaff(s.clubId, {
    tipo: 'PAGO_VENCIDO',
    titulo: 'Tu banco pide confirmar la renovación',
    cuerpo: 'Abre este aviso y confirma el pago con tu banco para mantener tu plan.',
    link: p.recovery_url,
  });
}

/**
 * Un reembolso o una disputa sobre un pago nuestro. Whop manda los montos del
 * reembolso en dólares, así que se pregunta por el pago y se toma lo devuelto
 * en pesos. Una disputa cuenta como devolución del pago completo.
 */
export async function reembolsoODisputa(whopPaymentId: string, disputa = false): Promise<void> {
  const pago = await obtenerPagoWhop(whopPaymentId);
  if (!esNuestro(pago)) return;
  const monto = disputa
    ? Number(pago.presentment_total ?? 0)
    : Number(pago.presentment_refunded_amount ?? 0);
  if (monto <= 0) return;

  await registrarReembolso({
    whopPaymentId,
    monto,
    fecha: pago.refunded_at ? new Date(pago.refunded_at) : new Date(),
  });

  if (disputa) {
    await registrarEvento({
      accion: 'PAGO_DISPUTADO',
      entidad: 'SuscripcionPago',
      entidadId: whopPaymentId,
      resumen: 'Se abrió una disputa por ' + pesos(monto) + ' en Whop.',
      clubId: pago.metadata?.clubId ?? null,
      datos: { whopPaymentId, monto },
    }).catch(err => Sentry.captureException(err));
  }
}
