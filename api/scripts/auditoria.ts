/**
 * Lee la bitacora. Se maneja de forma interna: no hay pantalla ni endpoint.
 *
 *   npx tsx scripts/auditoria.ts                     ultimos 50
 *   npx tsx scripts/auditoria.ts CLUB_ELIMINADO      filtrado por accion
 *   npx tsx scripts/auditoria.ts CLUB_ELIMINADO 200  con otro limite
 *
 * Con DATABASE_URL apuntando a produccion:
 *   export DATABASE_URL="$(railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL=' | cut -d= -f2-)"
 */
import { PrismaClient } from '@prisma/client';

// Cliente sin la extension: leer la bitacora no debe generar bitacora.
const prisma = new PrismaClient();

async function main() {
  const accion = process.argv[2];
  const limite = Number(process.argv[3] ?? 50);

  const registros = await prisma.auditoria.findMany({
    where: accion ? { accion } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limite,
  });

  if (registros.length === 0) {
    console.log('Sin registros' + (accion ? ` para ${accion}` : '') + '.');
  }

  for (const r of registros.reverse()) {
    const cuando = r.createdAt.toISOString().replace('T', ' ').slice(0, 16);
    const quien = r.actorNombre || r.actorEmail || 'desconocido';
    console.log(`\n${cuando} | ${r.accion}`);
    console.log(`  ${r.resumen}`);
    console.log(`  por ${quien}${r.actorRol ? ` (${r.actorRol})` : ''}${r.ip ? ` desde ${r.ip}` : ''}`);
    if (r.clubNombre) console.log(`  club: ${r.clubNombre}`);
    if (r.datos) {
      const texto = JSON.stringify(r.datos, null, 2);
      // Un JSON largo tapa el resto: se recorta y queda el id para consultarlo.
      console.log(texto.length > 1200
        ? `  ${texto.slice(0, 1200)}\n  … recortado, id ${r.id}`
        : texto.split('\n').map(l => `  ${l}`).join('\n'));
    }
  }

  const total = await prisma.auditoria.count();
  console.log(`\n─── ${registros.length} de ${total} registros ───`);
}

main().finally(() => prisma.$disconnect());
