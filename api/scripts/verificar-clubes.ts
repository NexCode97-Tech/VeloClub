// Solo lectura: cuantos clubes hay y cuantos tienen logo.
import { prisma } from '../src/db/client';

async function main() {
  const clubs = await prisma.club.findMany({
    select: { name: true, logoUrl: true, active: true, verificationStatus: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`TOTAL DE CLUBES EN LA BASE: ${clubs.length}\n`);
  const con = clubs.filter(c => !!c.logoUrl);
  const sin = clubs.filter(c => !c.logoUrl);
  console.log(`  con logo : ${con.length}`);
  console.log(`  sin logo : ${sin.length}\n`);
  console.log('Sin logo (siguen existiendo):');
  for (const c of sin) {
    console.log(`  - ${c.name} | activo:${c.active} | ${c.verificationStatus} | creado ${c.createdAt.toISOString().slice(0,10)}`);
  }
}
main().finally(() => prisma.$disconnect());
