import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const clubs = await prisma.club.findMany({
  include: {
    _count: { select: { members: true } },
    suscripcion: { include: { pagos: { where: { estado: 'PAID' } } } },
  },
  orderBy: { createdAt: 'desc' },
});
const ahora = new Date();
console.log('CLUB'.padEnd(44), 'DEPORT'.padStart(6), 'MIEMB'.padStart(6), ' TRIAL VENCE   DIAS  PAGOS');
for (const c of clubs) {
  const deportistas = await prisma.member.count({ where: { clubId: c.id, role: 'STUDENT' } });
  const fin = c.trialEndsAt;
  const dias = fin ? Math.ceil((fin.getTime() - ahora.getTime()) / 86400000) : null;
  const pagos = c.suscripcion?.pagos.length ?? 0;
  console.log(
    c.name.slice(0, 43).padEnd(44),
    String(deportistas).padStart(6),
    String(c._count.members).padStart(6),
    (fin ? fin.toISOString().slice(0, 10) : 'sin trial ').padStart(12),
    String(dias ?? '-').padStart(5),
    String(pagos).padStart(6)
  );
}
await prisma.$disconnect();
