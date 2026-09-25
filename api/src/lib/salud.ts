import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

/**
 * El chequeo de salud, aparte para poder probarlo.
 *
 * Hay una diferencia que este archivo existe para sostener: **arrancando no es
 * lo mismo que roto**. El cliente de Redis se crea con `lazyConnect`, así que
 * el socket no se abre hasta el primer comando, y como la cola sin conexión
 * está apagada a propósito ese primer comando no espera, falla. Contarlo como
 * avería hacía que la primera llamada después de un arranque en frío devolviera
 * 503 y la siguiente 200, que para un monitor externo es una caída y una
 * recuperación cada vez que Railway despierta el servicio.
 *
 * La base sí es al revés. No hay plataforma sin ella, así que si no contesta la
 * respuesta es 503 aunque sea el primer segundo de vida del proceso.
 */

export type EstadoPieza = 'ok' | 'error' | 'iniciando' | 'apagado';

export interface Salud {
  status: 'ok' | 'degraded';
  service: 'veloclub-api';
  checks: Record<string, EstadoPieza>;
}

/** Lo mínimo que necesita este chequeo, para poder pasarle dobles en las pruebas. */
type BaseDatos = Pick<PrismaClient, '$queryRaw'>;
type Cache = Pick<Redis, 'status' | 'ping'>;

/**
 * Estados de ioredis que son camino a estar listo y no una avería. `wait` es el
 * de un cliente con `lazyConnect` al que nadie le ha pedido nada todavía.
 */
const ARRANCANDO = new Set(['wait', 'connecting', 'connect', 'reconnecting']);

export async function revisarSalud(
  db: BaseDatos,
  cache: Cache | null,
): Promise<Salud> {
  const checks: Record<string, EstadoPieza> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }

  if (!cache) {
    checks.redis = 'apagado';
  } else if (ARRANCANDO.has(cache.status)) {
    checks.redis = 'iniciando';
  } else {
    try {
      await cache.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }
  }

  // El caché puede faltar sin que la plataforma deje de servir: sin él las
  // consultas van directo a la base. La base no.
  const sano = checks.db === 'ok' && checks.redis !== 'error';

  return {
    status: sano ? 'ok' : 'degraded',
    service: 'veloclub-api',
    checks,
  };
}
