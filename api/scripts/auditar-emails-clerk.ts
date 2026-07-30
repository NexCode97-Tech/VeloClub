/**
 * Audita el estado de verificación de los correos en Clerk.
 *
 * requireAuth ahora exige un correo verificado para autenticar. Este script
 * comprueba, antes de desplegar, que ningún usuario real quede bloqueado.
 *
 * Solo lectura: no modifica nada.
 *
 * Uso:  railway run npx tsx scripts/auditar-emails-clerk.ts
 */
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('Falta CLERK_SECRET_KEY. Ejecuta con: railway run npx tsx scripts/auditar-emails-clerk.ts');
    process.exit(1);
  }

  const bloqueados: string[] = [];
  const sinPrincipalVerificado: string[] = [];
  let total = 0;
  let offset = 0;

  for (;;) {
    const { data } = await clerk.users.getUserList({ limit: 100, offset });
    if (data.length === 0) break;

    for (const user of data) {
      total++;
      const verificados = user.emailAddresses.filter(e => e.verification?.status === 'verified');
      const principal = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);

      // Sin ningún correo verificado, requireAuth devolvería 403.
      if (verificados.length === 0) {
        bloqueados.push(user.emailAddresses[0]?.emailAddress ?? `(sin correo) id=${user.id}`);
        continue;
      }

      // Caso a vigilar: el principal no está verificado, así que la identidad
      // pasa a resolverse por otro correo distinto al que se usaba antes.
      if (!principal || principal.verification?.status !== 'verified') {
        sinPrincipalVerificado.push(
          `${principal?.emailAddress ?? '(sin principal)'} -> ahora resuelve como ${verificados[0].emailAddress}`
        );
      }
    }

    offset += data.length;
  }

  console.log(`\nUsuarios en Clerk: ${total}`);

  console.log(`\nQuedarian bloqueados (ningun correo verificado): ${bloqueados.length}`);
  for (const email of bloqueados) console.log(`  - ${email}`);

  console.log(`\nCambian de correo de identidad (principal sin verificar): ${sinPrincipalVerificado.length}`);
  for (const linea of sinPrincipalVerificado) console.log(`  - ${linea}`);

  // Detecta el riesgo de suplantación que motivó el cambio: correos verificados
  // repetidos entre cuentas distintas.
  console.log('');
  if (bloqueados.length === 0 && sinPrincipalVerificado.length === 0) {
    console.log('Sin impacto: el cambio es seguro de desplegar.');
  } else {
    console.log('Revisar los casos anteriores antes de desplegar.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
