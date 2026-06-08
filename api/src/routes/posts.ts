import { Router } from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

const COMMENT_SELECT = {
  id: true, authorName: true, authorRole: true,
  authorAvatar: true, content: true, createdAt: true,
};

const POST_INCLUDE = {
  likes:    { select: { userId: true } },
  comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' as const }, take: 50 },
};

const createPostSchema = z.object({
  content:       z.string().min(1).max(2000),
  imageUrl:      z.string().url().optional(),
  imagePublicId: z.string().optional(),
  mediaUrl:      z.string().url().optional(),
  mediaPublicId: z.string().optional(),
  mediaType:     z.enum(['image', 'video', 'file']).optional(),
  scope:         z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
});

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
});

// POST /posts/upload-media — Subir imagen/video/archivo a Cloudinary
router.post('/upload-media', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });

  const { data, type } = req.body as { data: string; type: 'image' | 'video' | 'raw' };
  if (!data) return res.status(400).json({ error: 'Se requiere data en base64' });

  try {
    const resourceType = type === 'video' ? 'video' : type === 'raw' ? 'raw' : 'image';
    const result = await cloudinary.uploader.upload(data, {
      folder: `veloclub/posts/${req.user.clubId}`,
      resource_type: resourceType,
    });
    res.json({ url: result.secure_url, publicId: result.public_id, mediaType: resourceType });
  } catch (err) {
    console.error('Error subiendo media a Cloudinary:', err);
    res.status(500).json({ error: 'Error al subir el archivo' });
  }
});

// GET /posts?scope=public|private
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const scope  = req.query.scope === 'public' ? 'PUBLIC' : 'PRIVATE';
  const clubId = req.user.clubId ?? '';

  const posts = await prisma.post.findMany({
    where: scope === 'PUBLIC'
      ? { scope: 'PUBLIC' }
      : { scope: 'PRIVATE', clubId },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ posts });
});

// POST /posts
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });

  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const club = await prisma.club.findUnique({
    where: { id: req.user.clubId ?? '' }, select: { name: true },
  });

  const post = await prisma.post.create({
    data: {
      clubId:        req.user.clubId ?? '',
      clubName:      club?.name ?? '',
      authorName:    req.auth?.name ?? 'Autor',
      authorRole:    req.user.role,
      authorAvatar:  req.auth?.picture ?? null,
      content:       parsed.data.content,
      imageUrl:      parsed.data.mediaUrl ?? parsed.data.imageUrl ?? null,
      imagePublicId: parsed.data.mediaPublicId ?? parsed.data.imagePublicId ?? null,
      scope:         parsed.data.scope,
    },
    include: POST_INCLUDE,
  });

  emitToClub(req.user.clubId ?? '', 'posts');
  res.status(201).json({ post });
});

// DELETE /posts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });

  const post = await prisma.post.findFirst({ where: { id: String(req.params.id), clubId: req.user.clubId ?? '' } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });

  if (post.imagePublicId) {
    await cloudinary.uploader.destroy(post.imagePublicId, { resource_type: 'image' }).catch(() => {});
  }

  await prisma.post.delete({ where: { id: String(req.params.id) } });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ ok: true });
});

// GET /posts/:id/likes — lista de usuarios que dieron like
router.get('/:id/likes', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  const postLikes = await prisma.postLike.findMany({
    where: { postId },
    select: { userId: true },
  });

  const clerkIds = postLikes.map(l => l.userId);
  if (clerkIds.length === 0) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: { clerkId: { in: clerkIds } },
    select: { name: true, picture: true, role: true },
  });

  res.json({ users });
});

// POST /posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);
  const userId = req.auth?.clerkId ?? '';

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
    res.json({ liked: false });
  } else {
    await prisma.postLike.create({ data: { postId, userId } });
    res.json({ liked: true });
  }
});

// GET /posts/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  const comments = await prisma.postComment.findMany({
    where: { postId },
    select: COMMENT_SELECT,
    orderBy: { createdAt: 'asc' },
  });

  res.json({ comments });
});

// POST /posts/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const postId = String(req.params.id);

  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
  if (post.scope === 'PRIVATE' && post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Sin permisos' });

  const comment = await prisma.postComment.create({
    data: {
      postId,
      authorName:   req.auth?.name ?? 'Usuario',
      authorRole:   req.user.role,
      authorAvatar: req.auth?.picture ?? null,
      content:      parsed.data.content,
    },
    select: COMMENT_SELECT,
  });

  emitToClub(req.user.clubId ?? '', 'posts');
  res.status(201).json({ comment });
});

// PATCH /posts/:id/comments/:commentId — editar contenido
router.patch('/:id/comments/:commentId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });

  const content = String(req.body?.content ?? '').trim();
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });

  const comment = await prisma.postComment.findUnique({ where: { id: String(req.params.commentId) } });
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });

  const updated = await prisma.postComment.update({
    where: { id: String(req.params.commentId) },
    data: { content },
    select: COMMENT_SELECT,
  });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ comment: updated });
});

// DELETE /posts/:id/comments/:commentId
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!['ADMIN', 'COACH'].includes(req.user.role)) return res.status(403).json({ error: 'Sin permisos' });

  const comment = await prisma.postComment.findUnique({ where: { id: String(req.params.commentId) } });
  if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' });

  await prisma.postComment.delete({ where: { id: String(req.params.commentId) } });
  emitToClub(req.user.clubId ?? '', 'posts');
  res.json({ ok: true });
});

export default router;
