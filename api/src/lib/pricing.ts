// Precios de la suscripción de un club a VeloClub, por tramo de deportistas.
// El precio SIEMPRE se calcula a partir de la cantidad real de deportistas en
// el momento del cobro — nunca se guarda "congelado" salvo en planMonto, que
// refleja el último valor calculado (para mostrarlo sin recalcular siempre).

export type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

interface Tramo { max: number; mensual: number }

const TRAMOS: Tramo[] = [
  { max: 40, mensual: 50_000 },
  { max: 80, mensual: 55_000 },
  { max: Infinity, mensual: 60_000 },
];

const MESES_POR_PLAN: Record<TipoPlan, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
const DESCUENTO_POR_PLAN: Record<TipoPlan, number> = { MENSUAL: 0, TRIMESTRAL: 0.10, ANUAL: 0.20 };

// ── La campaña de lanzamiento ───────────────────────────────────────────────
//
// El **primer** trimestre vale lo mismo para todos los clubes que se registren
// mientras dura: 180.000, sin tramos y sin el descuento del plan. Es la
// promoción que acompaña a los dos meses gratis, y por eso comparte su fecha de
// corte.
//
// Manda la fecha en que el club se registró, no la del cobro. Un club que entra
// el 30 de octubre recibe sus dos meses gratis y paga a fines de diciembre, ya
// fuera de campaña: si mandara la fecha del cobro, le cobraríamos un precio
// distinto del que se le ofreció al entrar.
//
// Y solo el primero: de la renovación en adelante manda la tarifa normal con
// sus descuentos. Sin ese límite, un club chico con renovación automática
// quedaría pagando 180.000 cada trimestre de por vida cuando le corresponden
// 127.500 — cobrándole de más, solo, y sin que nadie lo mire.
//
// Sin esto la plataforma cobraba su tarifa por tramos —entre 127.500 y
// 162.000— y la diferencia hasta los 180.000 habia que perseguirla por fuera,
// club por club. Con doce clubes saliendo de prueba eran 418.500 a cobrar a
// mano.
//
// El mensual y el anual no entran: siguen con su tarifa de siempre.
export const CAMPANA_FIN = new Date('2026-11-01T00:00:00-05:00');
export const TRIMESTRE_CAMPANA = 180_000;

/** ¿Esta fecha cae dentro de la campaña? */
export function enCampana(referencia = new Date()): boolean {
  return referencia < CAMPANA_FIN;
}

// Descuento adicional por activar la renovación automática — se suma (no
// reemplaza) al descuento propio del plan.
export const DESCUENTO_AUTO_RENOVACION = 0.05;

export function tarifaMensualPorDeportistas(cantidadDeportistas: number): number {
  const tramo = TRAMOS.find(t => cantidadDeportistas <= t.max) ?? TRAMOS[TRAMOS.length - 1];
  return tramo.mensual;
}

/**
 * Precio total del período (no el "por mes"), ya con los descuentos aplicados.
 *
 * El precio de campaña se resuelve acá adentro y no en cada sitio que cobra:
 * la función se llama desde once lugares —el checkout, la renovación, el
 * preapproval, la sincronización— y dejar la regla afuera garantizaba que
 * alguno se quedara con la tarifa vieja.
 */
export function calcularPrecioPlan(
  cantidadDeportistas: number,
  tipoPlan: TipoPlan,
  autoRenew = false,
  club: {
    /**
     * Cuándo se registró. Sin esto se asume que es ahora, que es lo correcto
     * para un club nuevo y lo único que se puede suponer cuando quien llama no
     * tiene el dato a mano.
     */
    creadoEn?: Date | null;
    /** Si ya pagó alguna vez. El precio de campaña es solo del primer cobro. */
    yaPago?: boolean;
  } = {},
): number {
  const creadoEn = club.creadoEn ?? new Date();
  // Plano: ni tramos ni descuentos, tampoco el de renovación automática.
  if (tipoPlan === 'TRIMESTRAL' && enCampana(creadoEn) && !club.yaPago) return TRIMESTRE_CAMPANA;

  const base = tarifaMensualPorDeportistas(cantidadDeportistas) * MESES_POR_PLAN[tipoPlan];
  const descuento = DESCUENTO_POR_PLAN[tipoPlan] + (autoRenew ? DESCUENTO_AUTO_RENOVACION : 0);
  return Math.round(base * (1 - descuento));
}

export function mesesDelPlan(tipoPlan: TipoPlan): number {
  return MESES_POR_PLAN[tipoPlan];
}

const PLAN_DAYS: Record<TipoPlan, number> = { MENSUAL: 30, TRIMESTRAL: 90, ANUAL: 365 };

// Espejo del cálculo de vigencia que ya existe en el frontend (club-detail.tsx)
// — mismo criterio: 100% el día que se paga, baja hasta 0% al vencer el período.
export function vigencia(pagos: { estado: string; fecha: Date | null }[], tipoPlan: TipoPlan) {
  const dur = PLAN_DAYS[tipoPlan] ?? 30;
  const pagados = pagos.filter(p => p.estado === 'PAID' && p.fecha);
  if (pagados.length === 0) return null;
  const ultimo = pagados.reduce((a, b) => (a.fecha! > b.fecha! ? a : b));
  const diasPasados = Math.floor((Date.now() - ultimo.fecha!.getTime()) / 86_400_000);
  const diasRestantes = Math.max(0, dur - diasPasados);
  const pct = Math.max(0, Math.min(100, Math.round((diasRestantes / dur) * 100)));
  return { pct, diasRestantes, vencido: diasRestantes <= 0 };
}
