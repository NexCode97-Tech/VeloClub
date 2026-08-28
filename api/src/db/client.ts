import { PrismaClient } from '@prisma/client';
import { extensionAuditoria } from '../lib/auditoria';
import { extensionAlcance } from '../lib/alcance';

const globalForPrisma = globalThis as unknown as {
  cliente: ReturnType<typeof crear> | undefined;
};

function crear() {
  // Las dos extensiones van aca y no en cada endpoint: instrumentar las rutas a
  // mano significa olvidarse de la proxima que alguien agregue, y tanto una
  // bitacora con huecos como un aislamiento con huecos dan una falsa sensacion
  // de control. Montadas en el cliente, no hay forma de escribir sin quedar
  // registrado ni de consultar sin quedar acotado al deporte.
  //
  // El orden importa: `alcance` se aplica de ultimo, asi que envuelve a
  // `auditoria` y esta ve los argumentos ya filtrados — la bitacora registra lo
  // que de verdad se ejecuto, no lo que la ruta pidio antes de acotarse.
  const auditado = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  }).$extends(extensionAuditoria());

  // `$extends` devuelve un envoltorio sobre el mismo cliente, no otro: los dos
  // comparten la misma reserva de conexiones.
  return { auditado, acotado: auditado.$extends(extensionAlcance()) };
}

const cliente = globalForPrisma.cliente ?? crear();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.cliente = cliente;
}

/** El de siempre. Filtra por la carpeta de deporte de la peticion. */
export const prisma = cliente.acotado;

/**
 * El mismo cliente pero SIN el filtro por deporte.
 *
 * Es la salida de emergencia, y esta separada justo para que se note cuando se
 * usa: `grep prismaClubEntero` muestra, en una sola lista, cada consulta que a
 * proposito mira el club completo. Revisar el aislamiento es revisar esa lista.
 *
 * Va donde la pregunta es del club y no del deporte. El caso que la obligo:
 * cuantos deportistas tiene el club, que es lo que define el precio del plan.
 * El club paga por la suma de todos sus deportes, asi que contarlo acotado a
 * una carpeta le cobraria de menos y nadie se enteraria.
 *
 * Ojo: sigue auditado. Lo unico que se salta es el deporte, no la bitacora.
 */
export const prismaClubEntero = cliente.auditado;
