// Solo lectura: busca en las notificaciones del superadmin el rastro de clubes
// que se crearon alguna vez. Al borrarse un club, la notificacion NO se borra
// —no hay relacion entre ambas tablas—, asi que sirve de bitacora.
import { prisma } from '../src/db/client';

async function main() {
  const notis = await prisma.notificacion.findMany({
    orderBy: { createdAt: 'asc' },
    select: { tipo: true, titulo: true, cuerpo: true, createdAt: true },
  });

  console.log(`Notificaciones del superadmin: ${notis.length}\n`);
  for (const n of notis) {
    console.log(`${n.createdAt.toISOString().slice(0, 10)} | ${n.tipo} | ${n.titulo} — ${n.cuerpo}`);
  }

  const clubs = await prisma.club.findMany({ select: { name: true } });
  const nombres = clubs.map(c => c.name.toLowerCase());

  console.log('\n─── Clubes nombrados en notificaciones que YA NO existen ───');
  const mencionados = new Set<string>();
  for (const n of notis) {
    const texto = `${n.titulo} ${n.cuerpo}`;
    for (const m of texto.matchAll(/«([^»]+)»|"([^"]+)"/g)) {
      const nombre = (m[1] ?? m[2]).trim();
      if (nombre) mencionados.add(nombre);
    }
  }
  let faltan = 0;
  for (const nombre of mencionados) {
    if (!nombres.includes(nombre.toLowerCase())) {
      console.log(`  - ${nombre}`);
      faltan++;
    }
  }
  if (faltan === 0) console.log('  (ninguno)');
}

main().finally(() => prisma.$disconnect());
