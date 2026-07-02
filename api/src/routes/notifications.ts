import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// GET /notifications — lista del usuario + conteo de no leídas
router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const recipientClerkId = req.auth.clerkId;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientClerkId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({ where: { recipientClerkId, leida: false } }),
  ]);

  res.json({ notifications: items, unread });
});

// GET /notifications/unread-count — solo el contador (ligero, para el badge)
router.get('/unread-count', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const unread = await prisma.notification.count({
    where: { recipientClerkId: req.auth.clerkId, leida: false },
  });
  res.json({ unread });
});

// PATCH /notifications/read — marca una (id) o todas como leídas
router.patch('/read', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const recipientClerkId = req.auth.clerkId;
  const id = typeof req.body?.id === 'string' ? req.body.id : null;

  await prisma.notification.updateMany({
    where: { recipientClerkId, leida: false, ...(id ? { id } : {}) },
    data: { leida: true },
  });

  res.json({ ok: true });
});

export default router;
