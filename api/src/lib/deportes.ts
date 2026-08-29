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
  | { ok: true; deporteId: string; esDueno: boolean; puedeCambiar: boolean }
  | { ok: false; error: string };

/**
 * En que carpeta esta parada esta persona.
 *
 * `pedida` es la que mando el frontend, y es una PREFERENCIA, no una credencial:
 * si no le corresponde, se ignora y se cae en la que si — nunca se rechaza la
 * peticion. La diferencia importa. Devolver 403 ante una carpeta ajena suena
 * mas estricto, pero el aislamiento no lo da el rechazo sino lo que se resuelve:
 * pedir la carpeta de otro no la abre en ningun caso. Lo que si haria el 403 es
 * dejar a alguien trancado por fuera de su propio club por un valor viejo
 * guardado en el navegador, y sin poder ni cargar `/me` para arreglarlo.
 *
 * El intento queda en el log, que es donde sirve.
 */
export async function resolverCarpeta(opts: {
  clubId: string;
  userId: string;
  rol: string;
  deporteIdDelUsuario: string | null;
  ownerUserId: string | null;
  pedida?: string;
}): Promise<Resolucion> {
  const { clubId, userId, rol, deporteIdDelUsuario, ownerUserId, pedida } = opts;

  // El dueno se decide por lo que declara el club, no por tener la carpeta en
  // null. Si se dedujera del null, borrar un deporte o un dato mal escrito
  // convertiria a cualquiera en dueno sin que nadie lo hubiera decidido. Hoy no
  // gobierna permisos: sirve para saber a quien responde el club.
  const esDueno = !!ownerUserId && ownerUserId === userId;

  // Los deportes son cosa de los administradores, todos. Al principio esto
  // estaba reservado al dueno; con cuatro administradores en un mismo club, tres
  // no tenian forma ni de enterarse de que la funcion existia.
  const puedeCambiar = rol === 'ADMIN' || esDueno;

  if (puedeCambiar) {
    const activas = (await deportesDelClub(clubId)).filter(c => c.activo);
    if (activas.length === 0) {
      return { ok: false, error: 'El club no tiene ningun deporte activo' };
    }
    if (pedida) {
      const elegida = activas.find(c => c.id === pedida);
      if (elegida) return { ok: true, deporteId: elegida.id, esDueno, puedeCambiar };
      console.warn(JSON.stringify({
        level: 'WARN', msg: 'deporte pedido que no es del club', clubId, userId, pedida,
      }));
    }
    // Sin eleccion explicita entra por la suya, que es donde trabaja; si no
    // tiene ninguna asignada, por la mas antigua. En los clubes que ya existian
    // esa es Patinaje, y ahi es donde esta todo.
    const propia = deporteIdDelUsuario
      ? activas.find(c => c.id === deporteIdDelUsuario)
      : undefined;
    return { ok: true, deporteId: (propia ?? activas[0]).id, esDueno, puedeCambiar };
  }

  if (deporteIdDelUsuario) {
    if (pedida && pedida !== deporteIdDelUsuario) {
      console.warn(JSON.stringify({
        level: 'WARN', msg: 'deporte pedido sin ser el propio', clubId, userId, pedida,
      }));
    }
    return { ok: true, deporteId: deporteIdDelUsuario, esDueno, puedeCambiar: false };
  }

  // Sin carpeta propia y sin ser dueno. Pasa en los clubes que quedaron sin
  // dueno declarado porque nunca tuvieron un ADMIN. Mientras el club tenga una
  // sola carpeta no hay nada que aislar, asi que entra a esa en vez de quedarse
  // trancado por fuera de su propio club. Con dos o mas, se detiene: adivinar
  // cual le toca es justo lo que este modelo no debe hacer.
  const carpetas = (await deportesDelClub(clubId)).filter(c => c.activo);
  if (carpetas.length === 1) {
    return { ok: true, deporteId: carpetas[0].id, esDueno, puedeCambiar: false };
  }
  return {
    ok: false,
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

/**
 * Lo que necesita el selector de deporte para pintarse.
 *
 * Va en `/me` y no en una llamada aparte porque el dashboard ya llama a `/me`
 * en cada carga: pedir las carpetas por separado agregaria una ida y vuelta a
 * cada entrada para dibujar algo que esta arriba del menu. Los conteos NO van
 * aca — esos se piden a `/deportes` cuando el selector se abre, que es cuando
 * se ven.
 */
export async function selectorDeDeporte(req: Request): Promise<{
  lista: Carpeta[];
  activo: string | null;
  puedeCambiar: boolean;
  aviso: string | null;
}> {
  const clubId = req.user?.clubId ?? '';
  if (!clubId) {
    return { lista: [], activo: null, puedeCambiar: false, aviso: null };
  }
  const carpetas = (await deportesDelClub(clubId)).filter(c => c.activo);
  return {
    // Quien no puede cambiar ve solo la suya: la lista completa le contaria
    // cuales son los otros deportes del club, de los que no participa.
    lista: req.puedeCambiarDeporte ? carpetas : carpetas.filter(c => c.id === req.deporteId),
    activo: req.deporteId ?? null,
    puedeCambiar: !!req.puedeCambiarDeporte,
    aviso: req.sinDeporte ?? null,
  };
}
