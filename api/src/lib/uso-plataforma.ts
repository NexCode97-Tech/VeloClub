import * as Sentry from '@sentry/node';
import { createClerkClient } from '@clerk/backend';
import { prisma } from '../db/client';

/**
 * Qué tanto usa cada club la plataforma.
 *
 * No es un módulo de negocio del club: es para el superadmin, que necesita
 * saber quién se está enfriando antes de que llegue la renovación y quién
 * nunca llegó a arrancar. Un club que dejó de entrar hace tres semanas no
 * renueva, y hoy eso no se ve en ninguna pantalla.
 *
 * La señal principal es **la asistencia tomada**, no el número de registros.
 * Tomar asistencia es lo que un club hace si de verdad está usando la app:
 * pasa todos los días de entrenamiento y no depende de que alguien se acuerde
 * de registrar algo. Las demás señales acompañan.
 *
 * Nada de esto ordena por tamaño. Grandes Paisas con 221 deportistas y cero
 * actividad importa más que un club de treinta que entra a diario, y un
 * ranking por volumen lo habría dejado arriba pareciendo sano.
 */

/** Doce semanas: un trimestre, que es el ciclo de renovación más largo. */
const SEMANAS = 12;
const DIAS_VENTANA = SEMANAS * 7;

/**
 * Los cortes de aviso, en días sin actividad.
 *
 * Siete es una semana: un club puede saltarse una sin que pase nada, porque
 * hay puentes y semanas de receso. Catorce ya no se explica solo.
 */
const DIAS_TIBIO = 7;
const DIAS_FRIO  = 14;

/** Clerk acepta listas largas, pero se pide por tandas para no armar una URL enorme. */
const TANDA_CLERK = 100;

export type EstadoDeUso = 'activo' | 'enfriandose' | 'inactivo' | 'sin_arrancar';

export interface UsoDeClub {
  clubId: string;
  nombre: string;
  activo: boolean;
  /** Deportistas activos. Es el tamaño del club, no una medida de uso. */
  deportistas: number;
  /** Días distintos con al menos una asistencia tomada, dentro de la ventana. */
  diasActivos: number;
  /** Escrituras de negocio en la bitácora: pagos, miembros, resultados, muro. */
  acciones: number;
  /** Último día con asistencia, en `aaaa-mm-dd`. Null si nunca tomaron. */
  ultimaAsistencia: string | null;
  /** Doce semanas de días activos, de la más vieja a la más reciente. */
  semanas: number[];
  /** Personas del club que entraron a la app en los últimos siete días. */
  personasActivas: number;
  /** El ingreso más reciente de cualquiera del club, en milisegundos. */
  ultimoIngreso: number | null;
  /** Días desde la última señal de vida, sea asistencia o ingreso. */
  diasSinUsar: number | null;
  estado: EstadoDeUso;
}

export interface ResumenDeUso {
  clubes: UsoDeClub[];
  totales: {
    conActividad: number;
    total: number;
    enRiesgo: number;
    sinArrancar: number;
    acciones: number;
  };
  /** Días con asistencia por semana, sumando todos los clubes. */
  serie: { semana: string; dias: number }[];
  /**
   * Si Clerk respondió. Cuando es false las columnas de ingresos vienen en
   * null y la pantalla lo dice, en vez de mostrar ceros que parecen datos.
   */
  ingresosDisponibles: boolean;
}

/** La medianoche de hace `dias` días, para cortar la ventana. */
function desdeHace(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - dias);
  return d;
}

function aFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / 86_400_000);
}

/**
 * El último ingreso de cada club, preguntándole a Clerk.
 *
 * Los ingresos no quedan en nuestra base: Clerk los guarda en `lastActiveAt`
 * de cada persona. Se piden **en bloque** con la lista de ids y no uno por
 * uno, que con doscientas cuentas serían doscientas llamadas.
 *
 * Si Clerk falla no se cae la pantalla: se devuelve vacío y el resto de las
 * señales, que salen de nuestra base, siguen sirviendo. Un panel interno no
 * puede quedar inservible porque un tercero esté caído.
 */
async function ingresosPorClub(
  staff: { clerkId: string; clubId: string | null }[],
): Promise<{ porClub: Map<string, { ultimo: number; activos: number }>; ok: boolean }> {
  const porClub = new Map<string, { ultimo: number; activos: number }>();
  const conClub = staff.filter(s => s.clubId);
  if (conClub.length === 0) return { porClub, ok: true };

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const clubDe = new Map(conClub.map(s => [s.clerkId, s.clubId!]));
  const corte = Date.now() - DIAS_TIBIO * 86_400_000;

  try {
    for (let i = 0; i < conClub.length; i += TANDA_CLERK) {
      const ids = conClub.slice(i, i + TANDA_CLERK).map(s => s.clerkId);
      const { data } = await clerk.users.getUserList({ userId: ids, limit: TANDA_CLERK });

      for (const u of data) {
        const clubId = clubDe.get(u.id);
        if (!clubId || u.lastActiveAt == null) continue;
        const actual = porClub.get(clubId) ?? { ultimo: 0, activos: 0 };
        actual.ultimo = Math.max(actual.ultimo, u.lastActiveAt);
        if (u.lastActiveAt >= corte) actual.activos += 1;
        porClub.set(clubId, actual);
      }
    }
    return { porClub, ok: true };
  } catch (err) {
    // Se reporta pero no se relanza: el resto del panel sigue en pie.
    Sentry.captureException(err, { tags: { modulo: 'uso-plataforma' } });
    return { porClub: new Map(), ok: false };
  }
}

