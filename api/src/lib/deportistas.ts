import { prisma } from '../db/client';
import { cacheDel } from './redis';

/**
 * Conteo de deportistas de un club.
 *
 * Existir no es lo mismo que estar activo: un deportista desactivado (vacaciones
 * de fin de ano) conserva su historial pero no se le genera cuota, no recibe
 * notificaciones y no cuenta para el precio del plan del club.
 *
 * Antes este conteo estaba repetido en nueve lugares con el mismo `where`, y
 * cualquiera que se olvidara de filtrar cobraba de mas.
 */

/**
 * Deportistas activos ahora mismo. Para mostrar en pantalla.
 *
 * Los que se inscribieron por el enlace y todavia esperan visto bueno NO
 * cuentan: no entran a la app, y cobrarle al club por gente que no ha aceptado
 * seria cobrarle por trabajo que no ha hecho.
 */
export async function contarDeportistasActivos(clubId: string): Promise<number> {
  return prisma.member.count({
    where: { clubId, role: 'STUDENT', active: true, inscripcion: 'APROBADO' },
  });
}

/**
 * El listado se cachea en dos versiones segun el alcance de datos que ve el
 * rol, asi que cualquier cambio debe invalidar ambas. Vive aca y no en la ruta
 * de miembros porque la inscripcion por enlace tambien crea deportistas.
 */
export async function invalidateMembersCache(clubId: string): Promise<void> {
  await Promise.all([
    cacheDel(`members:${clubId}:staff`),
    cacheDel(`members:${clubId}:student`),
  ]);
}

/**
 * Cantidad que manda para calcular el precio: el tope de deportistas activos
 * alcanzado en el ciclo de facturacion en curso, no el conteo del momento.
 *
 * Sin el tope, un club podria desactivar a todos la vispera del cobro, pagar el
 * tramo mas barato y reactivarlos al dia siguiente. Con el tope, una baja real
 * de deportistas se aplica en el ciclo siguiente, que es como se factura por
 * cupos en cualquier servicio por suscripcion.
 *
 * Cada llamada sube el tope si el club crecio, asi que un club que suma
 * deportistas si paga mas de inmediato: el blindaje es solo contra la baja.
 */
export async function contarDeportistasFacturables(clubId: string): Promise<number> {
  const activos = await contarDeportistasActivos(clubId);

  const suscripcion = await prisma.clubSuscripcion.findUnique({
    where: { clubId },
    select: { id: true, picoDeportistas: true },
  });

  // Un club sin suscripcion todavia (en prueba) no tiene ciclo que proteger
  if (!suscripcion) return activos;

  if (suscripcion.picoDeportistas == null || activos > suscripcion.picoDeportistas) {
    await prisma.clubSuscripcion.update({
      where: { id: suscripcion.id },
      data: { picoDeportistas: activos },
    });
    return activos;
  }

  return suscripcion.picoDeportistas;
}

/**
 * Arranca un ciclo nuevo: el tope vuelve a la cantidad real de activos.
 * Se llama al aprobarse un pago, que es lo que abre el periodo siguiente.
 */
export async function reiniciarPicoDeportistas(clubId: string): Promise<void> {
  const activos = await contarDeportistasActivos(clubId);
  await prisma.clubSuscripcion.updateMany({
    where: { clubId },
    data: { picoDeportistas: activos },
  });
}
