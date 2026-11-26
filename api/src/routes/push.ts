/**
 * /push — los dispositivos donde cada persona activó las notificaciones.
 *
 *   GET    /push/clave         la clave pública VAPID, para suscribirse
 *   POST   /push/dispositivos  registra (o vuelve a registrar) este navegador
 *   DELETE /push/dispositivos  lo quita, al tocar «Desactivar»
 *
 * Va por clerkId y no por club: un aviso le llega a la persona, sea del staff o
 * deportista, y la tabla no cuelga de ninguna carpeta de deporte. El envío está
 * en lib/push.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prismaClubEntero } from '../db/client';
import { clavePublica, endpointValido } from '../lib/push';
import { strictLimiter } from '../lib/rate-limit';

const router = Router();

const suscripcionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});

router.get('/clave', requireAuth, (_req, res) => {
  const clave = clavePublica();
  if (!clave) return res.status(503).json({ error: 'Las notificaciones no están disponibles en este momento.' });
  res.json({ clave });
});

router.post('/dispositivos', strictLimiter, requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const parsed = suscripcionSchema.safeParse(req.body);
  if (!parsed.success || !endpointValido(parsed.data.endpoint)) {
    return res.status(400).json({ error: 'Este navegador no entregó una suscripción válida.' });
  }
  const { endpoint, keys } = parsed.data;
  const userAgent = String(req.header('user-agent') ?? '').slice(0, 300) || null;
  // Un mismo navegador compartido queda con quien lo activó de último.
  await prismaClubEntero.pushDispositivo.upsert({
    where: { endpoint },
    create: { clerkId: req.auth.clerkId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { clerkId: req.auth.clerkId, p256dh: keys.p256dh, auth: keys.auth, userAgent, usadoAt: new Date() },
  });
  res.status(201).json({ ok: true });
});

router.delete('/dispositivos', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (!endpoint) return res.status(400).json({ error: 'Falta el dispositivo.' });
  // Solo el suyo: con el endpoint de otro no se le apagan los avisos a nadie.
  await prismaClubEntero.pushDispositivo.deleteMany({ where: { endpoint, clerkId: req.auth.clerkId } });
  res.json({ ok: true });
});

export default router;
