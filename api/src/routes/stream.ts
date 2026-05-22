import { Router } from 'express';
import { verifyToken } from '@clerk/backend';
import { prisma } from '../db/client';
import { addSSEClient, removeSSEClient } from '../lib/sse';

const router = Router();

/**
 * GET /stream?token=<clerk-jwt>
 *
 * Conexión SSE por club. El token va en query param porque EventSource
 * no admite cabeceras personalizadas. El JWT es de corta duración (~60s).
 */
router.get('/', async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) return res.status(401).end();

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const user = await prisma.user.findUnique({ where: { clerkId: payload.sub } });
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
