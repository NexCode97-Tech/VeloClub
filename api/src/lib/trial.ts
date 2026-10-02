import { prisma } from '../db/client';
import { notifyClubStaff } from './notify';

/**
 * El aviso de que se acaba el periodo de prueba.
 *
 * Existe porque no existía. `recordarVencimientosProximos` arranca de la tabla
 * de suscripciones, así que solo le habla a quien ya intentó pagar alguna vez;
 * y `desactivarClubesVencidos` filtra por lo mismo. Un club que entró, usó la
 * plataforma dos meses y nunca abrió el flujo de pago no recibía ningún aviso
 * ni se le cerraba nada: el trial era un campo en la base que no hacía nada.
 *
 * El 1 de octubre de 2026 había cinco clubes así, con 456 deportistas entre
 * todos, usando la plataforma gratis sin que nadie se enterara, ellos incluidos.
 *
 * Esto solo avisa. **No corta.** Cortarle el acceso a un club que nunca fue
 * avisado no cobra, expulsa, y el que tiene doscientas fichas adentro no saca
 * la tarjeta, se va. El corte es un paso posterior y va con días de gracia.
 */

/** A cuántos días del final se avisa. De mayor a menor, que es como se cruzan. */
const HITOS = [7, 3, 0] as const;

/** Días que faltan para una fecha, contando el día de hoy como cero. */
function diasHasta(fecha: Date, ahora: Date): number {
  const unDia = 24 * 60 * 60 * 1000;
  const finDelDia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((finDelDia(fecha) - finDelDia(ahora)) / unDia);
}

/**
 * Qué aviso le toca a un club, o `null` si todavía no le toca ninguno.
 *
 * Devuelve el hito más cercano que ya se alcanzó: a cinco días del final el
 * hito vigente sigue siendo el de siete, porque es el que corresponde avisar y
 * puede que no se haya mandado. A tres días pasa a ser el de tres. Vencido o no,
 * el último es el de cero: después de ese no se insiste más.
 */
export function hitoQueCorresponde(diasRestantes: number): number | null {
  const alcanzados = HITOS.filter(h => diasRestantes <= h);
  return alcanzados.length > 0 ? Math.min(...alcanzados) : null;
}

/** El texto del aviso, según lo que falte. */
export function textoDelAviso(hito: number, diasRestantes: number): { titulo: string; cuerpo: string } {
  if (diasRestantes < 0) {
    return {
      titulo: 'Se acabó tu prueba de VeloClub',
      cuerpo: 'Tus datos siguen acá y nadie los ha tocado. Activa tu plan desde Ajustes para seguir trabajando con normalidad.',
    };
  }
  if (hito === 0) {
    return {
      titulo: 'Tu prueba de VeloClub termina hoy',
      cuerpo: 'Activa tu plan desde Ajustes para no quedarte por fuera.',
    };
  }
  return {
    titulo: `Tu prueba de VeloClub termina en ${hito} día${hito === 1 ? '' : 's'}`,
    cuerpo: 'Activa tu plan desde Ajustes cuando quieras. Lo que ya registraste se queda.',
  };
}

/**
 * Recorre los clubes en prueba y avisa al que le toque.
 *
 * Solo mira clubes **sin suscripción**: el que ya tiene una la cubre
 * `recordarVencimientosProximos`, y recibir los dos avisos sería peor que no
 * recibir ninguno.
 *
 * El último hito avisado queda guardado en el club, así que esto puede correr
 * todos los días sin repetirle a nadie. Repetir es lo que entrena a la gente a
 * ignorar los avisos.
 */
export async function avisarTrialesPorVencer(ahora = new Date()): Promise<{ avisados: number }> {
  const enPrueba = await prisma.club.findMany({
    where: {
      active: true,
      trialEndsAt: { not: null },
      suscripcion: { is: null },
    },
    select: { id: true, name: true, trialEndsAt: true, trialUltimoAviso: true },
  });

  let avisados = 0;
  for (const club of enPrueba) {
    try {
      if (!club.trialEndsAt) continue;

      const faltan = diasHasta(club.trialEndsAt, ahora);
      const hito = hitoQueCorresponde(faltan);
      if (hito === null) continue;

      // Ya se le mandó este aviso o uno más cercano al final.
      if (club.trialUltimoAviso !== null && club.trialUltimoAviso <= hito) continue;

      const { titulo, cuerpo } = textoDelAviso(hito, faltan);
      await notifyClubStaff(club.id, {
        tipo: 'TRIAL_POR_VENCER',
        titulo,
        cuerpo,
        link: '/ajustes',
      });
      await prisma.club.update({
        where: { id: club.id },
        data: { trialUltimoAviso: hito },
      });
      avisados++;
    } catch (err) {
      console.error(`[trial-por-vencer] club ${club.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[trial-por-vencer] ${avisados} clubes avisados`);
  return { avisados };
}