export async function usoPorClub(): Promise<ResumenDeUso> {
  const desde = desdeHace(DIAS_VENTANA);
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  const [clubes, deportistas, asistencias, acciones, staff] = await Promise.all([
    prisma.club.findMany({
      select: { id: true, name: true, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.member.groupBy({
      by: ['clubId'],
      where: { active: true, role: 'DEPORTISTA' },
      _count: { _all: true },
    }),
    // Un club puede tener sesenta asistencias en un día; lo que importa es el
    // día, no cuántas. Se agrupa en SQL para no traer miles de filas y contar
    // días distintos en el navegador.
    prisma.attendance.groupBy({
      by: ['clubId', 'date'],
      where: { date: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.auditoria.groupBy({
      by: ['clubId'],
      where: { createdAt: { gte: desde }, clubId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { clubId: { not: null } },
      select: { clerkId: true, clubId: true },
    }),
  ]);

  const { porClub: ingresos, ok: ingresosDisponibles } = await ingresosPorClub(staff);

  const nDeportistas = new Map(deportistas.map(d => [d.clubId, d._count._all]));
  const nAcciones = new Map(acciones.map(a => [a.clubId!, a._count._all]));

  // Días de asistencia por club, y en qué semana cae cada uno.
  const diasDe = new Map<string, Date[]>();
  for (const a of asistencias) {
    const lista = diasDe.get(a.clubId) ?? [];
    lista.push(a.date);
    diasDe.set(a.clubId, lista);
  }

  const serieGlobal = new Array<number>(SEMANAS).fill(0);

  const resultado: UsoDeClub[] = clubes.map(c => {
    const dias = (diasDe.get(c.id) ?? []).sort((a, b) => a.getTime() - b.getTime());
    const semanas = new Array<number>(SEMANAS).fill(0);

    for (const d of dias) {
      // Semana 0 es la más vieja de la ventana, SEMANAS-1 la actual.
      const i = Math.min(SEMANAS - 1, Math.floor(diasEntre(desde, d) / 7));
      if (i >= 0) { semanas[i] += 1; serieGlobal[i] += 1; }
    }

    const ultimaFecha = dias.length ? dias[dias.length - 1] : null;
    const ingreso = ingresos.get(c.id) ?? null;

    // La última señal de vida es la más reciente entre tomar asistencia y
    // entrar a la app. Un club puede estar revisando pagos sin entrenar, y eso
    // sigue siendo uso.
    const marcas: number[] = [];
    if (ultimaFecha) marcas.push(ultimaFecha.getTime());
    if (ingreso?.ultimo) marcas.push(ingreso.ultimo);
    const ultimaSenal = marcas.length ? Math.max(...marcas) : null;
    const diasSinUsar = ultimaSenal === null
      ? null
      : Math.max(0, Math.floor((Date.now() - ultimaSenal) / 86_400_000));

    let estado: EstadoDeUso;
    if (ultimaSenal === null)            estado = 'sin_arrancar';
    else if (diasSinUsar! <= DIAS_TIBIO) estado = 'activo';
    else if (diasSinUsar! <= DIAS_FRIO)  estado = 'enfriandose';
    else                                 estado = 'inactivo';

    return {
      clubId: c.id,
      nombre: c.name,
      activo: c.active,
      deportistas: nDeportistas.get(c.id) ?? 0,
      diasActivos: dias.length,
      acciones: nAcciones.get(c.id) ?? 0,
      ultimaAsistencia: ultimaFecha ? aFecha(ultimaFecha) : null,
      semanas,
      personasActivas: ingreso?.activos ?? 0,
      ultimoIngreso: ingreso?.ultimo ?? null,
      diasSinUsar,
      estado,
    };
  });

  // Los que peor están, arriba. Es una pantalla para actuar, no para celebrar.
  const orden: Record<EstadoDeUso, number> = {
    sin_arrancar: 0, inactivo: 1, enfriandose: 2, activo: 3,
  };
  resultado.sort((a, b) =>
    orden[a.estado] - orden[b.estado] ||
    b.deportistas - a.deportistas ||
    a.nombre.localeCompare(b.nombre),
  );

  const serie = serieGlobal.map((dias, i) => {
    const ini = new Date(desde);
    ini.setUTCDate(ini.getUTCDate() + i * 7);
    return { semana: aFecha(ini), dias };
  });

  return {
    clubes: resultado,
    totales: {
      conActividad: resultado.filter(c => c.estado === 'activo').length,
      total: resultado.length,
      enRiesgo: resultado.filter(c => c.estado === 'inactivo' || c.estado === 'enfriandose').length,
      sinArrancar: resultado.filter(c => c.estado === 'sin_arrancar').length,
      acciones: resultado.reduce((s, c) => s + c.acciones, 0),
    },
    serie,
    ingresosDisponibles,
  };
}
