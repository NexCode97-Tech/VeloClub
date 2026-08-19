/**
 * Re-vincula un miembro cuya cuenta de Clerk quedo apuntando a un id muerto.
 *
 * Pasa cuando la cuenta se borro o quedo de una instancia anterior de Clerk:
 * el Member conserva un clerkId que ya no existe y nunca se le crea el registro
 * de User, asi que el backend —que autoriza por User.role— no lo reconoce como
 * administrador aunque el club si lo tenga como tal.
 *
 *   npx tsx scripts/revincular-miembro.ts <memberIdOParteDelNombre> <clerkIdNuevo> [--confirmar]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const busqueda = process.argv[2];
  const clerkIdNuevo = process.argv[3];
  const confirmar = process.argv.includes('--confirmar');

  if (!busqueda || !clerkIdNuevo) {
    console.log('Uso: npx tsx scripts/revincular-miembro.ts <nombre> <clerkIdNuevo> [--confirmar]');
    return;
  }

  const member = await prisma.member.findFirst({
    where: { fullName: { contains: busqueda, mode: 'insensitive' } },
    include: { club: { select: { id: true, name: true, active: true } } },
  });
  if (!member) { console.log(`No se encontro ningun miembro que contenga «${busqueda}».`); return; }

  console.log(`\nMiembro   : ${member.fullName}`);
  console.log(`Club      : ${member.club?.name}`);
  console.log(`Rol       : ${member.role}`);
  console.log(`Correo    : ${member.email ?? '-'}`);
  console.log(`clerkId   : ${member.clerkId ?? '(ninguno)'}  ->  ${clerkIdNuevo}`);

  const yaHayUser = await prisma.user.findUnique({ where: { clerkId: clerkIdNuevo } });
  console.log(`User      : ${yaHayUser ? `ya existe (role=${yaHayUser.role})` : 'se va a crear'}`);

  // Un correo duplicado en User rompe la creacion; se detecta antes de escribir.
  if (!yaHayUser && member.email) {
    const porCorreo = await prisma.user.findFirst({
      where: { email: { equals: member.email, mode: 'insensitive' } },
    });
    if (porCorreo) {
      console.log(`\nYa existe un User con ese correo (clerkId=${porCorreo.clerkId}).`);
      console.log('Habria que re-apuntar ese, no crear uno nuevo. No se hace nada.');
      return;
    }
  }

  if (!confirmar) { console.log('\n(simulacion — agrega --confirmar para escribirlo)'); return; }

  await prisma.member.update({
    where: { id: member.id },
    data: { clerkId: clerkIdNuevo, inviteStatus: 'ACCEPTED' },
  });

  if (!yaHayUser) {
    // El rol y el club salen del registro de miembro, que es donde el club los
    // administra. Es el mismo criterio que usa /me al crear la cuenta.
    await prisma.user.create({
      data: {
        clerkId: clerkIdNuevo,
        email: member.email ?? `${clerkIdNuevo}@sin-correo.veloclubtech.com`,
        name: member.fullName,
        picture: member.pictureUrl ?? null,
        role: member.role,
        clubId: member.clubId,
        profileComplete: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { clerkId: clerkIdNuevo },
      data: { role: member.role, clubId: member.clubId },
    });
  }

  console.log('\nListo. El miembro quedo vinculado y con cuenta.');
}

main().finally(() => prisma.$disconnect());
