import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

const router = Router();

const createPostSchema = z.object({
  content:      z.string().min(1).max(2000),
  imageUrl:     z.string().url().optional(),
  imagePublicId: z.string().optional(),
});

// GET /posts — Feed del club (últimos 30)
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';

  const posts = await prisma.post.findMany({
    where: { clubId },
    include: { likes: { select: { userId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  res.json({ posts });
});

// POST /posts — Crear publicación (solo ADMIN y COACH)
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sin permisos' });
  }

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const post = await prisma.post.create({
    data: {
      clubId:        req.user.clubId ?? '',
      authorName:    req.auth?.name ?? 'Autor',
      authorRole:    req.user.role,
      authorAvatar:  req.auth?.picture ?? null,
      content:       parsed.data.content,
      imageUrl:      parsed.data.imageUrl ?? null,
      imagePublicId: parsed.data.imagePublicId ?? null,
    },
    include: { likes: { select: { userId: true } } },
  });

  emitToClub(req.user.clubId ?? '', 'posts');
  res.status(201).json({ post });
});

// DELETE /posts/:id — Solo el autor (mismo clubId) o ADMIN
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  const post = await prisma.post.findFirst({ where: { id, clubId: req.user.clubId ?? '' } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  await prisma.post.delete({ where: { id } });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ ok: true });
});

// POST /posts/:id/like — Toggle like (cualquier rol)
router.post('/:id/like', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);
  const userId = req.auth?.clerkId ?? '';

  const post = await prisma.post.findFirst({ where: { id: postId, clubId: req.user.clubId ?? '' } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId, userId } } });

  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
    res.json({ liked: false });
  } else {
    await prisma.postLike.create({ data: { postId, userId } });
    res.json({ liked: true });
  }
});

export default router;
