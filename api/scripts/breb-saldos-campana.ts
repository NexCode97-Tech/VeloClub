import { prisma } from '../src/db/client';
import { registrarEvento } from '../src/lib/auditoria';

/**
 * **Escribe.** Anota los saldos que los clubes de la campaña pagaron por Bre-B.
 *
 * Su primer trimestre se acordó en $180.000 planos, pero la plataforma todavía
 * cobraba por tramos con el descuento del plan, así que cobró entre 153.000 y
 * 162.000 y la diferencia se pagó por Bre-B el mismo día. Esa parte nunca entró
 * al sistema y por eso Finanzas mostraba menos plata de la que entró.
 *
 * De aquí en adelante no vuelve a pasar: el precio de campaña ya vive en
 * lib/pricing.ts y el checkout cobra los 180.000 de una vez. Este script es
 * solo para los cuatro que quedaron atrás, así que **se borra cuando cumpla**.
 *
 * Los pagos normalmente se registran desde el panel, para que quede la bitácora
 * y el club reciba su aviso. Acá se hace por consola por una razón: el pago
 * tiene que quedar fechado el día en que la plata entró de verdad, y Finanzas
 * agrupa por `createdAt`, que el panel siempre pone en hoy. Sin eso, los 27.000
 * de Correcaminos —que son del 31 de julio— se contarían en agosto. La bitácora
 * igual se escribe, más abajo.
 *
 * No notifica al club a propósito: es plata que ya pagaron hace semanas y que
 * ellos dan por hecha; un aviso de «pago registrado» hoy solo confunde.
 *
 *   export DATABASE_URL="..."   # ver scripts/README.md
 *   npx tsx scripts/breb-saldos-campana.ts              # muestra qué haría
 *   npx tsx scripts/breb-saldos-campana.ts --confirmar  # lo hace
 */

/** Lo acordado por el trimestre durante la campaña. */
const TRIMESTRE_CAMPANA = 180_000;

interface Saldo {
  club: string;
  monto: number;
  /** El día en que se pagó por Bre-B, el mismo del cobro con tarjeta. */
  fecha: string;
}

const SALDOS: Saldo[] = [
  { club: 'Correcaminos',                monto: 27_000, fecha: '2026-07-31' },
  { club: 'Club de patinaje Campestre Nueva Generacion', monto: 18_000, fecha: '2026-08-02' },
  { club: 'LANDI Piedecuesta',           monto: 27_000, fecha: '2026-08-04' },
  { club: 'Bont Skate Santander',        monto: 18_000, fecha: '2026-08-19' },
];

const CONCEPTO = 'Saldo del trimestre por Bre-B';
const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

(async () => {
  const confirmar = process.argv.includes('--confirmar');
  if (!confirmar) console.log('— ensayo: no se escribe nada. Agregá --confirmar para hacerlo —\n');

  let anotados = 0;

  for (const s of SALDOS) {
    const club = await prisma.club.findFirst({
      where: { name: s.club },
      include: { suscripcion: { include: { pagos: { where: { estado: 'PAID' } } } } },
    });

    if (!club) { console.log(`✗ ${s.club}: no existe un club con ese nombre`); continue; }
    if (!club.suscripcion) { console.log(`✗ ${s.club}: no tiene suscripción`); continue; }

    // Idempotente: si ya está anotado, no se duplica. Un script que escribe
    // tiene que poder correrse dos veces sin dejar el doble.
    const yaEsta = club.suscripcion.pagos.some(p => p.concepto === CONCEPTO);
    if (yaEsta) { console.log(`· ${s.club}: ya tenía su saldo anotado, se salta`); continue; }

    const pagado = club.suscripcion.pagos.reduce((t, p) => t + p.monto, 0);
    const esperado = TRIMESTRE_CAMPANA - pagado;
    if (esperado !== s.monto) {
      console.log(
        `✗ ${s.club}: lleva pagado ${pesos(pagado)}, así que faltarían ${pesos(esperado)} ` +
        `y no ${pesos(s.monto)}. Se salta para no anotar un número que no cuadra.`,
      );
      continue;
    }

    // Mediodía UTC: guardado a medianoche, cualquier huso al oeste lo corre al
    // día anterior y el pago se contaría en el mes que no es.
    const cuando = new Date(`${s.fecha}T12:00:00Z`);

    if (!confirmar) {
      console.log(`→ ${s.club}: anotaría ${pesos(s.monto)} con fecha ${s.fecha}`);
      continue;
    }

    await prisma.suscripcionPago.create({
      data: {
        suscripcionId: club.suscripcion.id,
        concepto: CONCEPTO,
        monto: s.monto,
        fecha: cuando,
        // Finanzas agrupa por createdAt, que es cuando entró la plata.
        createdAt: cuando,
        estado: 'PAID',
      },
    });

    await registrarEvento({
      accion: 'PAGO_REGISTRADO',
      entidad: 'SuscripcionPago',
      resumen: `Se anotó el saldo por Bre-B de ${club.name}: ${pesos(s.monto)} del ${s.fecha}, ` +
               `para completar el trimestre de campaña de ${pesos(TRIMESTRE_CAMPANA)}.`,
      clubId: club.id,
      clubNombre: club.name,
      datos: { medio: 'Bre-B', monto: s.monto, fecha: s.fecha, origen: 'scripts/breb-saldos-campana.ts' },
    });

    console.log(`✓ ${s.club}: ${pesos(s.monto)} anotados con fecha ${s.fecha}`);
    anotados++;
  }

  console.log(
    confirmar
      ? `\n${anotados} de ${SALDOS.length} anotados.`
      : `\nEnsayo terminado. Nada se escribió.`,
  );
  await prisma.$disconnect();
})();
