// Solo lectura: lista todos los clubes y busca rastros de alguno que ya no este.
import { prisma } from '../src/db/client';

async function main() {
  const clubs = await prisma.club.findMany({
    select: {
      id: true, name: true, city: true, active: true, verificationStatus: true,
      createdAt: true, rejectionReason: true,
      _count: { select: { members: true, users: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`TODOS LOS CLUBES (${clubs.length}):\n`);
  for (const c of clubs) {
    console.log(
      `- ${c.name} | ${c.city ?? 's/ciudad'} | activo:${c.active} | ${c.verificationStatus}` +
      ` | miembros:${c._count.members} | usuarios:${c._count.users}` +
      ` | creado ${c.createdAt.toISOString().slice(0, 10)}` +
      (c.rejectionReason ? ` | rechazo: ${c.rejectionReason}` : '')
    );
  }

  const f = clubs.filter(c => /lorida|blanca/i.test(c.name));
  console.log(`\nCoincidencias con "florida"/"blanca": ${f.length}`);

  // Rastros de un club borrado: usuarios que quedaron sin club o apuntando a
  // uno inexistente. Al borrar un Club, User.clubId cae en cascada.
  const ids = new Set(clubs.map(c => c.id));
  const users = await prisma.user.findMany({
    select: { email: true, name: true, clubId: true, role: true, createdAt: true },
  });
  const huerfanos = users.filter(u => u.clubId && !ids.has(u.clubId));
  const sinClub   = users.filter(u => !u.clubId);
  console.log(`\nUsuarios apuntando a un club inexistente: ${huerfanos.length}`);
  for (const u of huerfanos) console.log(`  - ${u.name} <${u.email}> ${u.role} clubId=${u.clubId}`);
  console.log(`Usuarios con clubId nulo: ${sinClub.length}`);
  for (const u of sinClub) {
    console.log(`  - ${u.name} <${u.email}> ${u.role} creado ${u.createdAt.toISOString().slice(0, 10)}`);
  }

  // Suscripciones o cupones que hayan quedado apuntando a un club que ya no esta
  const subs = await prisma.clubSuscripcion.findMany({ select: { clubId: true } });
  const subsHuerfanas = subs.filter(s => !ids.has(s.clubId));
  console.log(`\nSuscripciones sin club existente: ${subsHuerfanas.length}`);
}

main().finally(() => prisma.$disconnect());
