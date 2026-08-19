/**
 * Qué medios de pago y qué bancos tenemos habilitados hoy en Mercado Pago.
 *
 * Es la respuesta autorizada a "¿podemos cobrar por X?" — el catálogo real de
 * la cuenta, no lo que diga la documentación.
 *
 *   railway run --service VeloClub -- npx tsx scripts/medios-de-pago.ts
 *   railway run --service VeloClub -- npx tsx scripts/medios-de-pago.ts --bancos
 *   railway run --service VeloClub -- npx tsx scripts/medios-de-pago.ts --bancos 1507
 */
const TOKEN = process.env.MP_ACCESS_TOKEN!;

interface Metodo {
  id: string; name: string; status: string; payment_type_id: string;
  financial_institutions?: Array<{ id: string; description: string }>;
}

async function main() {
  const args = process.argv.slice(2);
  const verBancos = args.includes('--bancos');
  const buscado = args[args.indexOf('--bancos') + 1];

  const r = await fetch('https://api.mercadopago.com/v1/payment_methods', {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const metodos = await r.json() as Metodo[];

  if (verBancos) {
    const pse = metodos.find(m => m.id === 'pse');
    if (!pse) { console.log('PSE no está habilitado en esta cuenta.'); return; }
    const bancos = pse.financial_institutions ?? [];
    console.log(`\nPSE (${pse.status}) — ${bancos.length} bancos\n`);
    for (const b of bancos) {
      if (buscado && !buscado.startsWith('--') && b.id !== buscado) continue;
      console.log(`  ${b.id.padEnd(6)} ${b.description}`);
    }
    return;
  }

  console.log(`\n${metodos.length} medios habilitados:\n`);
  const porTipo = new Map<string, string[]>();
  for (const m of metodos) {
    const lista = porTipo.get(m.payment_type_id) ?? [];
    lista.push(`${m.id} (${m.name})${m.status !== 'active' ? ` [${m.status}]` : ''}`);
    porTipo.set(m.payment_type_id, lista);
  }
  for (const [tipo, ids] of porTipo) {
    console.log(`${tipo}:`);
    for (const i of ids) console.log(`   ${i}`);
  }
  console.log('\nBancos de PSE:  --bancos');
}

main();
