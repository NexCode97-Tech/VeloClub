import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { notify, notifyClubStaff } from '../lib/notify';

const router = Router();

// POST /follows/toggle/:targetClerkId — seguir o dejar de seguir
router.post('/toggle/:targetClerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const followerClerkId  = req.auth.clerkId;
  const followingClerkId = String(req.params.targetClerkId);

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

  // Notificar al seguido (club → staff · persona → esa persona)
  const followerName = req.auth.name || 'Alguien';
  if (followingClerkId.startsWith('club:')) {
    const clubId = followingClerkId.slice(5);
    await notifyClubStaff(clubId, {
      tipo: 'NEW_FOLLOWER',
      titulo: 'Nuevo seguidor',
      cuerpo: `${followerName} empezó a seguir al club.`,
      link: '/dashboard/club',
    });
  } else {
    let targetClubId: string | null = null;
    const u = await prisma.user.findUnique({ where: { clerkId: followingClerkId }, select: { clubId: true } });
    if (u) targetClubId = u.clubId;
    else {
      const m = await prisma.member.findFirst({ where: { clerkId: followingClerkId }, select: { clubId: true } });
      targetClubId = m?.clubId ?? null;
    }
    await notify(followingClerkId, targetClubId, {
      tipo: 'NEW_FOLLOWER',
      titulo: 'Nuevo seguidor',
      cuerpo: `${followerName} empezó a seguirte.`,
      link: `/dashboard/perfil/${followerClerkId}`,
    });
  }

  return res.json({ following: true });
});

// GET /follows/stats/:targetClerkId — contadores + estado para el viewer actual
router.get('/stats/:targetClerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const viewerClerkId    = req.auth.clerkId;
  const targetClerkId    = String(req.params.targetClerkId);

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
