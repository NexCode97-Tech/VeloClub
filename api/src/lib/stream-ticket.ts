import { randomBytes } from 'node:crypto';
import { getRedis } from './redis';

/**
 * Tickets de un solo uso para abrir la conexión SSE.
 *
 * `EventSource` no admite cabeceras, así que antes se mandaba el JWT de Clerk en
 * la query string: quedaba en el historial del navegador y en los logs de
 * cualquier proxy intermedio, y con él se puede llamar a toda la API.
 *
 * Ahora el cliente pide un ticket con el token en la cabecera (POST /stream/ticket)
 * y solo el ticket viaja en la URL. Dura un minuto, sirve una sola vez y no
 * autoriza nada más que abrir el stream.
 */

const TTL_SEGUNDOS = 60;
const PREFIJO = 'stream:ticket:';

// Respaldo para cuando Redis no está disponible: sin esto el stream dejaría de
// funcionar por completo, ya que la librería de caché falla en silencio.
const enMemoria = new Map<string, { clerkId: string; expiraEn: number }>();

function limpiarVencidos(): void {
  const ahora = Date.now();
  for (const [ticket, dato] of enMemoria) {
    if (dato.expiraEn <= ahora) enMemoria.delete(ticket);
  }
}

export async function crearTicketStream(clerkId: string): Promise<string> {
  const ticket = randomBytes(32).toString('base64url');
  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(`${PREFIJO}${ticket}`, clerkId, 'EX', TTL_SEGUNDOS);
      return ticket;
    } catch {
      // cae al respaldo en memoria
    }
  }

  limpiarVencidos();
  enMemoria.set(ticket, { clerkId, expiraEn: Date.now() + TTL_SEGUNDOS * 1000 });
  return ticket;
}

/** Devuelve el clerkId y consume el ticket. Null si no existe o ya se usó. */
export async function canjearTicketStream(ticket: string): Promise<string | null> {
  if (!ticket) return null;
  const redis = getRedis();

  if (redis) {
    try {
      // GETDEL lee y borra en una sola operación atómica, de modo que dos
      // conexiones simultáneas no pueden canjear el mismo ticket.
      const clerkId = await redis.getdel(`${PREFIJO}${ticket}`);
      if (clerkId) return clerkId;
    } catch {
      // cae al respaldo en memoria
    }
  }

  const dato = enMemoria.get(ticket);
  if (!dato) return null;
  enMemoria.delete(ticket);
  return dato.expiraEn > Date.now() ? dato.clerkId : null;
}
