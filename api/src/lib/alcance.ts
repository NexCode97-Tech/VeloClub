import { Prisma } from '@prisma/client';
import { alcanceActual } from './contexto-peticion';

/**
 * Aislamiento entre deportes, aplicado por el cliente de Prisma.
 *
 * Un club puede ofrecer patinaje y natacion, y cada uno es una carpeta con sus
 * propios deportistas, sedes, asistencia, caja y resultados. El riesgo de este
 * modelo no esta en agregar la columna `deporteId`: esta en olvidarse de
 * filtrar por ella en alguna de las decenas de consultas repartidas por las
 * rutas. Basta una para que un club vea deportistas de otro deporte, y el
 * sintoma no avisa — no hay error, solo aparecen filas de mas.
 *
 * Por eso el filtro no se escribe ruta por ruta. Va montado en el cliente,
 * exactamente donde ya vive la auditoria y por la misma razon: instrumentar
 * cincuenta rutas a mano significa olvidarse de la proxima que alguien agregue.
 * Aca no hay forma de consultar la base sin quedar acotado.
 *
 * La carpeta activa la fija `requireAuth` en el contexto de la peticion. Las
 * rutas que a proposito miran el club entero — el panel de superadmin, el muro
 * publico, el cron — la declaran `'club-entero'` y pasan sin filtrar.
 *
 * El sentido de la falla importa: si una ruta de club se olvida de declarar su
 * alcance, se queda sin ver nada y alguien lo reporta el mismo dia. Si se
 * olvidara al reves, veria de mas y no lo notaria nadie.
 *
 * Lo que NO cubre: las lecturas anidadas (`club.findUnique({ include: {
 * members: true } })`). La extension solo ve la operacion de arriba, y ahi el
 * modelo es `Club`, que no es de carpeta. Hoy eso solo pasa en superadmin, que
 * mira el club entero a proposito. Si una ruta de club llega a necesitarlo, el
 * filtro va escrito a mano dentro del `include`.
 */

/** Los modelos que viven DENTRO de una carpeta de deporte. */
const DENTRO_DE_LA_CARPETA = new Set([
  'Location',
  'Member',
  'Attendance',
  'ClaseHorario',
  'Grupo',
  'Payment',
  'CashEntry',
  'Competition',
  'TrainingSession',
  'CalendarEvent',
  'Post',
]);

// Un nombre mal escrito no falla: no coincide con ningun modelo y esa entidad
// se queda sin aislar, en silencio y para siempre. Mismo cuidado que la
// auditoria, que ya tuvo ese error una vez con 'PagoSuscripcion'.
{
  const delEsquema = new Set(Prisma.dmmf.datamodel.models.map(m => m.name));
  const inexistentes = [...DENTRO_DE_LA_CARPETA].filter(m => !delEsquema.has(m));
  if (inexistentes.length > 0) {
    console.error(
      `[alcance] estos modelos no existen en el esquema y NO se estan aislando por deporte: ${inexistentes.join(', ')}`
    );
  }
}

/** Operaciones que crean filas: la carpeta va en el `data`. */
const CREAN = new Set(['create', 'createMany', 'createManyAndReturn']);

/**
 * Operaciones que tocan filas existentes: la carpeta va en el `where`.
 *
 * `findUnique`, `update` y `delete` tambien admiten campos no unicos en su
 * `where` desde Prisma 5, asi que el filtro entra igual en todas.
 */
const FILTRAN = new Set([
  'findUnique', 'findUniqueOrThrow',
  'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'updateManyAndReturn',
  'delete', 'deleteMany',
]);

type Registro = Record<string, unknown>;

// Los campos sueltos del nivel de arriba se combinan con AND, tambien cuando el
// `where` que llego trae un OR o un NOT adentro.
function conCarpeta(where: unknown, deporteId: string): Registro {
  return { ...(typeof where === 'object' && where !== null ? where : {}), deporteId };
}

function datosConCarpeta(data: unknown, deporteId: string): unknown {
  if (Array.isArray(data)) return data.map(d => ({ ...(d as Registro), deporteId }));
  return { ...(typeof data === 'object' && data !== null ? data : {}), deporteId };
}

export function extensionAlcance() {
  return Prisma.defineExtension({
    name: 'alcance-por-deporte',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!DENTRO_DE_LA_CARPETA.has(model)) return query(args);

          const alcance = alcanceActual();
          // Sin peticion de por medio (arranque, colas, scripts) o mirando el
          // club entero a proposito: pasa sin tocar.
          if (alcance === null || alcance === 'club-entero') return query(args);

          const { deporteId } = alcance;
          const a = args as Registro;
          // `query` viene tipado por modelo y operacion concretos, y aca se
          // atiende a todos a la vez: el objeto se arma sin tipos y se le pasa
          // tal cual. Es el mismo compromiso que ya hace la extension de
          // auditoria por la misma razon.
          const seguir = query as (args: unknown) => Promise<unknown>;

          if (operation === 'upsert') {
            return seguir({
              ...a,
              where:  conCarpeta(a.where, deporteId),
              create: datosConCarpeta(a.create, deporteId),
            });
          }
          if (CREAN.has(operation)) {
            return seguir({ ...a, data: datosConCarpeta(a.data, deporteId) });
          }
          if (FILTRAN.has(operation)) {
            return seguir({ ...a, where: conCarpeta(a.where, deporteId) });
          }

          // Una operacion que esta extension no sabe acotar. No se deja pasar
          // en silencio: pasar en silencio es exactamente como una carpeta
          // termina viendo la de al lado.
          throw new Error(
            `[alcance] operacion "${operation}" sobre ${model} sin forma de acotarla por deporte`
          );
        },
      },
    },
  });
}
