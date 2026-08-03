/**
 * Busca publicaciones y comentarios cuyo autor quedó sin nombre.
 *
 * Solo lectura: no modifica nada.
 *
 * Uso:  railway run --service Postgres npx tsx scripts/revisar-autores-sin-nombre.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const SIN_NOMBRE = ['', 'Usuario', 'Autor'];

async function main() {
  const posts = await prisma.post.findMany({
    select: { id: true, authorName: true, authorClerkId: true, clubName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const comentarios = await prisma.postComment.findMany({
    select: { id: true, authorName: true, authorClerkId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const postsMalos = posts.filter(p => SIN_NOMBRE.includes((p.authorName ?? '').trim()));
  const comsMalos  = comentarios.filter(c => SIN_NOMBRE.includes((c.authorName ?? '').trim()));

  console.log(`\nPublicaciones: ${posts.length} en total, ${postsMalos.length} sin nombre de autor`);
  console.log(`Comentarios:   ${comentarios.length} en total, ${comsMalos.length} sin nombre de autor`);

  // Para cada autor afectado, mirar si sí tenemos su nombre en otra parte
  const clerkIds = Array.from(new Set(
    [...postsMalos, ...comsMalos].map(x => x.authorClerkId).filter((v): v is string => !!v)
  ));

  if (clerkIds.length === 0) {
    console.log('\nNo hay autores afectados con clerkId, no se puede reparar automáticamente.');
    return;
  }

  const users   = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { clerkId: true, name: true, email: true },
  });
  const members = await prisma.member.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { clerkId: true, fullName: true },
  });

  console.log(`\nAutores distintos afectados: ${clerkIds.length}`);
  for (const id of clerkIds) {
    const u = users.find(x => x.clerkId === id);
    const m = members.find(x => x.clerkId === id);
    const nombreUser   = (u?.name ?? '').trim();
    const nombreMember = (m?.fullName ?? '').trim();
    const recuperable  = nombreMember || (SIN_NOMBRE.includes(nombreUser) ? '' : nombreUser);

    const nPosts = postsMalos.filter(p => p.authorClerkId === id).length;
    const nComs  = comsMalos.filter(c => c.authorClerkId === id).length;

    console.log(`  - ${id.slice(0, 18)}…  posts:${nPosts} comentarios:${nComs}`);
    console.log(`      User.name:      "${nombreUser}"`);
    console.log(`      Member.fullName:"${nombreMember}"`);
    console.log(`      => ${recuperable ? `se puede reparar con "${recuperable}"` : 'NO hay nombre en ninguna parte'}`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
