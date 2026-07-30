import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { addSSEClient, removeSSEClient } from '../lib/sse';
import { crearTicketStream, canjearTicketStream } from '../lib/stream-ticket';

const router = Router();

/**
 * POST /stream/ticket
 *
 * Entrega un ticket de un solo uso para abrir el stream. El JWT viaja aquí en la
 * cabecera, como en cualquier otra ruta.
 */
router.post('/ticket', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const ticket = await crearTicketStream(req.auth.clerkId);
  res.json({ ticket });
});

/**
 * GET /stream?ticket=<ticket>
 *
 * Conexión SSE por club. El identificador va en la query porque EventSource no
 * admite cabeceras; antes se mandaba ahí el JWT de Clerk, que quedaba expuesto en
 * el historial del navegador y en los logs de los proxies intermedios.
 */
router.get('/', async (req, res) => {
  const ticket = String(req.query.ticket ?? '');
  if (!ticket) return res.status(401).end();

  try {
    const clerkId = await canjearTicketStream(ticket);
    if (!clerkId) return res.status(401).end();

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user?.clubId) return res.status(403).end();

    const clubId = user.clubId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // desactiva buffering en nginx/Railway
    res.flushHeaders();

    // Ping inicial para confirmar conexión
    res.write('event: connected\ndata: {}\n\n');

    addSSEClient(clubId, res);

    // Heartbeat cada 25s para mantener la conexión viva en Railway
    const heartbeat = setInterval(() => {
      try {
        res.write('event: ping\ndata: {}\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSSEClient(res);
    });
  } catch {
    res.status(401).end();
  }
});

export default router;
