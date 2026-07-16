import crypto from 'crypto';

const MP_API = 'https://api.mercadopago.com';

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado');
  return token;
}

async function mpFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken()}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as any)?.message || (body as any)?.error || `Mercado Pago error ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// ── Checkout Pro — pago único (sin auto-renovación) ─────────────────────────
export async function crearPreferenciaCheckout(params: {
  reference: string;
  amount: number;
  description: string;
  payerEmail: string;
  backUrl: string;
}): Promise<{ id: string; init_point: string }> {
  return mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        title: params.description,
        quantity: 1,
        currency_id: 'COP',
        unit_price: params.amount,
      }],
      payer: { email: params.payerEmail },
      external_reference: params.reference,
      back_urls: {
        success: params.backUrl,
        pending: params.backUrl,
        failure: params.backUrl,
      },
      auto_return: 'approved',
    }),
  });
}

// ── Preapproval — suscripción con cobro automático sin CVV ──────────────────
export async function crearPreapproval(params: {
  reference: string;
  amount: number;
  payerEmail: string;
  cardTokenId: string;
  frequency: number;
  frequencyType: 'months';
  backUrl: string;
}): Promise<{ id: string; status: string }> {
  return mpFetch('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason: 'Suscripción VeloClub',
      external_reference: params.reference,
      payer_email: params.payerEmail,
      card_token_id: params.cardTokenId,
      back_url: params.backUrl,
      status: 'authorized',
      auto_recurring: {
        frequency: params.frequency,
        frequency_type: params.frequencyType,
        transaction_amount: params.amount,
        currency_id: 'COP',
      },
    }),
  });
}

export async function actualizarMontoPreapproval(preapprovalId: string, amount: number): Promise<void> {
  await mpFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ auto_recurring: { transaction_amount: amount } }),
  });
}

export async function cancelarPreapproval(preapprovalId: string): Promise<void> {
  await mpFetch(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

export async function obtenerPreapproval(preapprovalId: string): Promise<{ id: string; status: string }> {
  return mpFetch(`/preapproval/${preapprovalId}`, { method: 'GET' });
}

// ── Consultar un pago (usado tras recibir el webhook) ────────────────────────
export async function obtenerPago(paymentId: string): Promise<{
  id: number; status: string; transaction_amount: number; external_reference: string | null;
}> {
  return mpFetch(`/v1/payments/${paymentId}`, { method: 'GET' });
}

// ── Checkout API (transparente) — medios de pago dentro de la app ───────────

export interface MedioPago {
  id: string;
  name: string;
  payment_type_id: string;
  status: string;
  thumbnail?: string;
  financial_institutions?: Array<{ id: string; description: string }>;
}

export async function listarMediosPago(): Promise<MedioPago[]> {
  return mpFetch<MedioPago[]>('/v1/payment_methods', { method: 'GET' });
}

export interface PagoDirectoResponse {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  external_reference: string | null;
  transaction_details?: { external_resource_url?: string };
}

// POST /v1/payments — pago directo sin redirección (tarjeta, PSE, Efecty).
// X-Idempotency-Key es obligatorio en este endpoint.
export async function crearPagoDirecto(payload: Record<string, unknown>): Promise<PagoDirectoResponse> {
  return mpFetch<PagoDirectoResponse>('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

// ── Buscar el pago más reciente por external_reference — usado para confirmar
// el primer cobro de un Preapproval de forma síncrona, sin esperar al webhook ─
export async function buscarPagoPorReferencia(reference: string): Promise<{
  id: number; status: string; transaction_amount: number;
} | null> {
  const res = await mpFetch<{ results: Array<{ id: number; status: string; transaction_amount: number }> }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc`,
    { method: 'GET' }
  );
  return res.results?.[0] ?? null;
}

// ── Verificación de firma del webhook (x-signature: ts=...,v1=...) ──────────
export function verificarFirmaWebhook(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !params.xSignature) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(',').map(p => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${params.dataId};request-id:${params.xRequestId ?? ''};ts:${ts};`;
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const hashBuf = Buffer.from(hash);
  const v1Buf = Buffer.from(v1);
  if (hashBuf.length !== v1Buf.length) return false;

  return crypto.timingSafeEqual(hashBuf, v1Buf);
}
