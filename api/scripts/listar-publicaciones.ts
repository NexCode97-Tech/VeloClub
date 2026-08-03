/**
 * Lista las publicaciones del feed con su alcance, club y autor.
 *
 * Útil para entender por qué una publicación aparece o no en el panel general:
 * solo las PUBLIC se ven entre clubes; las PRIVATE quedan dentro del club.
 *
 * Solo lectura: no modifica nada.
 *
 * Uso:  railway run --service Postgres npx tsx scripts/listar-publicaciones.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const fecha = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

async function main() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, scope: true, clubName: true, authorName: true, authorRole: true,
      content: true, imageUrl: true, createdAt: true,
      _count: { select: { comments: true, likes: true } },
    },
  });

  const publicas = posts.filter(p => p.scope === 'PUBLIC').length;
  console.log(`\nTotal: ${posts.length} publicaciones — ${publicas} públicas, ${posts.length - publicas} privadas\n`);

  for (const p of posts) {
    const extracto = p.content.replace(/\s+/g, ' ').slice(0, 60);
    console.log(`[${p.scope === 'PUBLIC' ? 'PÚBLICA ' : 'privada '}] ${fecha(p.createdAt)}`);
    console.log(`   club:   ${p.clubName || '(sin nombre)'}`);
    console.log(`   autor:  ${p.authorName || '(vacío)'} · ${p.authorRole}`);
    console.log(`   texto:  ${extracto}${p.content.length > 60 ? '…' : ''}`);
    console.log(`   media:  ${p.imageUrl ? 'sí' : 'no'}   comentarios: ${p._count.comments}   me gusta: ${p._count.likes}`);
    console.log('');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
