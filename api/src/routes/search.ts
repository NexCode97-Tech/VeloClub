import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// GET /search?q=... — Búsqueda de comunidad: clubes + personas (deportistas/entrenadores).
// Devuelve SOLO datos públicos (nombre, foto, club, rol). Nunca teléfono, documento,
// correo, pagos ni datos sensibles. Disponible para cualquier usuario autenticado.
router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ clubs: [], athletes: [], coaches: [] });

  const [clubs, members] = await Promise.all([
    prisma.club.findMany({
      // Solo clubes verificados aparecen en el buscador de comunidad
      where: { active: true, verificationStatus: 'VERIFIED', name: { contains: q, mode: 'insensitive' } },
      select: {
        id: true, name: true, city: true, department: true,
        logoUrl: true, verified: true, deporte: true,
      },
      take: 8,
      orderBy: { name: 'asc' },
    }),
    prisma.member.findMany({
      where: {
        fullName: { contains: q, mode: 'insensitive' },
        clerkId: { not: null }, // solo personas con perfil navegable (ya iniciaron sesión)
      },
      select: {
        id: true, clerkId: true, fullName: true, pictureUrl: true, role: true,
        club: { select: { id: true, name: true, logoUrl: true } },
      },
      take: 24,
      orderBy: { fullName: 'asc' },
    }),
  ]);

  // Deportistas = STUDENT · Entrenadores/staff = COACH + ADMIN
  const athletes = members.filter(m => m.role === 'STUDENT');
  const coaches  = members.filter(m => m.role === 'COACH' || m.role === 'ADMIN');

  res.json({ clubs, athletes, coaches });
});

export default router;
