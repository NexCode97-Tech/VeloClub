import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Una escritura en lote que no tocó ninguna fila no se audita.
 *
 * El 1 de octubre de 2026 la bitácora tenía 19.806 filas y 12.988 eran de
 * publicaciones que nunca se tocaron. La causa: `/me`, que es el arranque de
 * cada carga del panel, lanzaba dos `updateMany` sobre Post y PostComment en
 * cada visita para sincronizar la foto del autor, aunque no hubiera nada
 * desactualizado. Cada uno dejaba una fila, y como el registro sin fila afectada
 * se queda sin club propio, la extensión se lo atribuía al club de quien entraba:
 * clubes con cero publicaciones aparecían moviendo publicaciones a diario.
 *
 * Son dos arreglos y los dos importan. `/me` ya no escribe sin motivo, y la
 * auditoría ya no registra una escritura en lote que no movió nada, que es lo
 * que cubre al próximo que haga lo mismo.
 */

const guardado = vi.hoisted(() => vi.fn());

vi.mock('../lib/contexto-peticion', () => ({
  actorActual: () => ({
    clerkId: 'user_abc', email: 'admin@club.com', nombre: 'Admin',
    rol: 'ADMIN', clubId: 'club_1', ip: '1.2.3.4',
  }),
}));

// La auditoria escribe con un PrismaClient propio, creado dentro del modulo
// para no auditarse a si misma, asi que el doble va en `@prisma/client`. Todo
// lo demas del paquete se deja real: la extension usa `Prisma.defineExtension`
// y `Prisma.dmmf`, que son del mismo import.
vi.mock('@prisma/client', async (original) => {
  const real = await original<typeof import('@prisma/client')>();
  class ClienteFalso {
    constructor() {
      return new Proxy({}, {
        get(_destino, prop) {
          if (prop === 'auditoria') return { create: guardado };
          if (typeof prop !== 'string' || prop.startsWith('$') || prop === 'then') {
            return undefined;
          }
          // Cualquier otro modelo: solo se le pide el estado previo.
          return { findFirst: async () => ({ id: 'x1', clubId: 'club_1' }) };
        },
      });
    }
  }
  return { ...real, PrismaClient: ClienteFalso };
});

/** Corre una operación a través de la extensión, sin levantar Prisma. */
async function auditar(
  model: string,
  operation: string,
  resultado: unknown,
): Promise<boolean> {
  const { extensionAuditoria } = await import('../lib/auditoria');

  // `Prisma.defineExtension` con callback devuelve el propio callback, que
  // espera un cliente y le llama `$extends`. Se le pasa uno de mentira que solo
  // atrapa la configuración, y de ahí sale el gancho a probar.
  type Config = {
    query: { $allModels: { $allOperations: (c: unknown) => Promise<unknown> } };
  };
  let config: Config | null = null;
  const aplicar = extensionAuditoria() as unknown as (c: unknown) => unknown;
  aplicar({ $extends: (c: Config) => { config = c; return {}; } });

  const gancho = (config as Config | null)?.query?.$allModels?.$allOperations;
  if (!gancho) throw new Error('no se encontro $allOperations en la extension');

  guardado.mockClear();
  await gancho({
    model, operation, args: { where: { id: 'x' } },
    query: async () => resultado,
  });
  return guardado.mock.calls.length > 0;
}

describe('auditoria de escrituras en lote', () => {
  beforeEach(() => guardado.mockClear());

  it('no registra un updateMany que no toco ninguna fila', async () => {
    expect(await auditar('Post', 'updateMany', { count: 0 })).toBe(false);
  });

  it('no registra un deleteMany que no borro nada', async () => {
    expect(await auditar('Post', 'deleteMany', { count: 0 })).toBe(false);
  });

  it('si registra un updateMany que si movio filas', async () => {
    expect(await auditar('Post', 'updateMany', { count: 3 })).toBe(true);
  });

  // Un update de uno solo no devuelve `count`, asi que la regla no debe
  // alcanzarlo: ahi siempre hubo una fila de por medio.
  it('si registra un update normal', async () => {
    expect(await auditar('Payment', 'update', { id: 'p1', clubId: 'club_1' })).toBe(true);
  });

  it('deja pasar los modelos que no se auditan', async () => {
    expect(await auditar('Attendance', 'updateMany', { count: 9 })).toBe(false);
  });
});
