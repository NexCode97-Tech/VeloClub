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

// Descuento adicional por activar la renovación automática — se suma (no
// reemplaza) al descuento propio del plan.
export const DESCUENTO_AUTO_RENOVACION = 0.05;

export function tarifaMensualPorDeportistas(cantidadDeportistas: number): number {
  const tramo = TRAMOS.find(t => cantidadDeportistas <= t.max) ?? TRAMOS[TRAMOS.length - 1];
  return tramo.mensual;
}

/** Precio total del período (no el "por mes"), ya con los descuentos aplicados. */
export function calcularPrecioPlan(cantidadDeportistas: number, tipoPlan: TipoPlan, autoRenew = false): number {
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
