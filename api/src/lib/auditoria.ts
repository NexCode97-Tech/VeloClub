import type { Request } from 'express';
import { prisma } from '../db/client';

/**
 * Acciones que se registran. Es una lista cerrada a proposito: un texto libre
 * termina con cinco variantes de lo mismo y la bitacora deja de poder filtrarse.
 */
export type AccionAuditada =
  | 'CLUB_ELIMINADO'
  | 'CLUB_DESACTIVADO'
  | 'CLUB_ACTIVADO'
  | 'CLUB_VERIFICADO'
  | 'CLUB_RECHAZADO'
  | 'MIEMBRO_ELIMINADO'
  | 'MIEMBRO_PAUSADO'
  | 'MIEMBRO_REACTIVADO'
  | 'ROL_CAMBIADO'
  | 'PAGO_ELIMINADO'
  | 'MOVIMIENTO_ELIMINADO'
  | 'CONTENIDO_RETIRADO'
  | 'SUSCRIPCION_MODIFICADA';

interface Entrada {
  accion: AccionAuditada;
  entidad: string;
  entidadId?: string | null;
  resumen: string;
  clubId?: string | null;
  clubNombre?: string | null;
  /** Copia de lo borrado, o el antes/despues de un cambio */
  datos?: unknown;
}

/**
 * Deja constancia de una accion irreversible.
 *
 * Nunca lanza. Si el registro falla, la operacion principal sigue su curso: un
 * problema al auditar no puede impedirle a un administrador hacer su trabajo.
 * El costo de esa decision es que un fallo de base podria dejar un hueco en la
 * bitacora, y por eso se escribe en consola cuando pasa.
 */
export async function auditar(req: Request, entrada: Entrada): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        accion:    entrada.accion,
        entidad:   entrada.entidad,
        entidadId: entrada.entidadId ?? null,
        resumen:   entrada.resumen,
        // Se copian nombre y correo, no se referencian: si la cuenta del actor
        // se borra despues, el registro tiene que seguir diciendo quien fue.
        actorClerkId: req.auth?.clerkId ?? null,
        actorEmail:   req.auth?.email   ?? null,
        actorNombre:  req.auth?.name    ?? null,
        actorRol:     req.user?.role    ?? null,
        clubId:      entrada.clubId     ?? null,
        clubNombre:  entrada.clubNombre ?? null,
        datos:       (entrada.datos ?? undefined) as never,
        // Detras de un proxy la IP real viene en la cabecera; sin ella se
        // registraria siempre la del balanceador, que no dice nada.
        ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
            ?? req.ip
            ?? null,
      },
    });
  } catch (err) {
    console.error('[auditoria] no se pudo registrar', entrada.accion, err);
  }
}
