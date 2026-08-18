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
  almacen.run(
    {
      // Detras de un proxy la IP real viene en la cabecera; sin ella se
      // registraria siempre la del balanceador, que no dice nada.
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? null,
      ruta: `${req.method} ${req.path}`,
    },
    () => next()
  );
}

/** Completa el actor una vez que la autenticacion resolvio quien es. */
export function fijarActor(datos: Partial<ActorPeticion>): void {
  const actual = almacen.getStore();
  if (actual) Object.assign(actual, datos);
}
