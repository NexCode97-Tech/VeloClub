import { prisma } from '../db/client';

/**
 * Si a este administrador hay que lanzarle el modal de «arma tu horario».
 *
 * La regla vive aca y no en la ruta porque la decide una mezcla de estado del
 * club y estado de la persona, y tenerla partida en dos sitios es como se
 * termina mostrando el modal a quien ya lo llenó.
 *
 * Las cinco condiciones, en orden de lo que descarta mas rapido:
 *
 *   1. Es ADMIN. Un entrenador no arma el horario del club, asi que pedirselo
 *      es hacerle perder el tiempo con algo que no puede decidir.
 *   2. El club tiene sedes. Sin sedes no hay donde poner un grupo, y el modal
 *      lo unico que puede hacer es mandarlo a crearlas.
 *   3. El club no tiene ningun grupo. Con el primero hecho desaparece para
 *      siempre: los demas se agregan desde Ajustes, sin interrumpir.
 *   4. Esta persona no lo aplazo en los ultimos tres dias.
 *   5. No lo ha aplazado tres veces. A la tercera se deja de insistir y queda
 *      el aviso fijo de Inicio, que no interrumpe.
 *
 * La 3 es la que hace que la tarea sea del club y no de una persona: mientras
 * nadie la haga, el siguiente administrador que entre se la encuentra.
 */

/** Cuanto se calla despues de un «Ahora no». */
const DIAS_DE_ESPERA = 3;

/** Cuantas veces insiste antes de rendirse. */
const MAXIMO_DE_VECES = 3;

export interface EstadoPrimerHorario {
  mostrar: boolean;
  /** Para el aviso fijo de Inicio: el club lo necesita pero ya no se interrumpe. */
  pendiente: boolean;
}

export async function estadoPrimerHorario(args: {
  clubId: string | null;
  deporteId: string | undefined;
  rol: string;
  aplazadoAt: Date | null;
  aplazos: number;
}): Promise<EstadoPrimerHorario> {
  const APAGADO = { mostrar: false, pendiente: false };

  if (args.rol !== 'ADMIN' || !args.clubId) return APAGADO;

  // Las dos consultas se acotan a la carpeta activa: un club con patinaje
  // armado y natacion recien abierta necesita el modal en natacion, y
  // preguntarlo por club entero lo daria por hecho.
  const [sedes, grupos] = await Promise.all([
    prisma.location.count({ where: { clubId: args.clubId, ...(args.deporteId ? { deporteId: args.deporteId } : {}) } }),
    prisma.grupo.count({ where: { clubId: args.clubId, ...(args.deporteId ? { deporteId: args.deporteId } : {}) } }),
  ]);

  // Sin sedes el modal no tiene nada que ofrecer, y tampoco hay nada pendiente
  // que avisar: lo que falta es la sede, y de eso avisa el modulo de Sedes.
  if (sedes === 0) return APAGADO;

  // Ya lo hizo alguien. Se acabo para este club y esta carpeta.
  if (grupos > 0) return APAGADO;

  if (args.aplazos >= MAXIMO_DE_VECES) return { mostrar: false, pendiente: true };

  if (args.aplazadoAt) {
    const espera = DIAS_DE_ESPERA * 24 * 60 * 60 * 1000;
    if (Date.now() - args.aplazadoAt.getTime() < espera) {
      return { mostrar: false, pendiente: true };
    }
  }

  return { mostrar: true, pendiente: true };
}
