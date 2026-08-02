/**
 * Otorga días de prueba a un club.
 *
 * Si la prueba anterior sigue vigente, los días se suman a lo que le quedaba; si
 * ya venció (o no tenía), se cuentan desde hoy. Reactiva el club si estaba
 * apagado por vencimiento.
 *
 * Simulación por defecto. Para ejecutar de verdad hay que pasar --aplicar.
 *
 * Uso:
 *   railway run --service Postgres npx tsx scripts/dar-dias-de-prueba.ts "Floridablanca" 60
 *   railway run --service Postgres npx tsx scripts/dar-dias-de-prueba.ts "Floridablanca" 60 --aplicar
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

async function main() {
  const busqueda = process.argv[2];
  const dias = Number(process.argv[3]);
  const aplicar = process.argv.includes('--aplicar');

  if (!busqueda || !Number.isFinite(dias) || dias <= 0) {
    console.error('Uso: dar-dias-de-prueba.ts "<nombre del club>" <dias> [--aplicar]');
    process.exit(1);
  }

  const clubes = await prisma.club.findMany({
    where: { name: { contains: busqueda, mode: 'insensitive' } },
    select: {
      id: true, name: true, active: true, trialEndsAt: true,
      desactivadoPorVencimiento: true, activadoManualmente: true,
    },
  });

  if (clubes.length === 0) {
    console.log(`No se encontró ningún club que contenga "${busqueda}".`);
    return;
  }
  if (clubes.length > 1) {
    console.log(`Hay ${clubes.length} clubes que coinciden con "${busqueda}". Afina el nombre:`);
    for (const c of clubes) console.log(`  - ${c.name}`);
    return;
  }

  const club = clubes[0];
  const ahora = new Date();
  const vigente = club.trialEndsAt && club.trialEndsAt > ahora;
  const base = vigente ? club.trialEndsAt! : ahora;
  const nuevaFecha = new Date(base.getTime() + dias * 86_400_000);

  console.log(`\n${aplicar ? 'APLICANDO' : 'SIMULACIÓN (sin --aplicar no se escribe nada)'}\n`);
  console.log(`Club:            ${club.name}`);
  console.log(`Activo:          ${club.active}${club.desactivadoPorVencimiento ? ' (apagado por vencimiento)' : ''}`);
  console.log(`Prueba actual:   ${fmt(club.trialEndsAt)} ${vigente ? '(vigente, se suman los días)' : '(vencida o inexistente, se cuenta desde hoy)'}`);
  console.log(`Prueba nueva:    ${fmt(nuevaFecha)}  (+${dias} días)`);
  if (club.activadoManualmente) {
    console.log('Nota:            estaba activado manualmente; esa marca se quita para que mande la prueba.');
  }

  if (!aplicar) {
    console.log('\nPara ejecutarlo de verdad, repite el comando agregando --aplicar');
    return;
  }

  await prisma.club.update({
    where: { id: club.id },
    data: {
      trialEndsAt: nuevaFecha,
      active: true,
      desactivadoPorVencimiento: false,
      activadoManualmente: false,
    },
  });

  console.log('\nListo. Prueba actualizada.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
