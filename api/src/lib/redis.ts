import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    client.on('error', (err) => {
      console.error(JSON.stringify({ level: 'ERROR', msg: 'Redis error', err: err.message }));
    });
  }
  return client;
}

/**
 * Abre la conexión al arrancar, sin esperar a que alguien pida algo.
 *
 * El cliente se crea con `lazyConnect`, así que el socket no existe hasta el
 * primer comando, y con `enableOfflineQueue` apagado ese primer comando no hace
 * fila: falla. Eso está bien mientras corre —si el caché se cae, la consulta se
 * va a la base en vez de quedarse esperando— pero en el arranque convierte la
 * primera petición de cada despliegue en un error gratis.
 *
 * No se espera el resultado a propósito. Redis es opcional acá: si no levanta,
 * la API tiene que arrancar igual y servir contra la base.
 */
export function conectarRedis(): void {
  const redis = getRedis();
  if (!redis || redis.status !== 'wait') return;
  redis.connect().catch(err => {
    console.error(JSON.stringify({
      level: 'ERROR', msg: 'Redis no conecto al arrancar', err: err.message,
    }));
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis falla silencioso — la app sigue funcionando sin caché
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // silencioso
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // silencioso
  }
}
