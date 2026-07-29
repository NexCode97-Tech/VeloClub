// Promoción de lanzamiento: 2 meses gratis.
//
// Suma 60 días al período de prueba de los clubes que ya estaban registrados
// cuando arrancó la promoción. Se suman a lo que les quedaba, no lo reemplazan:
// ninguno pierde días que ya se le habían prometido.
//
// Los clubes que se registren de aquí en adelante reciben los 60 días desde el
// arranque, eso lo resuelve el backend (ver diasDePrueba en routes/clubs.ts).
//
// Uso:
//   railway run ... node scripts/promo-dos-meses.mjs            (simulación)
//   railway run ... node scripts/promo-dos-meses.mjs --aplicar  (escribe)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');
const DIAS = 60;

// Lista explícita y cerrada. Se nombran uno por uno a propósito: un filtro
// automático del tipo "todos los que tengan prueba activa" podría alcanzar a un
// club que se registre entre la revisión y la ejecución.
const BENEFICIARIOS = [
  'Correcaminos',
  'ICPT BUGA',
  'LANDI Piedecuesta',
  'Club Deportivo UCundinamarca',
  'Club de patinaje Campestre Nueva Generacion',
  'BontSkate Santander',
];

const fmt = (d) => d.toISOString().slice(0, 10);
const ahora = new Date();
let aplicados = 0;

// Se comparan los nombres recortados porque hay clubes guardados con espacios
// al final, por ejemplo "Correcaminos ". Buscar por igualdad exacta los deja
// por fuera sin que se note.
const todos = await prisma.club.findMany({
  include: { suscripcion: { include: { pagos: { where: { estado: 'PAID' } } } } },
});

for (const nombre of BENEFICIARIOS) {
  const club = todos.find(c => c.name.trim() === nombre);

  if (!club) { console.log(`  ${nombre.padEnd(45)} NO ENCONTRADO`); continue; }

  if (club.suscripcion?.pagos.length) {
    console.log(`  ${club.name.padEnd(45)} OMITIDO — ya tiene pagos registrados`);
    continue;
  }
  if (!club.trialEndsAt) {
    console.log(`  ${club.name.padEnd(45)} OMITIDO — no tiene periodo de prueba`);
    continue;
  }

  // Si ya se le aplicó, no volver a sumar: el script debe poder correrse dos
  // veces sin regalar 120 días.
  const diasRestantes = Math.ceil((club.trialEndsAt.getTime() - ahora.getTime()) / 86400000);
  if (diasRestantes > 45) {
    console.log(`  ${club.name.padEnd(45)} OMITIDO — ya tiene ${diasRestantes} dias, la promocion ya se aplico`);
    continue;
  }

  const nuevo = new Date(club.trialEndsAt);
  nuevo.setDate(nuevo.getDate() + DIAS);

  console.log(
    `  ${club.name.padEnd(45)} ${fmt(club.trialEndsAt)} (${diasRestantes}d) -> ${fmt(nuevo)} (${diasRestantes + DIAS}d)`
  );

  if (aplicar) {
    await prisma.club.update({ where: { id: club.id }, data: { trialEndsAt: nuevo } });
    aplicados++;
  }
}

console.log(aplicar ? `\nActualizados: ${aplicados}\n` : '\nSimulacion. Para escribir, repetir con --aplicar\n');
await prisma.$disconnect();
