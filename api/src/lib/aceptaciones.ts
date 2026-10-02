import type { Request } from 'express';
import { prisma } from '../db/client';
import type { OrigenAceptacion } from '@prisma/client';

/**
 * La bitácora de aceptaciones legales.
 *
 * `User.termsAcceptedAt` no sirve como prueba: es un solo campo y se
 * sobrescribe, así que al cambiar el documento la aceptación anterior
 * desaparece y no queda rastro de qué se aceptó. Lo que se enseña cuando
 * alguien pregunta es la tabla `AceptacionLegal`, que solo crece.
 */

/**
 * La versión vigente de los documentos legales, en fecha.
 *
 * **Subirla obliga a todo el mundo a aceptar de nuevo**, porque la compuerta
 * compara contra `User.terminosVersion`. Se sube cuando cambia algo que a la
 * persona le importaría, no cuando se corrige una coma: pedirle a veinte clubes
 * que firmen otra vez por un arreglo de redacción gasta la única señal que
 * tenemos para decir «esto sí cambió».
 *
 * El texto de cada versión queda congelado en `docs/legal/` dentro del
 * repositorio, así que siempre se puede recuperar qué decía la que alguien
 * aceptó.
 */
export const VERSION_DOCUMENTOS = '2026-09-24';

export interface DatosAceptacion {
  userId?: string | null;
  titularNombre: string;
  titularEmail: string;
  clubId?: string | null;
  clubNombre?: string | null;
  aceptoTerminos: boolean;
  autorizoDatos: boolean;
  origen: OrigenAceptacion;
  /** Cuando el titular es menor de edad, quién autorizó en su nombre. */
  porMenor?: boolean;
  autorizanteNombre?: string | null;
  autorizanteDoc?: string | null;
}

/**
 * De dónde vino la petición.
 *
 * Detrás de Railway y de Vercel la IP del socket es la del proxy, así que la
 * real viene en `X-Forwarded-For` y es la primera de la lista. Se guarda porque
 * es parte de lo que hace creíble un consentimiento, no para perfilar a nadie.
 */
function rastro(req: Request): { ip: string | null; navegador: string | null } {
  const reenviada = req.headers['x-forwarded-for'];
  const cadena = Array.isArray(reenviada) ? reenviada[0] : reenviada;
  const ip = (cadena?.split(',')[0].trim() || req.ip || '').slice(0, 45) || null;
  const agente = req.headers['user-agent'];
  return { ip, navegador: agente ? agente.slice(0, 300) : null };
}

/**
 * Deja constancia de una aceptación. No actualiza nada, agrega una fila.
 *
 * Nunca lanza: una aceptación que ya ocurrió no se puede deshacer porque falle
 * el registro, y devolverle un error a alguien que sí aceptó lo dejaría fuera
 * de su cuenta. Si la escritura falla, se anota en el log y se sigue; perder
 * una constancia es malo, pero trancar a la persona es peor y además no
 * recupera la constancia.
 */
export async function registrarAceptacion(
  req: Request,
  datos: DatosAceptacion,
): Promise<void> {
  const { ip, navegador } = rastro(req);
  try {
    await prisma.aceptacionLegal.create({
      data: {
        userId: datos.userId ?? null,
        titularNombre: datos.titularNombre,
        titularEmail: datos.titularEmail,
        clubId: datos.clubId ?? null,
        clubNombre: datos.clubNombre ?? null,
        aceptoTerminos: datos.aceptoTerminos,
        autorizoDatos: datos.autorizoDatos,
        version: VERSION_DOCUMENTOS,
        porMenor: datos.porMenor ?? false,
        autorizanteNombre: datos.autorizanteNombre ?? null,
        autorizanteDoc: datos.autorizanteDoc ?? null,
        ip,
        navegador,
        origen: datos.origen,
      },
    });
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR',
      msg: 'No se pudo registrar la aceptacion legal',
      titular: datos.titularEmail,
      origen: datos.origen,
      err: err instanceof Error ? err.message : String(err),
    }));
  }
}

/** Si a esta persona hay que volver a pedirle la aceptación. */
export function debeAceptar(terminosVersion: string | null | undefined): boolean {
  return terminosVersion !== VERSION_DOCUMENTOS;
}
