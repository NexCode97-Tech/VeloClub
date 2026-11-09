// Una sola vez, al prender Whop para todos (PAGOS_PROVEEDOR=whop).
//
// Los clubes que tenían renovación automática en Mercado Pago quedan sin ella:
// se cancela su cobro recurrente allá y se les avisa. Su plan pagado sigue
// igual hasta que vence; la renovación la vuelven a prender ellos al pagar con
// Whop, como se decidió el 7 de noviembre de 2026.
//
// Uso: npx tsx prisma/pasar-a-whop.ts            (muestra qué haría)
//      npx tsx prisma/pasar-a-whop.ts --aplicar  (lo hace)
import { PrismaClient } from '@prisma/client';
import { cancelarPreapproval } from '../src/lib/mercadopago';
import { vigencia, type TipoPlan } from '../src/lib/pricing';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

async function main() {
  const conRecurrente = await prisma.clubSuscripcion.findMany({
    where: { mpPreapprovalId: { not: null } },
    include: { club: { select: { id: true, name: true } }, pagos: { select: { estado: true, fecha: true } } },
  });
  console.log((aplicar ? 'Aplicando' : 'Simulando') + ': ' + conRecurrente.length + ' clubes con renovación en Mercado Pago');

  for (const s of conRecurrente) {
    const vig = vigencia(s.pagos, s.tipoPlan as TipoPlan);
    const hasta = vig && !vig.vencido
      ? new Date(Date.now() + vig.diasRestantes * 86_400_000).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    console.log('- ' + s.club.name + ' · plan ' + s.tipoPlan + (hasta ? ' · cubierto hasta ' + hasta : ' · sin período vigente'));
    if (!aplicar) continue;

    try {
      await cancelarPreapproval(s.mpPreapprovalId!);
    } catch (err) {
      console.error('  no se pudo cancelar en Mercado Pago:', err instanceof Error ? err.message : err);
    }
    await prisma.clubSuscripcion.update({
      where: { id: s.id },
      data: { autoRenew: false, mpPreapprovalId: null, intentosFallidos: 0 },
    });

    const staff = await prisma.member.findMany({
      where: { clubId: s.clubId, role: { in: ['ADMIN', 'ENTRENADOR'] }, clerkId: { not: null } },
      select: { clerkId: true },
    });
    for (const m of staff) {
      await prisma.notification.create({
        data: {
          recipientClerkId: m.clerkId!,
          clubId: s.clubId,
          tipo: 'SUSCRIPCION_CAMBIO_PASARELA',
          titulo: 'Cambiamos la forma de pago',
          cuerpo: (hasta ? 'Tu plan sigue igual hasta el ' + hasta + '. ' : '')
            + 'Ahora pagas con Whop: tarjeta, PSE, Nequi, Bancolombia, Efecty, Bre-B, Google Pay o Apple Pay. '
            + 'Si quieres la renovación automática, actívala cuando pagues tu próximo período.',
          link: '/ajustes?tab=suscripcion',
        },
      });
    }
    console.log('  listo: renovación de Mercado Pago cancelada y ' + staff.length + ' avisos enviados');
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
