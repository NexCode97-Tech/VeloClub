import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

const COMMENT_SELECT = {
  id: true, authorClerkId: true, authorName: true, authorRole: true,
  authorAvatar: true, content: true, createdAt: true, parentId: true,
};

const POST_INCLUDE = {
  likes:    { select: { userId: true } },
  comments: { select: COMMENT_SELECT, orderBy: { createdAt: 'asc' as const }, take: 100 },
};

// Publicaciones de una persona, en el orden en que se ven en la comunidad.
//
// Se buscan por `authorClerkId` y no por el nombre: el nombre se repite entre
// homonimos y cambia cuando alguien se corrige el suyo, asi que filtrar por el
// mezclaba historiales ajenos y borraba el propio. Tampoco se exige que la
// publicacion traiga imagen — una de solo texto tambien es una publicacion.
//
// El alcance importa: lo PUBLICO lo ve cualquiera, pero lo PRIVADO solo se
// muestra a quien pertenece al mismo club que lo publico.
async function publicacionesDe(clerkId: string, clubIdDelVisitante: string | null) {
  return prisma.post.findMany({
    where: {
      authorClerkId: clerkId,
      OR: [
        { scope: 'PUBLIC' },
        ...(clubIdDelVisitante ? [{ scope: 'PRIVATE' as const, clubId: clubIdDelVisitante }] : []),
      ],
    },
    include: POST_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// GET /profiles/:clerkId — perfil público de cualquier usuario/miembro
router.get('/:clerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const clerkId = String(req.params.clerkId);
  const clubIdDelVisitante = req.user?.clubId ?? null;

  // Buscar como User (ADMIN, COACH)
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      clerkId: true,
      name: true,
      picture: true,
      coverUrl: true,
      bio: true,
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
    const posts = await publicacionesDe(clerkId, clubIdDelVisitante);

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
        bio: user.bio ?? null,
        role: user.role,
        createdAt: user.createdAt,
        club: user.club,
        posts,
        // El mosaico solo necesita las que traen imagen, pero salen del mismo
        // listado para que nunca se contradigan entre si.
        postImages: posts
          .filter(p => p.imageUrl)
          .map(p => ({ id: p.id, imageUrl: p.imageUrl! })),
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

  const posts = await publicacionesDe(clerkId, clubIdDelVisitante);

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
      bio: null,
      role: member.role,
      createdAt: member.createdAt,
      club: member.club,
      posts,
      postImages: posts
        .filter(p => p.imageUrl)
        .map(p => ({ id: p.id, imageUrl: p.imageUrl! })),
      followersCount,
      followingCount,
    },
  });
});

export default router;
