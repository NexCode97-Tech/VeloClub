/**
 * Muestra el estado de prueba y de suscripción de un club.
 *
 * Solo lectura: no modifica nada.
 *
 * Uso:  railway run npx tsx scripts/revisar-club-trial-y-plan.ts "Correcaminos"
 */
import { PrismaClient } from '@prisma/client';

// Desde fuera de Railway el host interno no resuelve: hay que usar la url pública.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const PLAN_DIAS: Record<string, number> = { MENSUAL: 30, TRIMESTRAL: 90, ANUAL: 365 };

function fmt(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

async function main() {
  const busqueda = process.argv[2] ?? 'Correcaminos';

  const clubes = await prisma.club.findMany({
    where: { name: { contains: busqueda, mode: 'insensitive' } },
    include: {
      _count: { select: { members: true } },
      suscripcion: { include: { pagos: { orderBy: { fecha: 'desc' } } } },
    },
  });

  if (clubes.length === 0) {
    console.log(`No se encontró ningún club que contenga "${busqueda}".`);
    return;
  }

  for (const club of clubes) {
    console.log(`\n=== ${club.name} ===`);
    console.log(`  creado:        ${fmt(club.createdAt)}`);
    console.log(`  activo:        ${club.active}`);
    console.log(`  deportistas:   ${club._count.members}`);
    console.log(`  trialEndsAt:   ${fmt(club.trialEndsAt)} ${club.trialEndsAt ? '(prueba vigente)' : '(sin prueba: null)'}`);
    console.log(`  activadoManualmente: ${club.activadoManualmente}`);

    const s = club.suscripcion;
    if (!s) {
      console.log('  suscripcion:   ninguna');
      continue;
    }

    console.log(`  plan:          ${s.tipoPlan}  monto guardado: ${s.planMonto ?? '—'}`);
    console.log(`  autoRenew:     ${s.autoRenew}   cancelada: ${fmt(s.canceladaAt)}`);
    console.log(`  pagos (${s.pagos.length}):`);
    for (const p of s.pagos) {
      console.log(`    - ${p.estado.padEnd(9)} ${fmt(p.fecha)}  $${p.monto ?? '—'}`);
    }

    // Mismo cálculo que lib/pricing.vigencia
    const pagados = s.pagos.filter(p => p.estado === 'PAID' && p.fecha);
    if (pagados.length === 0) {
      console.log('  vigencia:      sin pagos aprobados');
      continue;
    }
    const ultimo = pagados.reduce((a, b) => (a.fecha! > b.fecha! ? a : b));
    const dur = PLAN_DIAS[s.tipoPlan] ?? 30;
    const diasPasados = Math.floor((Date.now() - ultimo.fecha!.getTime()) / 86_400_000);
    const restantes = Math.max(0, dur - diasPasados);
    const vence = new Date(ultimo.fecha!.getTime() + dur * 86_400_000);

    console.log(`  vigencia:      cuenta desde el pago (${fmt(ultimo.fecha)}), ${dur} dias`);
    console.log(`                 vence el ${fmt(vence)} — quedan ${restantes} dias`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
