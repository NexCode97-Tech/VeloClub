import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

/**
 * Quien esta haciendo la peticion actual.
 *
 * Vive en AsyncLocalStorage y no en una variable suelta porque el servidor
 * atiende peticiones en paralelo: una global se pisaria entre usuarios y la
 * bitacora terminaria atribuyendole a uno lo que hizo otro. AsyncLocalStorage
 * mantiene un valor distinto por cadena de ejecucion.
 *
 * Existe para que la auditoria pueda saber quien actuo sin que cada consulta
 * a la base tenga que recibir el `req` como parametro.
 */
export interface ActorPeticion {
  clerkId?: string | null;
  email?: string | null;
  nombre?: string | null;
  rol?: string | null;
  clubId?: string | null;
  ip?: string | null;
  ruta?: string | null;
}

/**
 * En que carpeta de deporte esta parada la peticion.
 *
 * Vive en el mismo AsyncLocalStorage que el actor y por la misma razon: para
 * que el filtro por deporte lo aplique el cliente de Prisma solo, sin que cada
 * consulta tenga que acordarse de recibirlo.
 *
 * Tres estados, y los tres son explicitos:
 *   - `{ deporteId }`  la peticion vive dentro de una carpeta y todo se filtra
 *   - `'club-entero'`  a proposito sin filtrar (superadmin, muro publico, cron)
 *   - sin fijar        no hay peticion de por medio (arranque, colas, scripts)
 */
export type Alcance = { deporteId: string } | 'club-entero';

const almacenAlcance = new AsyncLocalStorage<{ valor: Alcance | null }>();

const almacen = new AsyncLocalStorage<ActorPeticion>();

export function actorActual(): ActorPeticion | undefined {
  return almacen.getStore();
}

/**
 * Abre el contexto para toda la peticion. Va ANTES de las rutas pero el actor
 * se completa despues, porque `requireAuth` es quien resuelve la identidad y
 * corre mas adelante: aca solo se reserva el espacio.
 */
export function contextoPeticion(req: Request, _res: Response, next: NextFunction) {
  almacenAlcance.run({ valor: null }, () => almacen.run(
    {
      // Detras de un proxy la IP real viene en la cabecera; sin ella se
      // registraria siempre la del balanceador, que no dice nada.
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null,
      ruta: `${req.method} ${req.path}`,
    },
    () => next()
  ));
}

/** El alcance de la peticion actual, o null si no se fijo ninguno. */
export function alcanceActual(): Alcance | null {
  return almacenAlcance.getStore()?.valor ?? null;
}

/**
 * Fija la carpeta en la que vive el resto de la peticion. Lo llama
 * `requireAuth` con la carpeta que le corresponde a la persona, y el formulario
 * publico de inscripcion con la que sale del token del enlace.
 */
export function fijarAlcance(alcance: Alcance): void {
  const caja = almacenAlcance.getStore();
  if (caja) caja.valor = alcance;
}

/** Completa el actor una vez que la autenticacion resolvio quien es. */
export function fijarActor(datos: Partial<ActorPeticion>): void {
  const actual = almacen.getStore();
  if (actual) Object.assign(actual, datos);
}
