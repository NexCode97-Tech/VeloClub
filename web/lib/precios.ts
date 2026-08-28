// Espejo de api/src/lib/pricing.ts, para que la página de precios muestre
// exactamente lo que el backend va a cobrar.
//
// La fuente de verdad sigue siendo el backend: acá no se decide nada, solo se
// repite el cálculo para poder pintarlo sin pedirle nada al servidor. Si allá
// cambian las tarifas o los descuentos, hay que cambiarlas también acá.

export type TipoPlan = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

/** Los tramos, con la etiqueta que ve el cliente. */
export const TRAMOS = [
  { max: 40, mensual: 50_000, etiqueta: 'Hasta 40' },
  { max: 80, mensual: 55_000, etiqueta: '41 a 80' },
  { max: Infinity, mensual: 60_000, etiqueta: '81 o más' },
] as const;

const MESES: Record<TipoPlan, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
const DESCUENTO: Record<TipoPlan, number> = { MENSUAL: 0, TRIMESTRAL: 0.1, ANUAL: 0.2 };

/** Precio total del período, no el «por mes», ya con el descuento del plan. */
export function precioPlan(indiceTramo: number, plan: TipoPlan): number {
  const tramo = TRAMOS[indiceTramo] ?? TRAMOS[0];
  return Math.round(tramo.mensual * MESES[plan] * (1 - DESCUENTO[plan]));
}

export function mesesDelPlan(plan: TipoPlan): number {
  return MESES[plan];
}

const PESOS = new Intl.NumberFormat('es-CO');

export function enPesos(monto: number): string {
  return '$' + PESOS.format(monto);
}
