import { prisma } from '../src/db/client';

/**
 * Los clubes de la promoción de dos meses y qué falta por cobrarles.
 *
 * El primer trimestre de estos clubes se acordó en $180.000, y se pagó partido:
 * una parte por la plataforma y el saldo por Bre-B, por fuera del sistema. Lo
 * de Bre-B no está en `SuscripcionPago`, así que Finanzas del superadmin
 * muestra menos plata de la que entró.
 *
 * Este script no arregla nada: dice cuánto falta registrar por club, para poder
 * anotarlo desde el panel. Los pagos no se crean por script — pasan por el
 * panel para que queden en la bitácora y el club reciba su aviso.
 *
 * Solo lectura.
 *
 *   export DATABASE_URL="..."   # ver scripts/README.md
 *   npx tsx scripts/promo-saldos.ts
 */

/** Lo acordado por el primer trimestre de los clubes con promoción. */
const TRIMESTRE_PROMO = 180_000;

/** La promoción da 60 días de prueba; lo normal son 15. */
const DIAS_PROMO = 60;

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

(async () => {
  const clubes = await prisma.club.findMany({
    include: {
      suscripcion: { include: { pagos: { where: { estado: 'PAID' }, orderBy: { createdAt: 'asc' } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Un club entró con promoción si su prueba duró cerca de 60 días. Se compara
  // con margen de dos días: los regalos manuales de días corren `trialEndsAt`.
  const dePromo = clubes.filter(c => {
    if (!c.trialEndsAt) return false;
    const dias = Math.round((c.trialEndsAt.getTime() - c.createdAt.getTime()) / 86_400_000);
    return Math.abs(dias - DIAS_PROMO) <= 2;
  });

  if (dePromo.length === 0) {
    console.log('Ningún club con prueba de ~60 días.');
    await prisma.$disconnect();
    return;
  }

  console.log(
    'CLUB'.padEnd(28),
    'PLAN'.padEnd(12),
    'PLANMONTO'.padStart(10),
    'PAGADO'.padStart(10),
    'FALTA'.padStart(10),
    ' PAGOS',
  );
  console.log('-'.repeat(92));

  let faltaTotal = 0;
  const planDudoso: string[] = [];

  for (const c of dePromo) {
    const pagos = c.suscripcion?.pagos ?? [];
    const pagado = pagos.reduce((t, p) => t + p.monto, 0);
    const falta = Math.max(0, TRIMESTRE_PROMO - pagado);
    faltaTotal += falta;

    const plan = c.suscripcion?.tipoPlan ?? '—';
    const planMonto = c.suscripcion?.planMonto ?? 0;
    // El «Ingreso recurrente» del pulso sale de planMonto, no de los pagos: si
    // ahí no dice lo acordado, esa cifra no cuadra ni registrando los saldos.
    if (plan !== 'TRIMESTRAL' || planMonto !== TRIMESTRE_PROMO) planDudoso.push(c.name);

    console.log(
      c.name.slice(0, 27).padEnd(28),
      String(plan).padEnd(12),
      String(planMonto).padStart(10),
      String(pagado).padStart(10),
      (falta > 0 ? String(falta) : '—').padStart(10),
      ' ' + (pagos.length
        ? pagos.map(p => `${p.mpPaymentId ? 'MP' : 'mano'} ${pesos(p.monto)} ${p.createdAt.toISOString().slice(0, 10)}`).join(' · ')
        : 'sin pagos'),
    );
  }

  console.log('-'.repeat(92));
  console.log(`${dePromo.length} clubes con promoción · falta registrar ${pesos(faltaTotal)}`);

  if (planDudoso.length) {
    console.log(
      `\nOjo: estos no tienen el plan en TRIMESTRAL ${pesos(TRIMESTRE_PROMO)}, así que el ` +
      `«Ingreso recurrente» del pulso no cuadra aunque se registren los saldos:\n  ` +
      planDudoso.join('\n  '),
    );
  }

  await prisma.$disconnect();
})();
