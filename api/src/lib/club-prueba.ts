/**
 * Clubes de prueba: clubes inventados dentro de producción.
 *
 * Existen para entrar a la plataforma real con cuentas propias (administrador,
 * entrenador y deportista) y datos falsos, sin pasarse a la demo. El problema
 * no es que el club de prueba vea datos ajenos, eso ya lo impide `clubId`. Es
 * al revés: cuatro sitios cruzan clubes a propósito (el muro público, los
 * perfiles, el buscador y los seguidores) y ahí el club inventado les
 * aparecería a los clientes reales.
 *
 * La regla es una burbuja. Un club de prueba solo ve lo suyo en esos cuatro
 * sitios, nadie de afuera lo ve a él, y no entra en ninguna cifra del negocio
 * (pulso, uso por club, suscripciones). Cualquier cruce entre los dos lados se
 * responde como si la cosa no existiera.
 *
 * Los cobros no necesitan filtro: un club de prueba se crea sin suscripción y
 * sin fecha de fin de prueba, y en ese estado no lo toca ni la renovación ni
 * los avisos ni la desactivación por vencimiento (ver `/me` y `trial.ts`).
 * Lo único que se cierra a mano es el checkout, para que nadie le pague.
 */
import type { NextFunction, Request, Response } from 'express';
import { prismaClubEntero } from '../db/client';

/** Filtro de Prisma para quedarse solo con los clubes reales. */
export const CLUB_REAL = { esPrueba: false } as const;

/** De qué lado de la frontera está alguien: su club y si ese club es de prueba. */
export interface Lado {
  clubId: string | null;
  esPrueba: boolean;
}

/**
 * Si dos lados no deben verse. Dentro de un mismo club nunca hay frontera. Entre
 * clubes distintos la hay en cuanto uno de los dos es de prueba, incluso si los
 * dos lo son: cada club de prueba es su propia burbuja.
 */
export function cruzaLaFrontera(a: Lado, b: Lado): boolean {
  if (a.clubId && a.clubId === b.clubId) return false;
  return a.esPrueba || b.esPrueba;
}

/**
 * Filtro para una consulta sobre algo que cuelga de un club (publicaciones,
 * deportistas): quien está en un club de prueba solo ve su club; los demás
 * ven todos los clubes reales.
 */
export function soloSuLado(visitante: Lado): { clubId: string } | { club: typeof CLUB_REAL } {
  if (visitante.esPrueba) return { clubId: visitante.clubId ?? '__sin_club__' };
  return { club: CLUB_REAL };
}

/** El lado de un club por su id. Sin club es el lado real. */
export async function ladoDe(clubId: string | null | undefined): Promise<Lado> {
  if (!clubId) return { clubId: null, esPrueba: false };
  const club = await prismaClubEntero.club.findUnique({
    where: { id: clubId },
    select: { esPrueba: true },
  });
  return { clubId, esPrueba: club?.esPrueba ?? false };
}

/**
 * El lado de quien hace la petición. El staff trae su club en `req.user`; el
 * deportista no tiene fila en User, así que su club sale de su ficha.
 */
export async function ladoDelVisitante(req: Request): Promise<Lado> {
  if (req.user?.clubId) return ladoDe(req.user.clubId);
  const clerkId = req.auth?.clerkId;
  if (!clerkId) return { clubId: null, esPrueba: false };
  const ficha = await prismaClubEntero.member.findFirst({
    where: { clerkId },
    select: { clubId: true },
  });
  return ladoDe(ficha?.clubId ?? null);
}

/** El lado de una persona por su clerkId: staff primero, después deportista. */
export async function ladoDePersona(clerkId: string): Promise<Lado> {
  const staff = await prismaClubEntero.user.findUnique({ where: { clerkId }, select: { clubId: true } });
  if (staff) return ladoDe(staff.clubId);
  const ficha = await prismaClubEntero.member.findFirst({ where: { clerkId }, select: { clubId: true } });
  return ladoDe(ficha?.clubId ?? null);
}

/**
 * Corta cualquier cobro de suscripción a un club de prueba. Va después de
 * requireAuth en las rutas que arrancan un pago: un club inventado no paga, y
 * si alguien lo intentara por error quedaría plata real amarrada a datos
 * falsos.
 */
export async function rechazarClubDePrueba(req: Request, res: Response, next: NextFunction) {
  const lado = await ladoDelVisitante(req);
  if (lado.esPrueba) {
    return res.status(403).json({ error: 'Este es un club de prueba y no maneja pagos.' });
  }
  next();
}
