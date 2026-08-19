import { Prisma, PrismaClient } from '@prisma/client';
import { actorActual } from './contexto-peticion';

/**
 * Auditoria automatica de toda escritura a la base.
 *
 * Se hace como extension del cliente de Prisma y no llamando a una funcion en
 * cada endpoint. La razon es simple: instrumentar cincuenta rutas a mano
 * significa olvidarse de la proxima que alguien agregue, y una bitacora con
 * huecos es peor que no tenerla, porque da una falsa sensacion de control.
 * Aca no hay forma de escribir en la base sin quedar registrado.
 *
 * Origen: se borraron cinco clubes y no quedo rastro de quien, cuando ni con
 * que. El endpoint borraba, respondia ok y no escribia nada en ninguna parte.
 */

/**
 * Que se audita. Es una lista explicita y no "todo" a proposito:
 *
 * - `Auditoria` esta fuera o cada registro generaria otro, sin fin.
 * - `Attendance` esta fuera porque una jornada son sesenta escrituras diarias
 *   por club; auditarla ahogaria la bitacora y nadie volveria a leerla.
 * - `Notificacion`, `Notification` y `PostLike` son ruido de la misma clase.
 *
 * Lo que queda es lo que cambia el estado del negocio: clubes, personas,
 * dinero, permisos, contenido y configuracion.
 */
const MODELOS_AUDITADOS = new Set([
  'Club', 'User', 'Member', 'MemberLocation', 'Location',
  'Payment', 'CashEntry', 'ClubSuscripcion', 'PagoSuscripcion',
  'Post', 'PostComment', 'Reporte',
  'Competition', 'CompetitionEvent', 'EventResult',
  'TrainingSession', 'TrainingResult', 'CalendarEvent',
  'ClaseHorario', 'Cupon', 'CuponCanje',
]);

/** Campos que nunca se copian a la bitacora, aunque cambien. */
const CAMPOS_SENSIBLES = new Set([
  'docNumber', 'docFileUrl', 'docFilePublicId',
  'insuranceFileUrl', 'insurancePublicId',
  'eps', 'emergencyPhone', 'emergencyContact',
]);

type Operacion = 'create' | 'createMany' | 'update' | 'updateMany' | 'upsert' | 'delete' | 'deleteMany';

const ESCRITURAS: Operacion[] = [
  'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
];

/** Traduce la operacion de Prisma al verbo que se guarda. */
function accionDe(modelo: string, op: Operacion): string {
  if (op === 'create' || op === 'createMany') return `${modelo.toUpperCase()}_CREADO`;
  if (op === 'delete' || op === 'deleteMany') return `${modelo.toUpperCase()}_ELIMINADO`;
  return `${modelo.toUpperCase()}_MODIFICADO`;
}

/** Quita del objeto los campos que no deben quedar copiados en la bitacora. */
function limpiar(valor: unknown): unknown {
  if (!valor || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(limpiar);
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_SENSIBLES.has(k)) continue;
    salida[k] = v instanceof Date ? v.toISOString() : limpiar(v);
  }
  return salida;
}

/**
 * Solo los campos que de verdad cambiaron.
 *
 * Guardar el registro entero en cada actualizacion vuelve la bitacora
 * ilegible: hay que comparar dos objetos de treinta campos para encontrar el
 * unico que se movio.
 */
function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  if (!antes || !despues) return { antes: limpiar(antes), despues: limpiar(despues) };
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const clave of Object.keys(despues)) {
    if (clave === 'updatedAt' || CAMPOS_SENSIBLES.has(clave)) continue;
    const va = antes[clave];
    const vd = despues[clave];
    const igual = va instanceof Date && vd instanceof Date
      ? va.getTime() === vd.getTime()
      : JSON.stringify(va) === JSON.stringify(vd);
    if (!igual) {
      a[clave] = va instanceof Date ? va.toISOString() : va;
      d[clave] = vd instanceof Date ? vd.toISOString() : vd;
    }
  }
  return { antes: a, despues: d };
}

/** Frase legible, para poder recorrer la bitacora sin interpretar ids. */
function resumirCambio(modelo: string, op: Operacion, datos: unknown): string {
  const nombre = (() => {
    const o = datos as Record<string, unknown> | null;
    if (!o) return null;
    for (const c of ['name', 'fullName', 'nombre', 'description', 'titulo', 'codigo']) {
      if (typeof o[c] === 'string' && o[c]) return o[c] as string;
    }
    return null;
  })();
  const que = nombre ? `${modelo} «${nombre}»` : modelo;
  if (op === 'create' || op === 'createMany') return `Se creó ${que}.`;
  if (op === 'delete' || op === 'deleteMany') return `Se eliminó ${que}.`;
  return `Se modificó ${que}.`;
}

