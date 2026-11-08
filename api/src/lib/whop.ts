// Cliente mínimo de la API de Whop, la pasarela con que los clubes pagan su
// suscripción a VeloClub.
//
// Va con fetch y no con el SDK para tener a la vista cada campo que se manda.
// El precio lo pone siempre nuestro servidor: cada cobro lleva su plan en
// línea (`variant`) con el monto exacto en pesos, así que en Whop no hay
// precios guardados que se puedan quedar viejos cuando un club cambia de tramo.
//
// Whop liquida en dólares. Los montos de un pago vienen en dos monedas:
// `presentment_*` en pesos (lo que vio y pagó el club) y el resto en dólares.
// En la base de VeloClub siempre se guarda lo de pesos.

const VERSION = '2026-11-03';

function base(): string {
  return process.env.WHOP_ENV === 'production'
    ? 'https://api.whop.com/api/v1'
    : 'https://sandbox-api.whop.com/api/v1';
}

function clave(): string {
  const k = process.env.WHOP_ENV === 'production' ? process.env.WHOP_API_KEY : process.env.WHOP_API_KEY_SANDBOX;
  if (!k) throw new Error(`Falta la clave de Whop para el entorno ${process.env.WHOP_ENV ?? 'sandbox'}`);
  return k;
}

export class ErrorWhop extends Error {
  constructor(public status: number, public cuerpo: string) {
    super(`Whop respondió ${status}: ${cuerpo.slice(0, 300)}`);
  }
}

async function llamar<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown, idempotencia?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${clave()}`,
    Accept: 'application/json',
    'Api-Version-Date': VERSION,
  };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencia) headers['Idempotency-Key'] = idempotencia;
  const r = await fetch(base() + ruta, {
    method: metodo,
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await r.text();
  if (!r.ok) throw new ErrorWhop(r.status, texto);
  return JSON.parse(texto) as T;
}

export interface PagoWhop {
  id: string;
  /** open | paid | pending | void | uncollectible | failed */
  status: string;
  presentment_total: number | null;
  presentment_refunded_amount: number | null;
  total: number | null;
  amount_after_fees: number | null;
  member_id: string | null;
  payment_method_id: string | null;
  payment_method_type: string | null;
  metadata: Record<string, string> | null;
  paid_at: string | null;
  refunded_at: string | null;
  failure_message?: string | null;
  client_secret?: string | null;
  recovery_url?: string | null;
}

export function varianteDe(monto: number, titulo: string) {
  return {
    product_id: process.env.WHOP_PRODUCT_ID,
    billing_type: 'one_time',
    currency: 'cop',
    initial_price: monto,
    title: titulo.slice(0, 30),
    visibility: 'hidden',
  };
}

/** El pago que hace el club desde Mi suscripción, con el token que armó el navegador. */
export function cobrarConToken(p: {
  confirmationToken: string;
  monto: number;
  titulo: string;
  email: string;
  /** Con renovación automática se guarda el medio para cobrarle los próximos períodos. */
  guardar: boolean;
  metadata: Record<string, string>;
  returnUrl: string;
  idempotencia: string;
}): Promise<PagoWhop> {
  return llamar<PagoWhop>('POST', '/payments', {
    account_id: process.env.WHOP_ACCOUNT_ID,
    confirmation_token: p.confirmationToken,
    email: p.email,
    variant: varianteDe(p.monto, p.titulo),
    metadata: p.metadata,
    return_url: p.returnUrl,
    ...(p.guardar ? { setup_future_usage: 'off_session' } : {}),
  }, p.idempotencia);
}

/** La renovación automática: VeloClub le cobra al medio guardado, sin el club presente. */
export function cobrarRenovacion(p: {
  memberId: string;
  paymentMethodId: string;
  monto: number;
  titulo: string;
  metadata: Record<string, string>;
  idempotencia: string;
}): Promise<PagoWhop> {
  return llamar<PagoWhop>('POST', '/payments', {
    account_id: process.env.WHOP_ACCOUNT_ID,
    member_id: p.memberId,
    payment_method_id: p.paymentMethodId,
    off_session: true,
    variant: varianteDe(p.monto, p.titulo),
    metadata: p.metadata,
  }, p.idempotencia);
}

export function obtenerPagoWhop(id: string): Promise<PagoWhop> {
  return llamar<PagoWhop>('GET', `/payments/${encodeURIComponent(id)}`);
}

export function reembolsarPagoWhop(id: string, idempotencia: string): Promise<unknown> {
  return llamar('POST', `/payments/${encodeURIComponent(id)}/refund`, {}, idempotencia);
}

/** Comprobante oficial de Whop en PDF. Devuelve la respuesta tal cual. */
export function comprobanteWhop(id: string): Promise<{ url?: string | null }> {
  return llamar('POST', `/payments/${encodeURIComponent(id)}/generate_pdf`, {});
}

/**
 * La comisión de Whop en pesos. Whop la cobra en dólares; se aplica la misma
 * proporción sobre lo que pagó el club en pesos.
 */
export function comisionEnPesos(p: { presentment_total: number | null; total: number | null; amount_after_fees: number | null }): number {
  if (!p.presentment_total || !p.total || p.amount_after_fees == null) return 0;
  const proporcion = 1 - p.amount_after_fees / p.total;
  return Math.round(p.presentment_total * proporcion);
}
