// Solo lectura: cuantas sedes tiene cada deportista, y cuantas sedes cada club.
import { prisma } from '../src/db/client';

async function main() {
  const clubs = await prisma.club.findMany({ select: { id: true, name: true } });
  const porClub = new Map(clubs.map(c => [c.id, c.name]));

  const miembros = await prisma.member.findMany({
    where: { role: 'STUDENT' },
    select: {
      id: true, fullName: true, clubId: true, active: true,
      locations: { select: { locationId: true } },
    },
  });

  let sin = 0, una = 0;
  const varias: { nombre: string; club: string; n: number; activo: boolean }[] = [];

  for (const m of miembros) {
    const n = m.locations.length;
    if (n === 0) sin++;
    else if (n === 1) una++;
    else varias.push({ nombre: m.fullName, club: porClub.get(m.clubId) ?? m.clubId, n, activo: m.active });
  }

  console.log(`Deportistas totales : ${miembros.length}`);
  console.log(`  sin sede          : ${sin}`);
  console.log(`  con una sede      : ${una}`);
  console.log(`  con varias sedes  : ${varias.length}`);
  if (varias.length) {
    console.log('\nEn mas de una sede:');
    for (const v of varias) console.log(`  - ${v.nombre} (${v.club}): ${v.n}${v.activo ? '' : ' [en pausa]'}`);
  }

  const sedes = await prisma.location.groupBy({ by: ['clubId'], _count: { _all: true } });
  console.log('\nSedes por club:');
  for (const s of sedes.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  - ${porClub.get(s.clubId) ?? s.clubId}: ${s._count._all}`);
  }
}

main().finally(() => prisma.$disconnect());
