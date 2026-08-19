/**
 * Qué sabe Clerk de una persona.
 *
 * Se usa cuando alguien "no puede entrar" y hay que separar tres causas que se
 * ven iguales desde afuera: el correo sin verificar (el backend responde 403),
 * la cuenta bloqueada, o el clerkId guardado apuntando a una cuenta que ya no
 * existe — pasa con las cuentas de la instancia anterior de Clerk.
 *
 *   railway run --service VeloClub -- npx tsx scripts/cuenta-clerk.ts user_XXXX
 *   railway run --service VeloClub -- npx tsx scripts/cuenta-clerk.ts alguien@correo.com
 *
 * Con un correo lista todas las cuentas que coinciden; con un id, solo esa.
 */
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

interface CuentaClerk {
  id: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: number;
  lastSignInAt: number | null;
  banned: boolean;
  locked: boolean;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string; verification: { status: string } | null }>;
}

function mostrar(u: CuentaClerk) {
  console.log(`\n  ${u.id}`);
  console.log(`    nombre : ${`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '(sin nombre)'}`);
  console.log(`    creada : ${new Date(u.createdAt).toISOString().slice(0, 16)}`);
  console.log(`    entró  : ${u.lastSignInAt ? new Date(u.lastSignInAt).toISOString().slice(0, 16) : 'NUNCA'}`);
  if (u.banned) console.log('    baneada: sí');
  if (u.locked) console.log('    bloqueada: sí');
  for (const e of u.emailAddresses) {
    const principal = e.id === u.primaryEmailAddressId ? ' [principal]' : '';
    const estado = e.verification?.status ?? 'sin verificación';
    const alerta = estado !== 'verified' ? '   <-- SIN VERIFICAR: el backend responde 403' : '';
    console.log(`    correo : ${e.emailAddress}${principal} — ${estado}${alerta}`);
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.log('Uso: npx tsx scripts/cuenta-clerk.ts <clerkId | correo>'); return; }

  if (arg.startsWith('user_')) {
    try {
      mostrar(await clerk.users.getUser(arg) as unknown as CuentaClerk);
    } catch {
      console.log(`\nClerk no tiene la cuenta ${arg}.`);
      console.log('Si algún Member la tiene guardada, quedó apuntando a una cuenta borrada:');
      console.log('revisá con scripts/roles-desalineados.ts y repará con scripts/revincular-miembro.ts.');
    }
    return;
  }

  const res = await clerk.users.getUserList({ query: arg, limit: 20 });
  console.log(`\nCuentas que coinciden con «${arg}»: ${res.data.length}`);
  for (const u of res.data) mostrar(u as unknown as CuentaClerk);
}

main();
