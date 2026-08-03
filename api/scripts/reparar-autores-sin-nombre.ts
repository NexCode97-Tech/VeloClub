/**
 * Repara publicaciones y comentarios cuyo autor quedó guardado sin nombre.
 *
 * El nombre se recupera del deportista (Member) y, si no está, de la cuenta
 * (User) — el mismo orden que usa el backend al publicar.
 *
 * Simulación por defecto. Para escribir hay que pasar --aplicar.
 *
 * Uso:
 *   railway run --service Postgres npx tsx scripts/reparar-autores-sin-nombre.ts
 *   railway run --service Postgres npx tsx scripts/reparar-autores-sin-nombre.ts --aplicar
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const PLACEHOLDERS = new Set(['', 'usuario', 'autor']);

const esInutil = (v: string | null | undefined) => PLACEHOLDERS.has((v ?? '').trim().toLowerCase());

const aTitleCase = (t: string) =>
  t.toLowerCase().split(/\s+/).filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ').trim();

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  console.log(`\n${aplicar ? 'APLICANDO' : 'SIMULACIÓN (sin --aplicar no se escribe nada)'}\n`);

  const posts = await prisma.post.findMany({
    select: { id: true, authorName: true, authorClerkId: true, content: true },
  });
  const comentarios = await prisma.postComment.findMany({
    select: { id: true, authorName: true, authorClerkId: true, content: true },
  });

  const afectados = [
    ...posts.filter(p => esInutil(p.authorName)).map(p => ({ ...p, tipo: 'post' as const })),
    ...comentarios.filter(c => esInutil(c.authorName)).map(c => ({ ...c, tipo: 'comentario' as const })),
  ];

  if (afectados.length === 0) {
    console.log('No hay nada que reparar.');
    return;
  }

  const clerkIds = Array.from(new Set(afectados.map(a => a.authorClerkId).filter((v): v is string => !!v)));
  const members = await prisma.member.findMany({
    where: { clerkId: { in: clerkIds } }, select: { clerkId: true, fullName: true },
  });
  const users = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } }, select: { clerkId: true, name: true },
  });

  function nombreDe(clerkId: string | null): string | null {
    if (!clerkId) return null;
    const m = members.find(x => x.clerkId === clerkId)?.fullName;
    if (!esInutil(m)) return aTitleCase(m!);
    const u = users.find(x => x.clerkId === clerkId)?.name;
    if (!esInutil(u)) return aTitleCase(u!);
    return null;
  }

  let reparados = 0;
  let sinNombre = 0;

  for (const a of afectados) {
    const nombre = nombreDe(a.authorClerkId);
    const extracto = a.content.replace(/\s+/g, ' ').slice(0, 45);

    if (!nombre) {
      sinNombre++;
      console.log(`  ${a.tipo} ${a.id.slice(0, 8)}…  sin nombre recuperable  "${extracto}…"`);
      continue;
    }

    console.log(`  ${a.tipo} ${a.id.slice(0, 8)}…  "${a.authorName}" -> "${nombre}"  ("${extracto}…")`);
    reparados++;

    if (aplicar) {
      if (a.tipo === 'post') {
        await prisma.post.update({ where: { id: a.id }, data: { authorName: nombre } });
      } else {
        await prisma.postComment.update({ where: { id: a.id }, data: { authorName: nombre } });
      }
    }
  }

  console.log(`\n${aplicar ? 'Reparados' : 'Se repararían'}: ${reparados}`);
  if (sinNombre > 0) console.log(`Sin nombre recuperable: ${sinNombre}`);
  if (!aplicar) console.log('\nPara ejecutarlo de verdad, repite el comando agregando --aplicar');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
