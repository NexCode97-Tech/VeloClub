import * as Sentry from '@sentry/node';
import { prisma } from '../db/client';
import type { DetalleComision } from './mercadopago';

/**
 * Las finanzas del negocio, no las de un club.
 *
 * Junta dos cajas que viven separadas: lo que entra por las suscripciones
 * (`SuscripcionPago`) y lo que sale por sostener la plataforma
 * (`GastoPlataforma`). Un club nunca aparece acá como gasto ni su flujo de caja
 * se mezcla con esto.
 *
 * Todo se agrega en SQL y no en el navegador: traer los pagos crudos para
 * sumarlos en el cliente funciona con nueve filas y se cae con mil.
 */

export interface MesFinanzas {
  /** aaaa-mm */
  mes: string;
  entra: number;
  sale: number;
  /** Cuántos clubes distintos pagaron ese mes. */
  clubes: number;
}

export interface GastoPorCategoria {
  categoria: string;
  monto: number;
}

export interface ClubQuePaga {
  clubId: string;
  nombre: string;
  total: number;
}

/**
 * El mes de un pago es el de `createdAt`, no el de `fecha`.
 *
 * `fecha` guarda el periodo que cubre el pago, no el día en que entró la plata:
 * un trimestre comprado en agosto puede tener fecha de octubre porque arranca
 * cuando se acaban los días de prueba. Con nueve pagos reales, cuatro tienen
 * entre 48 y 72 días de diferencia entre las dos.
 *
 * Para saber cuánto entró en un mes manda cuándo se cobró, así que `createdAt`.
 */
const MES_DEL_PAGO = 'p."createdAt"';

