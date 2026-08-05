import { PrismaClient } from '@prisma/client';

/**
 * Repara cuentas que quedaron sin club (User.clubId en null) aunque la persona
 * si pertenece a un club por su registro de Member.
 *
 * Sintomas: Ajustes no carga (GET /clubs/settings responde 404 porque busca un
 * club con id vacio) y no se puede asignar sede al crear un miembro (la
 * validacion compara contra un club que no existe).
 *
 * Simula por defecto. Para escribir: node revincular-usuarios-sin-club.mjs --aplicar
 */

const APLICAR = process.argv.includes('--aplicar');
const p = new PrismaClient();

const huerfanos = await p.user.findMany({
  where: { clubId: null, role: { not: 'SUPERADMIN' } },
  select: { id: true, email: true, name: true, role: true, clerkId: true },
});

console.log(APLICAR ? '=== APLICANDO ===' : '=== SIMULACION (usa --aplicar para escribir) ===');
console.log(`Cuentas sin club: ${huerfanos.length}\n`);

let reparadas = 0, sinMiembro = 0;

for (const u of huerfanos) {
  // Se busca por clerkId primero (vinculo fuerte) y por correo despues.
  const miembro = await p.member.findFirst({
    where: {
      OR: [
        ...(u.clerkId ? [{ clerkId: u.clerkId }] : []),
        ...(u.email ? [{ email: { equals: u.email, mode: 'insensitive' } }] : []),
      ],
    },
    select: { id: true, fullName: true, clubId: true, role: true, club: { select: { name: true, active: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!miembro) {
    console.log(`  OMITIDA  ${u.email} — no tiene registro de miembro en ningun club`);
    sinMiembro++;
    continue;
  }

  if (!miembro.club?.active) {
    console.log(`  OMITIDA  ${u.email} — su club (${miembro.club?.name}) esta desactivado`);
    continue;
  }

  console.log(`  REPARAR  ${u.email}`);
  console.log(`           club: ${miembro.club.name} · rol del miembro: ${miembro.role} · rol de la cuenta: ${u.role}`);

  if (APLICAR) {
    await p.user.update({
      where: { id: u.id },
      data: {
        clubId: miembro.clubId,
        // El rol manda desde el registro de miembro, que es donde el club lo
        // administra. Una cuenta que quedo como COACH siendo ADMIN del club
        // perdio permisos al desvincularse.
        role: miembro.role,
      },
    });
  }
  reparadas++;
}

console.log(`\n${APLICAR ? 'Reparadas' : 'Se repararian'}: ${reparadas}`);
console.log(`Sin registro de miembro (no se tocan): ${sinMiembro}`);
if (!APLICAR) console.log('\nNada fue modificado. Corre con --aplicar para escribir.');

await p.$disconnect();
