import type { Request } from 'express';
import { prisma } from '../db/client';
import { cacheGet, cacheSet, cacheDel } from './redis';

/**
 * Las carpetas de un club y quien puede pararse en cual.
 *
 * Un club ofrece uno o varios deportes y cada uno es una carpeta aislada. El
 * dueno las ve todas y cambia entre ellas; el resto del equipo vive en una
 * sola. Aca se resuelve en cual esta parada la persona que hizo la peticion,
 * que es el dato que despues alimenta al cliente con alcance.
 */

export interface Carpeta {
  id: string;
  nombre: string;
  activo: boolean;
}

const CLAVE = (clubId: string) => `deportes:${clubId}`;

/**
 * Las carpetas del club, en el orden en que se crearon.
 *
 * Se cachea porque se consulta en cada peticion del dueno: sin cache, cambiar
 * de carpeta le costaria una consulta extra a cada llamada del dashboard.
 */
export async function deportesDelClub(clubId: string): Promise<Carpeta[]> {
  const cacheadas = await cacheGet<Carpeta[]>(CLAVE(clubId));
  if (cacheadas) return cacheadas;

  const carpetas = await prisma.deporte.findMany({
    where: { clubId },
    select: { id: true, nombre: true, activo: true },
    orderBy: { createdAt: 'asc' },
  });
  await cacheSet(CLAVE(clubId), carpetas, 600); // 10 min
  return carpetas;
}

export async function invalidarDeportes(clubId: string): Promise<void> {
  await cacheDel(CLAVE(clubId));
}

export type Resolucion =
  | { ok: true; deporteId: string; esDueno: boolean }
  | { ok: false; estado: 403 | 409; error: string };

/**
 * En que carpeta esta parada esta persona.
 *
 * `pedida` es la que mando el frontend. Al dueno se le concede si es del club y
 * esta activa; a cualquier otro se le exige que coincida con la suya, porque un
 * id de carpeta ajeno en una cabecera es justo el intento que este modelo tiene
 * que rechazar.
 */
export async function resolverCarpeta(opts: {
  clubId: string;
  userId: string;
  deporteIdDelUsuario: string | null;
  ownerUserId: string | null;
  pedida?: string;
}): Promise<Resolucion> {
  const { clubId, userId, deporteIdDelUsuario, ownerUserId, pedida } = opts;

  // El dueno se decide por lo que declara el club, no por tener la carpeta en
  // null. Si se dedujera del null, borrar un deporte o un dato mal escrito
  // convertiria a cualquiera en dueno sin que nadie lo hubiera decidido.
  const esDueno = !!ownerUserId && ownerUserId === userId;

  if (esDueno) {
    const carpetas = await deportesDelClub(clubId);
    const activas = carpetas.filter(c => c.activo);
    if (activas.length === 0) {
      return { ok: false, estado: 409, error: 'El club no tiene ningun deporte activo' };
    }
    if (pedida) {
      const elegida = activas.find(c => c.id === pedida);
      if (!elegida) return { ok: false, estado: 403, error: 'Ese deporte no es de este club o esta desactivado' };
      return { ok: true, deporteId: elegida.id, esDueno: true };
    }
    // Sin eleccion explicita se entra por la primera, que es la mas antigua:
    // en los clubes que ya existian esa es Patinaje, y ahi es donde esta todo.
    return { ok: true, deporteId: activas[0].id, esDueno: true };
  }

  if (deporteIdDelUsuario) {
    if (pedida && pedida !== deporteIdDelUsuario) {
      return { ok: false, estado: 403, error: 'No tienes acceso a ese deporte' };
    }
    return { ok: true, deporteId: deporteIdDelUsuario, esDueno: false };
  }

  // Sin carpeta propia y sin ser dueno. Pasa en los clubes que quedaron sin
  // dueno declarado porque nunca tuvieron un ADMIN. Mientras el club tenga una
  // sola carpeta no hay nada que aislar, asi que entra a esa en vez de quedarse
  // trancado por fuera de su propio club. Con dos o mas, se detiene: adivinar
  // cual le toca es justo lo que este modelo no debe hacer.
  const carpetas = (await deportesDelClub(clubId)).filter(c => c.activo);
  if (carpetas.length === 1) return { ok: true, deporteId: carpetas[0].id, esDueno: false };
  return {
    ok: false,
    estado: 409,
    error: 'Tu cuenta no esta asignada a ningun deporte. Pidele al administrador del club que te asigne uno.',
  };
}

/**
 * Error de «esta peticion no tiene carpeta». Es una clase propia y no un 500
 * generico para poder responder con un mensaje que se entienda: le pasa a una
 * cuenta que quedo sin deporte asignado, y decirle «error interno» no la ayuda
 * a resolverlo.
 */
export class SinCarpeta extends Error {
  constructor() {
    super('Tu cuenta no esta asignada a ningun deporte. Pidele al administrador del club que te asigne uno.');
    this.name = 'SinCarpeta';
  }
}

/**
 * La carpeta en la que hay que crear lo que se esta creando.
 *
 * Crear sin carpeta no existe: la fila quedaria fuera de todas y no la veria
 * nadie. Por eso esto lanza en vez de devolver vacio, y por eso el compilador
 * obliga a llamarlo en cada `create` de un modelo de carpeta.
 */
export function carpetaDe(req: Request): string {
  if (!req.deporteId) throw new SinCarpeta();
  return req.deporteId;
}

/**
 * La carpeta por defecto de un club: la primera activa, que es la mas antigua.
 *
 * La usan las rutas que actuan sobre un club sin estar paradas dentro de el —
 * el panel de superadmin agregando un administrador, por ejemplo. En los clubes
 * que vienen de antes esa carpeta es Patinaje, donde esta todo.
 */
export async function carpetaPorDefecto(clubId: string): Promise<string> {
  const activas = (await deportesDelClub(clubId)).filter(c => c.activo);
  if (activas.length === 0) throw new SinCarpeta();
  return activas[0].id;
}

/** El nombre del primer deporte de un club recien creado. */
export function primerDeporte(declarado?: string | null): string {
  const limpio = (declarado ?? '').trim();
  return limpio || 'Patinaje';
}