/** Los meses del rango, con lo que entró y lo que salió en cada uno. */
export async function mesesDe(desde: Date, hasta: Date): Promise<MesFinanzas[]> {
  const [ingresos, gastos] = await Promise.all([
    prisma.$queryRawUnsafe<{ mes: string; total: number; clubes: number }[]>(
      `SELECT to_char(${MES_DEL_PAGO}, 'YYYY-MM') AS mes,
              COALESCE(SUM(p.monto), 0)::float8   AS total,
              COUNT(DISTINCT s."clubId")::int     AS clubes
         FROM "SuscripcionPago" p
         JOIN "ClubSuscripcion" s ON s.id = p."suscripcionId"
        WHERE p.estado = 'PAID' AND ${MES_DEL_PAGO} >= $1 AND ${MES_DEL_PAGO} < $2
        GROUP BY 1`,
      desde, hasta,
    ),
    prisma.$queryRawUnsafe<{ mes: string; total: number }[]>(
      `SELECT to_char(g.fecha, 'YYYY-MM')       AS mes,
              COALESCE(SUM(g.monto), 0)::float8 AS total
         FROM "GastoPlataforma" g
        WHERE g.fecha >= $1 AND g.fecha < $2
        GROUP BY 1`,
      desde, hasta,
    ),
  ]);

  const porMes = new Map<string, MesFinanzas>();
  // Se siembran todos los meses del rango, incluso los vacíos: un mes sin
  // movimiento es información, y saltárselo deja la gráfica mintiendo sobre el
  // paso del tiempo.
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  while (cursor < hasta) {
    const clave = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    porMes.set(clave, { mes: clave, entra: 0, sale: 0, clubes: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const fila of ingresos) {
    const m = porMes.get(fila.mes);
    if (m) { m.entra = Number(fila.total); m.clubes = Number(fila.clubes); }
  }
  for (const fila of gastos) {
    const m = porMes.get(fila.mes);
    if (m) m.sale = Number(fila.total);
  }

  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/**
 * La comisión de Mercado Pago se anota sola.
 *
 * Es el único gasto que el sistema sí puede leer: la respuesta del pago trae
 * `fee_details` con lo que se queda la pasarela, así que no hay por qué
 * escribirlo a mano ni adivinar el porcentaje. Las facturas de Railway o de
 * Cloudinary siguen siendo manuales porque no llegan a ningún lado que se pueda
 * consultar.
 *
 * Solo cuenta lo que paga el cobrador (`collector`): si en algún medio la
 * comisión la asume el club, esa plata nunca salió de acá.
 *
 * Se llama desde los tres sitios donde un pago pasa a PAID —la respuesta
 * directa, el webhook y la reconciliación—, así que tiene que poder correr tres
 * veces sin duplicar nada: de eso se encarga `origen`, que es único.
 *
 * Nunca lanza. Que falle anotar la comisión no puede tumbar el cobro que la
 * originó, que es lo único que el club está esperando. Devuelve si quedó
 * anotada.
 */
export async function registrarComision(params: {
  mpPaymentId: string;
  feeDetails?: DetalleComision[] | null;
  fecha?: Date | null;
  club?: string | null;
}): Promise<boolean> {
  try {
    const monto = (params.feeDetails ?? [])
      .filter(f => f.fee_payer === 'collector')
      .reduce((suma, f) => suma + Number(f.amount || 0), 0);

    // Un pago sin comisión no es un error: Bre-B no cobra nada, y en pruebas
    // Mercado Pago a veces devuelve el arreglo vacío. Simplemente no hay gasto.
    if (monto <= 0) return false;

    await prisma.gastoPlataforma.upsert({
      where:  { origen: `mp:${params.mpPaymentId}` },
      update: { monto },
      create: {
        origen: `mp:${params.mpPaymentId}`,
        fecha: params.fecha ?? new Date(),
        monto,
        categoria: 'COMISIONES',
        descripcion: params.club
          ? `Comisión de Mercado Pago, pago de ${params.club}`
          : 'Comisión de Mercado Pago',
      },
    });
    return true;
  } catch (err) {
    console.error('[registrar-comision]', params.mpPaymentId, err instanceof Error ? err.message : err);
    Sentry.captureException(err, {
      tags: { tarea: 'registrar-comision' },
      extra: { mpPaymentId: params.mpPaymentId },
    });
    return false;
  }
}

/**
 * Barrido: le pone comisión a todo pago acreditado que todavía no la tenga.
 *
 * Es el único enganche que hace falta, y por eso no se toca ninguna de las
 * rutas de cobro. Dos razones:
 *
 * 1. Al aprobarse el pago, `fee_details` suele venir vacío: Mercado Pago la
 *    liquida un rato después. Anotarla en caliente daría cero casi siempre.
 * 2. Un pago llega a PAID desde cuatro sitios distintos. Preguntar después por
 *    los que faltan cubre los cuatro sin repetir la llamada en cada uno, y de
 *    paso recupera los pagos viejos, de antes de que esto existiera.
 *
 * Corre junto a la reconciliación de pagos pendientes, cada 20 minutos.
 */
export async function conciliarComisiones(): Promise<number> {
  const { obtenerPago } = await import('./mercadopago');

  const [pagos, yaAnotados] = await Promise.all([
    prisma.suscripcionPago.findMany({
      where: { estado: 'PAID', mpPaymentId: { not: null } },
      select: {
        mpPaymentId: true,
        createdAt: true,
        suscripcion: { select: { club: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      // Un tope por corrida: son llamadas a la API de Mercado Pago, una por
      // pago. Lo que quede afuera entra en la vuelta siguiente.
      take: 60,
    }),
    prisma.gastoPlataforma.findMany({
      where: { origen: { startsWith: 'mp:' } },
      select: { origen: true },
    }),
  ]);

  const anotados = new Set(yaAnotados.map(g => g.origen));
  let nuevos = 0;

  for (const pago of pagos) {
    if (anotados.has(`mp:${pago.mpPaymentId}`)) continue;
    try {
      const mp = await obtenerPago(String(pago.mpPaymentId));
      const anotada = await registrarComision({
        mpPaymentId: String(pago.mpPaymentId),
        feeDetails: mp.fee_details,
        // La comisión pertenece al mes en que se cobró el pago, no al periodo
        // que ese pago cubre.
        fecha: mp.date_approved ? new Date(mp.date_approved) : pago.createdAt,
        club: pago.suscripcion.club?.name ?? null,
      });
      if (anotada) nuevos++;
    } catch (err) {
      console.error('[conciliar-comisiones]', pago.mpPaymentId, err instanceof Error ? err.message : err);
    }
  }

  return nuevos;
}

/** En qué se fue la plata, dentro del rango. */
export async function gastosPorCategoria(desde: Date, hasta: Date): Promise<GastoPorCategoria[]> {
  const filas = await prisma.gastoPlataforma.groupBy({
    by: ['categoria'],
    where: { fecha: { gte: desde, lt: hasta } },
    _sum: { monto: true },
  });
  return filas
    .map(f => ({ categoria: f.categoria as string, monto: f._sum.monto ?? 0 }))
    .sort((a, b) => b.monto - a.monto);
}

/** Cuánto ha pagado cada club, desde siempre. */
export async function clubesQuePagan(): Promise<ClubQuePaga[]> {
  const filas = await prisma.$queryRaw<{ clubId: string; nombre: string; total: number }[]>`
    SELECT c.id AS "clubId", c.name AS nombre, SUM(p.monto)::float8 AS total
      FROM "SuscripcionPago" p
      JOIN "ClubSuscripcion" s ON s.id = p."suscripcionId"
      JOIN "Club" c            ON c.id = s."clubId"
     WHERE p.estado = 'PAID'
     GROUP BY c.id, c.name
     ORDER BY total DESC
  `;
  return filas.map(f => ({ ...f, total: Number(f.total) }));
}

/**
 * El ingreso mensual, normalizado.
 *
 * Un club anual paga una vez y otro mensual paga doce, así que sumar los montos
 * de los planes no dice nada. Cada uno se lleva a lo que representa por mes, y
 * eso sí se puede sumar: es lo que factura VeloClub en un mes cualquiera con
 * los clubes que hoy están al día.
 *
 * Solo cuentan los clubes activos que ya pagaron alguna vez: uno en periodo de
 * prueba todavía no es ingreso.
 */
export async function ingresoMensual(): Promise<{ monto: number; clubes: number }> {
  const suscripciones = await prisma.clubSuscripcion.findMany({
    where: {
      club: { active: true },
      pagos: { some: { estado: 'PAID' } },
    },
    select: { tipoPlan: true, planMonto: true },
  });

  const alMes = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 } as const;
  const monto = suscripciones.reduce((suma, s) => {
    const meses = alMes[s.tipoPlan as keyof typeof alMes] ?? 1;
    return suma + (s.planMonto ?? 0) / meses;
  }, 0);

  return { monto: Math.round(monto), clubes: suscripciones.length };
}

export interface PulsoDelNegocio {
  /** Toda la historia: lo que entró menos lo que salió, desde el primer día. */
  totalAcumulado: number;
  recaudadoSiempre: number;
  gastadoSiempre: number;
  /** Cuántos clubes se registran al mes, en promedio. */
  clubesNuevosPorMes: number;
  clubesTotal: number;
  clubesQuePagan: number;
  enPrueba: number;
  /** Cuánto ha dejado cada club que paga, en promedio. */
  promedioPorClub: number;
  deportistas: number;
}

/**
 * El estado del negocio, sin depender del rango que se esté mirando.
 *
 * Son las preguntas que no cambian al mover el filtro: cuánta plata hay
 * acumulada desde el primer día, a qué ritmo entran clubes, cuántos ya pagan y
 * cuántos siguen probando.
 */
export async function pulsoDelNegocio(): Promise<PulsoDelNegocio> {
  const ahora = new Date();

  const [recaudado, gastado, clubes, clubesQuePaganN, enPrueba, deportistas, primerClub] =
    await Promise.all([
      prisma.suscripcionPago.aggregate({ where: { estado: 'PAID' }, _sum: { monto: true } }),
      prisma.gastoPlataforma.aggregate({ _sum: { monto: true } }),
      prisma.club.count(),
      prisma.clubSuscripcion.count({ where: { pagos: { some: { estado: 'PAID' } } } }),
      prisma.club.count({ where: { trialEndsAt: { gt: ahora } } }),
      prisma.member.count(),
      prisma.club.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);

  const recaudadoSiempre = recaudado._sum.monto ?? 0;
  const gastadoSiempre = gastado._sum.monto ?? 0;

  // Meses transcurridos desde que se registró el primer club, contando el
  // actual. Nunca menos de uno: dividir por cero da infinito, y en el primer
  // mes de vida el promedio es sencillamente todo lo que ha entrado.
  let mesesDeVida = 1;
  if (primerClub) {
    const p = primerClub.createdAt;
    mesesDeVida = Math.max(
      1,
      (ahora.getUTCFullYear() - p.getUTCFullYear()) * 12 + (ahora.getUTCMonth() - p.getUTCMonth()) + 1,
    );
  }

  return {
    totalAcumulado: recaudadoSiempre - gastadoSiempre,
    recaudadoSiempre,
    gastadoSiempre,
    clubesNuevosPorMes: Math.round((clubes / mesesDeVida) * 10) / 10,
    clubesTotal: clubes,
    clubesQuePagan: clubesQuePaganN,
    enPrueba,
    promedioPorClub: clubesQuePaganN > 0 ? Math.round(recaudadoSiempre / clubesQuePaganN) : 0,
    deportistas,
  };
}
