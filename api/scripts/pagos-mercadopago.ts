/**
 * Qué le pasó a los pagos de un club en Mercado Pago.
 *
 * Desde que /pagar registra los rechazos en la bitácora, esto es la segunda
 * opinión: sirve cuando hay que ver el detalle crudo que Mercado Pago guarda y
 * nosotros no (banco, tarjeta, url de redirección, si el pago llegó a crearse).
 *
 * No usa Prisma a propósito, para poder correr con `railway run` — que inyecta
 * MP_ACCESS_TOKEN pero también la DATABASE_URL interna, inalcanzable de local.
 *
 *   railway run --service VeloClub -- npx tsx scripts/pagos-mercadopago.ts bont
 *   railway run --service VeloClub -- npx tsx scripts/pagos-mercadopago.ts --id 173607198221
 */
const TOKEN = process.env.MP_ACCESS_TOKEN!;

interface PagoMp {
  id: number; status: string; status_detail: string; date_created: string;
  transaction_amount: number; currency_id: string; installments: number;
  payment_method_id: string; payment_type_id: string;
  external_reference: string | null; description?: string; live_mode?: boolean;
  payer?: { email?: string };
  card?: { last_four_digits?: string; expiration_month?: number; expiration_year?: number };
  transaction_details?: { financial_institution?: string; external_resource_url?: string };
}

async function mp<T>(path: string): Promise<T> {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const b = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(b));
  return b as T;
}

/** El código de banco de PSE no dice nada sin su nombre. */
async function nombreDeBanco(id: string | undefined): Promise<string> {
  if (!id) return '';
  try {
    const metodos = await mp<Array<{ id: string; financial_institutions?: Array<{ id: string; description: string }> }>>('/v1/payment_methods');
    const banco = metodos.find(m => m.id === 'pse')?.financial_institutions?.find(b => b.id === id);
    return banco ? ` (${banco.description})` : '';
  } catch { return ''; }
}

async function unPago(id: string) {
  const p = await mp<PagoMp>(`/v1/payments/${id}`);
  const banco = await nombreDeBanco(p.transaction_details?.financial_institution);
  console.log(`\n${p.date_created?.slice(0, 19)} | ${p.status} | ${p.status_detail}`);
  console.log(`  $${p.transaction_amount} ${p.currency_id} · ${p.payment_method_id}/${p.payment_type_id} · cuotas ${p.installments}`);
  console.log(`  ${p.description ?? ''}`);
  console.log(`  ref=${p.external_reference} · produccion=${p.live_mode}`);
  if (p.transaction_details?.financial_institution) console.log(`  banco: ${p.transaction_details.financial_institution}${banco}`);
  if (p.card?.last_four_digits) console.log(`  tarjeta ****${p.card.last_four_digits} venc ${p.card.expiration_month}/${p.card.expiration_year}`);
  if (p.transaction_details?.external_resource_url) console.log(`  url: ${p.transaction_details.external_resource_url}`);
}

async function main() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--id');
  if (idx >= 0) { await unPago(args[idx + 1]); return; }

  const filtro = (args[0] ?? '').toLowerCase();
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const res = await mp<{ results?: PagoMp[] }>(
    `/v1/payments/search?sort=date_created&criteria=desc&range=date_created`
    + `&begin_date=${encodeURIComponent(desde)}&end_date=NOW&limit=100`
  );
  const todos = res.results ?? [];
  const mios = filtro
    ? todos.filter(p =>
        (p.payer?.email ?? '').toLowerCase().includes(filtro) ||
        (p.description ?? '').toLowerCase().includes(filtro) ||
        (p.external_reference ?? '').toLowerCase().includes(filtro))
    : todos;

  console.log(`\nÚltimos 30 días: ${todos.length} pagos, ${mios.length} coinciden con «${filtro}»\n`);
  for (const p of mios) {
    console.log(`${p.date_created?.slice(0, 19)} | ${String(p.status).padEnd(9)} | ${p.status_detail}`);
    console.log(`   $${p.transaction_amount} · ${p.payment_method_id}/${p.payment_type_id} · id=${p.id}`);
    console.log(`   ${p.description ?? ''}`);
    console.log();
  }
  if (mios.length > 0) console.log('Para el detalle de uno:  --id <idDelPago>');
}

main();
