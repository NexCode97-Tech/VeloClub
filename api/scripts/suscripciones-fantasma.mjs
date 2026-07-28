// Diagnostico y limpieza de suscripciones fantasma.
//
// Una suscripcion fantasma es una fila que se creo sola, sin que el club haya
// pagado nunca: la pantalla de suscripcion hacia un upsert al consultarla, asi
// que heredaba los valores por defecto del esquema (450.000 mensual, un precio
// que ya no existe). En el superadmin esos clubes se veian como plan pago.
//
// Uso:
//   railway run -s VeloClub node scripts/suscripciones-fantasma.mjs           (solo lista)
//   railway run -s VeloClub node scripts/suscripciones-fantasma.mjs --borrar  (elimina)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const borrar = process.argv.includes('--borrar');

const suscripciones = await prisma.clubSuscripcion.findMany({
  include: {
    club:  { select: { id: true, name: true, trialEndsAt: true, active: true } },
    pagos: { select: { id: true, estado: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const fantasma = suscripciones.filter(s => s.pagos.length === 0);
const conPagosNoPagados = suscripciones.filter(
  s => s.pagos.length > 0 && !s.pagos.some(p => p.estado === 'PAID')
);

console.log(`\nSuscripciones totales: ${suscripciones.length}`);
console.log(`Sin ningun pago registrado (fantasma): ${fantasma.length}`);
console.log(`Con pagos pero ninguno acreditado: ${conPagosNoPagados.length}\n`);

const ahora = new Date();
for (const s of fantasma) {
  const enPrueba = s.club.trialEndsAt && s.club.trialEndsAt > ahora;
  const estado = enPrueba
    ? `en prueba hasta ${s.club.trialEndsAt.toISOString().slice(0, 10)}`
    : s.club.trialEndsAt
      ? `prueba vencida ${s.club.trialEndsAt.toISOString().slice(0, 10)}`
      : 'sin prueba';
  console.log(
    `  ${s.club.name.padEnd(28)} $${String(s.planMonto).padStart(9)}  ${String(s.tipoPlan).padEnd(11)} ${s.club.active ? 'activo  ' : 'inactivo'}  ${estado}`
  );
}

if (conPagosNoPagados.length > 0) {
  console.log('\nEstas tienen pagos registrados (no se tocan):');
  for (const s of conPagosNoPagados) {
    console.log(`  ${s.club.name.padEnd(28)} ${s.pagos.length} pago(s), estados: ${s.pagos.map(p => p.estado).join(', ')}`);
  }
}

if (!borrar) {
  console.log('\nSolo diagnostico. Para eliminar, repetir con --borrar\n');
} else if (fantasma.length === 0) {
  console.log('\nNada que eliminar\n');
} else {
  const { count } = await prisma.clubSuscripcion.deleteMany({
    where: { id: { in: fantasma.map(s => s.id) } },
  });
  console.log(`\nEliminadas: ${count}\n`);
}

await prisma.$disconnect();
