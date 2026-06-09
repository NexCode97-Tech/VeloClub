import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// GET /profiles/:clerkId — perfil público de cualquier usuario/miembro
router.get('/:clerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const clerkId = String(req.params.clerkId);

  // Buscar como User (ADMIN, COACH)
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      clerkId: true,
      name: true,
      picture: true,
      coverUrl: true,
      role: true,
      createdAt: true,
      club: {
        select: {
          id: true, name: true, city: true, department: true,
          logoUrl: true, verified: true, deporte: true,
        },
      },
    },
  });

  if (user) {
    const postImages = await prisma.post.findMany({
      where: { authorName: user.name, imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, imageUrl: true, createdAt: true },
    });

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingClerkId: clerkId } }),
      prisma.follow.count({ where: { followerClerkId: clerkId } }),
    ]);

    return res.json({
      profile: {
        clerkId: user.clerkId,
        name: user.name,
        picture: user.picture,
        coverUrl: user.coverUrl,
        role: user.role,
        createdAt: user.createdAt,
        club: user.club,
        postImages: postImages.map(p => ({ id: p.id, imageUrl: p.imageUrl! })),
        followersCount,
        followingCount,
      },
    });
  }

  // Buscar como Member (STUDENT)
  const member = await prisma.member.findFirst({
    where: { clerkId },
    select: {
      id: true,
      clerkId: true,
      fullName: true,
      pictureUrl: true,
      role: true,
      createdAt: true,
      club: {
        select: {
          id: true, name: true, city: true, department: true,
          logoUrl: true, verified: true, deporte: true,
        },
      },
    },
  });

  if (!member) return res.status(404).json({ error: 'Perfil no encontrado' });

  const postImages = await prisma.post.findMany({
    where: { authorName: member.fullName, imageUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, imageUrl: true, createdAt: true },
  });

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingClerkId: clerkId } }),
    prisma.follow.count({ where: { followerClerkId: clerkId } }),
  ]);

  res.json({
    profile: {
      clerkId: member.clerkId!,
      name: member.fullName,
      picture: member.pictureUrl,
      coverUrl: null,
      role: member.role,
      createdAt: member.createdAt,
      club: member.club,
      postImages: postImages.map(p => ({ id: p.id, imageUrl: p.imageUrl! })),
      followersCount,
      followingCount,
    },
  });
});

export default router;
