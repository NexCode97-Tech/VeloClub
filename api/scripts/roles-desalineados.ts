/**
 * A quién no reconoce el sistema con el rol que le dio su club.
 *
 * El backend autoriza por `User.role`, pero el club administra el rol en
 * `Member.role`. Cuando las dos puntas se separan, la persona ve una app con
 * menos permisos de los que le corresponden — o ninguna. Las tres formas de
 * separarse:
 *
 *   - SIN USER      : el clerkId del Member no tiene cuenta en la base. Suele ser
 *                     un clerkId muerto de la instancia anterior de Clerk; la
 *                     persona puede tener cuenta con OTRO id.
 *   - ROL DISTINTO  : lo promovieron en el club y el User quedó con el rol viejo.
 *   - CLUB DISTINTO : el User apunta a otro club que el Member.
 *
 * Repará lo que salga con scripts/revincular-miembro.ts, y averiguá el id real
 * de la cuenta con scripts/cuenta-clerk.ts <correo>.
 *
 *   npx tsx scripts/roles-desalineados.ts              todos
 *   npx tsx scripts/roles-desalineados.ts francisco    solo quien coincida
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const filtro = process.argv.slice(2).join(' ');

  const miembros = await prisma.member.findMany({
    where: {
      clerkId: { not: null },
      ...(filtro ? { fullName: { contains: filtro, mode: 'insensitive' as const } } : {}),
    },
    select: { fullName: true, role: true, clerkId: true, clubId: true, email: true, club: { select: { name: true } } },
  });

  let problemas = 0;

  for (const m of miembros) {
    const u = await prisma.user.findUnique({ where: { clerkId: m.clerkId! } });

    if (!u) {
      problemas++;
      console.log(`\nSIN USER      | ${m.fullName} (${m.club?.name})`);
      console.log(`   member.role=${m.role}  clerkId=${m.clerkId}`);
      console.log(`   correo=${m.email ?? '-'}`);
      console.log(`   -> npx tsx scripts/cuenta-clerk.ts ${m.email ?? m.clerkId}`);
      continue;
    }

    // Un superadministrador tiene rol propio a propósito: no cuenta como desvío.
    const rolDistinto  = u.role !== m.role && u.role !== 'SUPERADMIN';
    const clubDistinto = u.clubId !== m.clubId;

    if (rolDistinto || clubDistinto) {
      problemas++;
      console.log(`\n${rolDistinto ? 'ROL DISTINTO ' : 'CLUB DISTINTO'} | ${m.fullName} (${m.club?.name})`);
      if (rolDistinto)  console.log(`   member.role=${m.role}  user.role=${u.role}  <-- manda user.role`);
      if (clubDistinto) console.log(`   member.club=${m.clubId}  user.club=${u.clubId}`);
      continue;
    }

    // Con filtro se muestra también lo que está bien: si alguien reporta que no
    // puede entrar, saber que su rol está correcto descarta la causa y evita
    // arreglar lo que no está roto.
    if (filtro) {
      console.log(`\nOK            | ${m.fullName} (${m.club?.name}) — ${m.role}, cuenta correcta`);
    }
  }

  console.log(`\n─── ${miembros.length} miembros vinculados · ${problemas} con problemas ───`);
}

main().finally(() => prisma.$disconnect());
