/**
 * Prueba de aislamiento entre deportes, contra una base de verdad.
 *
 * Va aparte de `npm test` a proposito: las demas pruebas simulan la base, y
 * esta necesita una real porque lo que comprueba es justamente el filtro que
 * aplica el cliente de Prisma, que con un doble no existiria.
 *
 * Como correrla, contra una base de ENSAYO — nunca contra produccion:
 *
 *   createdb veloclub_ensayo
 *   DATABASE_URL=<la de ensayo> npx prisma migrate deploy
 *   DATABASE_URL=<la de ensayo> npx tsx scripts/prueba-aislamiento.ts
 *
 * Crea sus propios datos inventados y los borra al terminar.
 */
import { prisma, prismaClubEntero } from '../src/db/client';
import { contextoPeticion, fijarAlcance } from '../src/lib/contexto-peticion';
import type { Request, Response } from 'express';

let fallos = 0;
function comprobar(que: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${que}  (esperado ${JSON.stringify(esperado)}, salio ${JSON.stringify(real)})`);
}

/** Corre algo como si fuera una peticion parada en esa carpeta. */
function enLaCarpeta<T>(deporteId: string | null, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = { headers: {}, ip: '127.0.0.1', method: 'GET', path: '/prueba' } as unknown as Request;
    contextoPeticion(req, {} as Response, () => {
      if (deporteId) fijarAlcance({ deporteId });
      else fijarAlcance('club-entero');
      fn().then(resolve, reject);
    });
  });
}

async function main() {
  // ── Montaje: un club con dos carpetas y otro club aparte ──────────────────
  const club = await prismaClubEntero.club.create({
    data: { name: 'Club De Prueba', deportes: { create: [{ nombre: 'Patinaje' }, { nombre: 'Natacion' }] } },
    include: { deportes: { orderBy: { createdAt: 'asc' } } },
  });
  const [patinaje, natacion] = club.deportes;

  const otro = await prismaClubEntero.club.create({
    data: { name: 'Otro Club', deportes: { create: [{ nombre: 'Patinaje' }] } },
    include: { deportes: true },
  });

  await prismaClubEntero.member.createMany({
    data: [
      ...Array.from({ length: 5 }, (_, i) => ({ clubId: club.id, deporteId: patinaje.id, fullName: `Patinador ${i}`, role: 'DEPORTISTA' as const })),
      ...Array.from({ length: 3 }, (_, i) => ({ clubId: club.id, deporteId: natacion.id, fullName: `Nadador ${i}`, role: 'DEPORTISTA' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ clubId: otro.id, deporteId: otro.deportes[0].id, fullName: `Ajeno ${i}`, role: 'DEPORTISTA' as const })),
    ],
  });
  await prismaClubEntero.location.createMany({
    data: [
      { clubId: club.id, deporteId: patinaje.id, name: 'Pista Norte' },
      { clubId: club.id, deporteId: patinaje.id, name: 'Pista Sur' },
      { clubId: club.id, deporteId: natacion.id, name: 'Piscina' },
    ],
  });

  console.log('\n— Leer estando parado en cada carpeta —');
  await enLaCarpeta(patinaje.id, async () => {
    comprobar('deportistas que ve patinaje', await prisma.member.count({ where: { clubId: club.id } }), 5);
    comprobar('sedes que ve patinaje',       await prisma.location.count({ where: { clubId: club.id } }), 2);
  });
  await enLaCarpeta(natacion.id, async () => {
    comprobar('deportistas que ve natacion', await prisma.member.count({ where: { clubId: club.id } }), 3);
    comprobar('sedes que ve natacion',       await prisma.location.count({ where: { clubId: club.id } }), 1);
  });

  console.log('\n— Pedir por id un registro de la otra carpeta —');
  const unNadador = await prismaClubEntero.member.findFirstOrThrow({ where: { deporteId: natacion.id } });
  await enLaCarpeta(patinaje.id, async () => {
    comprobar('findUnique del nadador desde patinaje',
      await prisma.member.findUnique({ where: { id: unNadador.id } }), null);
    comprobar('findFirst del nadador desde patinaje',
      await prisma.member.findFirst({ where: { id: unNadador.id } }), null);
  });

  console.log('\n— Filtros que podrian colarse por un OR —');
  await enLaCarpeta(patinaje.id, async () => {
    const conOr = await prisma.member.count({
      where: { OR: [{ fullName: { contains: 'Patinador' } }, { fullName: { contains: 'Nadador' } }] },
    });
    comprobar('un OR no abre la otra carpeta', conOr, 5);
  });

  console.log('\n— Escribir —');
  await enLaCarpeta(natacion.id, async () => {
    const m = await prisma.member.create({ data: { clubId: club.id, fullName: 'Nadador Nuevo', role: 'DEPORTISTA' } });
    comprobar('el creado nace en la carpeta activa', m.deporteId, natacion.id);
  });

  console.log('\n— Borrar en masa desde una carpeta —');
  await enLaCarpeta(natacion.id, async () => {
    await prisma.member.deleteMany({ where: { clubId: club.id } });
  });
  comprobar('natacion quedo vacia',
    await prismaClubEntero.member.count({ where: { deporteId: natacion.id } }), 0);
  comprobar('patinaje sigue intacto',
    await prismaClubEntero.member.count({ where: { deporteId: patinaje.id } }), 5);
  comprobar('el otro club ni se entero',
    await prismaClubEntero.member.count({ where: { clubId: otro.id } }), 7);

  console.log('\n— Actualizar en masa —');
  await enLaCarpeta(patinaje.id, async () => {
    await prisma.member.updateMany({ where: { clubId: club.id }, data: { active: false } });
  });
  comprobar('solo se desactivo patinaje',
    await prismaClubEntero.member.count({ where: { clubId: otro.id, active: true } }), 7);

  console.log('\n— Club entero: el conteo que define el precio —');
  await prismaClubEntero.member.createMany({
    data: Array.from({ length: 4 }, (_, i) => ({ clubId: club.id, deporteId: natacion.id, fullName: `Nadador B${i}`, role: 'DEPORTISTA' as const })),
  });
  await enLaCarpeta(patinaje.id, async () => {
    const acotado = await prisma.member.count({ where: { clubId: club.id, role: 'DEPORTISTA', active: true } });
    const entero  = await prismaClubEntero.member.count({ where: { clubId: club.id, role: 'DEPORTISTA', active: true } });
    comprobar('parado en patinaje se ven 0 activos (los desactive arriba)', acotado, 0);
    comprobar('el club entero suma los 4 de natacion', entero, 4);
  });

  console.log('\n— Sin alcance fijado (cron, colas, scripts) —');
  const sinContexto = await prisma.member.count({ where: { clubId: club.id } });
  comprobar('fuera de una peticion se ve todo el club', sinContexto, 9);

  // ── Limpieza ─────────────────────────────────────────────────────────────
  await prismaClubEntero.club.deleteMany({ where: { id: { in: [club.id, otro.id] } } });

  console.log(`\n${fallos === 0 ? 'TODO BIEN' : fallos + ' PRUEBAS FALLARON'}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