/**
 * Cliente aparte para escribir la bitacora.
 *
 * Tiene que ser uno SIN la extension: escribir el registro con el mismo
 * cliente que la dispara volveria a dispararla, sin fin. Por eso `Auditoria`
 * ademas queda fuera de los modelos auditados.
 */
const registrador = new PrismaClient({ log: ['error'] });

async function guardar(fila: Prisma.AuditoriaCreateInput): Promise<void> {
  try {
    await registrador.auditoria.create({ data: fila });
  } catch (err) {
    // Nunca tumba la operacion principal: un fallo al auditar no puede
    // impedirle trabajar a un administrador. Queda en consola para no perderlo.
    console.error('[auditoria] no se pudo registrar', fila.accion, err);
  }
}

/**
 * Registra en la bitácora algo que NO es una escritura a la base.
 *
 * La extensión de arriba cubre todo lo que cambia datos, pero hay hechos que
 * importan justamente porque nada cambió: un pago rechazado es el caso claro
 * — no se crea ninguna fila, así que no dejaba rastro en ninguna parte y la
 * única forma de saber por qué un club no pudo pagar era irle a preguntar a
 * Mercado Pago con credenciales de producción.
 */
export async function registrarEvento(evento: {
  accion: string;
  entidad: string;
  entidadId?: string | null;
  resumen: string;
  clubId?: string | null;
  clubNombre?: string | null;
  datos?: Record<string, unknown>;
}): Promise<void> {
  const actor = actorActual();
  await guardar({
    accion:    evento.accion,
    entidad:   evento.entidad,
    entidadId: evento.entidadId ?? null,
    resumen:   evento.resumen,
    actorClerkId: actor?.clerkId ?? null,
    actorEmail:   actor?.email   ?? null,
    actorNombre:  actor?.nombre  ?? null,
    actorRol:     actor?.rol     ?? null,
    clubId:     evento.clubId ?? actor?.clubId ?? null,
    clubNombre: evento.clubNombre ?? null,
    datos: (evento.datos ? limpiar(evento.datos) : null) as never,
    ip: actor?.ip ?? null,
  });
}

export function extensionAuditoria() {
  return Prisma.defineExtension(cliente =>
    cliente.$extends({
      name: 'auditoria',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const op = operation as Operacion;
            if (!model || !MODELOS_AUDITADOS.has(model) || !ESCRITURAS.includes(op)) {
              return query(args);
            }

            const actor = actorActual();

            // Estado previo, para poder decir que cambio y para conservar copia
            // de lo que se va a borrar. Es una lectura extra por escritura: se
            // paga a proposito, porque sin el "antes" la bitacora no permite
            // recuperar nada ni entender un cambio.
            let antes: Record<string, unknown> | null = null;
            const necesitaPrevio = op === 'update' || op === 'delete' || op === 'updateMany' || op === 'deleteMany';
            if (necesitaPrevio) {
              try {
                const a = args as { where?: unknown };
                const delegado = (registrador as unknown as Record<string, {
                  findFirst: (x: unknown) => Promise<Record<string, unknown> | null>;
                }>)[model.charAt(0).toLowerCase() + model.slice(1)];
                antes = await delegado.findFirst({ where: a.where });
              } catch { /* si no se puede leer, se registra igual sin el antes */ }
            }

            const resultado = await query(args);

            // El club afectado sale del registro cuando lo tiene; si no, del
            // club de quien hizo la peticion.
            const fila = (resultado ?? antes) as Record<string, unknown> | null;
            const clubId = (fila?.clubId as string | undefined)
              ?? (model === 'Club' ? (fila?.id as string | undefined) : undefined)
              ?? actor?.clubId
              ?? null;

            const esBorrado = op === 'delete' || op === 'deleteMany';
            const esCreacion = op === 'create' || op === 'createMany';

            await guardar({
              accion:    accionDe(model, op),
              entidad:   model,
              entidadId: (fila?.id as string | undefined) ?? null,
              resumen:   resumirCambio(model, op, fila),
              actorClerkId: actor?.clerkId ?? null,
              actorEmail:   actor?.email   ?? null,
              actorNombre:  actor?.nombre  ?? null,
              actorRol:     actor?.rol     ?? null,
              clubId,
              clubNombre: model === 'Club' ? ((fila?.name as string | undefined) ?? null) : null,
              // En un borrado se guarda todo lo que se pierde; en una creacion,
              // lo que nace; en un cambio, solo lo que se movio.
              datos: (esBorrado
                ? { eliminado: limpiar(antes ?? fila) }
                : esCreacion
                  ? { creado: limpiar(fila) }
                  : diferencias(antes, fila)) as never,
              ip: actor?.ip ?? null,
            });

            return resultado;
          },
        },
      },
    })
  );
}
