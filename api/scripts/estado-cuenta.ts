// Solo lectura: estado de una cuenta y rastros de clubes desaparecidos.
import { prisma } from '../src/db/client';

const CORREOS = ['nexcode97@gmail.com'];

async function main() {
  for (const email of CORREOS) {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, name: true, email: true, role: true, clubId: true, createdAt: true },
    });
    console.log(`\nUser <${email}>: ${user ? JSON.stringify(user, null, 2) : 'NO EXISTE'}`);

    const miembros = await prisma.member.findMany({
      where: { email },
      select: { fullName: true, role: true, clubId: true, club: { select: { name: true } } },
    });
    console.log(`Member con ese correo: ${miembros.length}`);
    for (const m of miembros) console.log(`  - ${m.fullName} ${m.role} en ${m.club?.name ?? m.clubId}`);
  }

  // Clubes nombrados en la bitacora que ya no existen. Sin comillas esta vez:
  // se compara cada nombre actual contra el texto de la notificacion.
  const clubs = await prisma.club.findMany({ select: { name: true } });
  const notis = await prisma.notificacion.findMany({
    where: { tipo: 'CLUB_CREADO' },
    select: { cuerpo: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n─── Clubes creados segun la bitacora ───');
  for (const n of notis) {
    const m = n.cuerpo.match(/^(.+?) fue creado con admin/) ?? n.cuerpo.match(/^(.+?) se auto-registró/);
    if (!m) continue;
    const nombre = m[1].trim();
    const existe = clubs.some(c =>
      c.name.toLowerCase().replace(/\s+/g, '') === nombre.toLowerCase().replace(/\s+/g, '')
      || c.name.toLowerCase().includes(nombre.toLowerCase().slice(0, 10))
      || nombre.toLowerCase().includes(c.name.toLowerCase().slice(0, 10))
    );
    console.log(`  ${existe ? 'existe  ' : 'NO ESTA '} | ${n.createdAt.toISOString().slice(0, 10)} | ${nombre}`);
  }

  // Restos: miembros, pagos o asistencias apuntando a un club inexistente.
  // Si el borrado fue en cascada no deberia quedar ninguno.
  const ids = new Set((await prisma.club.findMany({ select: { id: true } })).map(c => c.id));
  const members = await prisma.member.findMany({ select: { clubId: true } });
  const sueltos = members.filter(m => !ids.has(m.clubId)).length;
  console.log(`\nMiembros apuntando a un club inexistente: ${sueltos}`);
}

main().finally(() => prisma.$disconnect());
