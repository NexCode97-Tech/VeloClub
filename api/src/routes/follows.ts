import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// POST /follows/toggle/:targetClerkId — seguir o dejar de seguir
router.post('/toggle/:targetClerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const followerClerkId  = req.auth.clerkId;
  const followingClerkId = req.params.targetClerkId;

  if (followerClerkId === followingClerkId) {
    return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
  }

  const existing = await prisma.follow.findUnique({
    where: { followerClerkId_followingClerkId: { followerClerkId, followingClerkId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return res.json({ following: false });
  }

  await prisma.follow.create({ data: { followerClerkId, followingClerkId } });
  return res.json({ following: true });
});

// GET /follows/stats/:targetClerkId — contadores + estado para el viewer actual
router.get('/stats/:targetClerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const viewerClerkId    = req.auth.clerkId;
  const targetClerkId    = req.params.targetClerkId;

  const [followersCount, followingCount, isFollowing] = await Promise.all([
    prisma.follow.count({ where: { followingClerkId: targetClerkId } }),
    prisma.follow.count({ where: { followerClerkId: targetClerkId } }),
    prisma.follow.findUnique({
      where: { followerClerkId_followingClerkId: { followerClerkId: viewerClerkId, followingClerkId: targetClerkId } },
    }),
  ]);

  res.json({ followersCount, followingCount, isFollowing: !!isFollowing });
});

export default router;
