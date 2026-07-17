import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { addToAllowlist } from '../lib/clerk-allowlist';

// ── Normalización y similitud de nombres de club (anti-suplantación) ──────────
// Quita tildes, pasa a minúsculas y colapsa espacios/puntuación para comparar
// nombres sin importar mayúsculas, acentos ni símbolos.
function normalizeName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Devuelve el nivel de colisión de un nombre contra los clubes existentes.
// - 'taken'   : coincide (normalizado) con un club YA VERIFICADO → hay que diferenciar.
// - 'similar' : muy parecido a alguno (verificado o no) → se permite pero se marca.
// - 'ok'      : libre.
async function checkNameCollision(rawName: string): Promise<'taken' | 'similar' | 'ok'> {
  const target = normalizeName(rawName);
  if (!target) return 'ok';
  const clubs = await prisma.club.findMany({ select: { name: true, verificationStatus: true } });
  let similar = false;
  for (const c of clubs) {
    const other = normalizeName(c.name);
    if (!other) continue;
    if (other === target) {
      if (c.verificationStatus === 'VERIFIED') return 'taken';
      similar = true;
      continue;
    }
    // Muy parecido: distancia pequeña relativa a la longitud, o uno contiene al otro
    const dist = levenshtein(target, other);
    const maxLen = Math.max(target.length, other.length);
    if (maxLen >= 4 && (dist <= 2 || (dist / maxLen) <= 0.2 || other.includes(target) || target.includes(other))) {
      similar = true;
    }
  }
  return similar ? 'similar' : 'ok';
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});


const router = Router();

const createClubSchema = z.object({
  clubName:          z.string().min(2).max(100),
  deporte:           z.string().max(50).optional(),
  department:        z.string().max(100).optional(),
  city:              z.string().max(100).optional(),
  phone:             z.string().max(30).optional(),
  memberCountApprox: z.number().int().min(0).max(100000).optional(),
});

const settingsSchema = z.object({
  name:             z.string().min(2).max(100).optional(),
  city:             z.string().max(100).optional(),
  department:       z.string().max(100).optional(),
  noAttendanceDays: z.array(z.number().min(0).max(6)).optional(),
});

// GET /clubs/trusted — pública (sin auth). Logos de clubes verificados con
// logo propio, para la sección "confían en nosotros" del landing. Solo
// expone id, nombre y logo — nada sensible.
router.get('/trusted', async (_req, res) => {
  const cacheKey = 'clubs:trusted';
  const cached = await cacheGet<{ clubs: unknown[] }>(cacheKey);
  if (cached) return res.json(cached);

  const clubs = await prisma.club.findMany({
    where: { active: true, verificationStatus: 'VERIFIED', logoUrl: { not: null } },
    select: { id: true, name: true, logoUrl: true },
    orderBy: { createdAt: 'asc' },
    take: 12,
  });

  const payload = { clubs };
  await cacheSet(cacheKey, payload, 900); // 15 min
  res.json(payload);
});

// GET /clubs/settings
router.get('/settings', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const clubId = req.user.clubId ?? '';
  const cacheKey = `club:settings:${clubId}`;

  const cached = await cacheGet<{ club: unknown }>(cacheKey);
  if (cached) return res.json(cached);

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, city: true, department: true,
      logoUrl: true, coverUrl: true, verified: true,
      noAttendanceDays: true, createdAt: true,
      suscripcion: { select: { tipoPlan: true, createdAt: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });
  await cacheSet(cacheKey, { club }, 300); // 5 min
  res.json({ club });
});

// PATCH /clubs/settings
router.patch('/settings', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const data: Record<string, unknown> = {};
  if (parsed.data.name             !== undefined) data.name             = parsed.data.name;
  if (parsed.data.city             !== undefined) data.city             = parsed.data.city;
  if (parsed.data.department       !== undefined) data.department       = parsed.data.department;
  if (parsed.data.noAttendanceDays !== undefined) data.noAttendanceDays = parsed.data.noAttendanceDays;

  const clubId = req.user.clubId ?? '';
  const club = await prisma.club.update({
    where: { id: clubId },
    data,
    select: { id: true, name: true, city: true, department: true, logoUrl: true, noAttendanceDays: true },
  });
  await cacheDel(`club:settings:${clubId}`);
  await cacheDel(`club:profile:${clubId}`);
  res.json({ club });
});

// POST /clubs/logo  — recibe base64, sube a Cloudinary
router.post('/logo', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { base64 } = req.body as { base64: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  const clubId = req.user.clubId ?? '';

  try {
    const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { logoPublicId: true } });
    if (existing?.logoPublicId) {
      await cloudinary.uploader.destroy(existing.logoPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder:     'veloclub/logos',
      public_id:  `club_${clubId}`,
      overwrite:  true,
    });

    const club = await prisma.club.update({
      where: { id: clubId },
      data:  { logoUrl: result.secure_url, logoPublicId: result.public_id },
      select: { id: true, logoUrl: true },
    });

    await cacheDel(`club:settings:${clubId}`);
    await cacheDel(`club:profile:${clubId}`);
    res.json({ club });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[logo upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /clubs/logo
router.delete('/logo', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const clubId = req.user.clubId ?? '';
  const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { logoPublicId: true } });
  if (existing?.logoPublicId) {
    await cloudinary.uploader.destroy(existing.logoPublicId).catch(() => {});
  }
  await prisma.club.update({
    where: { id: clubId },
    data:  { logoUrl: null, logoPublicId: null },
  });
  await cacheDel(`club:settings:${clubId}`);
  await cacheDel(`club:profile:${clubId}`);
  res.json({ ok: true });
});

// GET /clubs/profile — datos del club para la página de perfil
router.get('/profile', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const clubId = req.user.clubId ?? '';
  const cacheKey = `club:profile:${clubId}`;
  const cached = await cacheGet<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, city: true, department: true, deporte: true,
      logoUrl: true, coverUrl: true, verified: true, createdAt: true,
      description: true, phone: true, email: true,
      _count: { select: { members: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const members = await prisma.member.findMany({
    where: { clubId },
    select: {
      id: true, fullName: true, pictureUrl: true, role: true, clerkId: true,
    },
    orderBy: { fullName: 'asc' },
  });

  const followersCount = await prisma.follow.count({
    where: { followingClerkId: `club:${clubId}` },
  });

  // Sede principal (primera sede registrada)
  const mainLocation = await prisma.location.findFirst({
    where: { clubId },
    select: { id: true, name: true, address: true },
    orderBy: { createdAt: 'asc' },
  });

  const payload = { club, members, followersCount, mainLocation: mainLocation ?? null };
  await cacheSet(cacheKey, payload, 300); // 5 min
  res.json(payload);
});

// GET /clubs/:id/public — perfil público de cualquier club (buscador de comunidad).
// Solo datos públicos; no expone datos sensibles de miembros.
router.get('/:id/public', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const id = String(req.params.id);

  // Solo clubes verificados son visibles públicamente (anti-suplantación).
  const club = await prisma.club.findFirst({
    where: { id, active: true, verificationStatus: 'VERIFIED' },
    select: {
      id: true, name: true, city: true, department: true, deporte: true,
      logoUrl: true, coverUrl: true, verified: true, description: true, createdAt: true,
      phone: true, email: true,
      _count: { select: { members: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  const [followersCount, postsCount, mainLocation] = await Promise.all([
    prisma.follow.count({ where: { followingClerkId: `club:${id}` } }),
    prisma.post.count({ where: { clubId: id } }),
    prisma.location.findFirst({
      where: { clubId: id },
      select: { id: true, name: true, address: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  res.json({ club, followersCount, postsCount, mainLocation: mainLocation ?? null });
});

// PATCH /clubs/contact — actualizar info de contacto (solo ADMIN)
router.patch('/contact', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { phone, email } = req.body as { phone?: string; email?: string };
  const clubId = req.user.clubId ?? '';
  const updated = await prisma.club.update({
    where: { id: clubId },
    data: {
      phone: phone !== undefined ? (phone.trim() || null) : undefined,
      email: email !== undefined ? (email.trim() || null) : undefined,
    },
    select: { phone: true, email: true },
  });
  await cacheDel(`club:profile:${clubId}`);
  res.json(updated);
});

// PATCH /clubs/description — actualizar descripción del club
router.patch('/description', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { description } = req.body as { description?: string };
  const clubId = req.user.clubId ?? '';
  const updated = await prisma.club.update({
    where: { id: clubId },
    data: { description: description?.trim() || null },
    select: { description: true },
  });
  await cacheDel(`club:profile:${clubId}`);
  res.json({ description: updated.description });
});

// POST /clubs/cover — portada del club
router.post('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const { base64 } = req.body as { base64?: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  const clubId = req.user.clubId ?? '';
  try {
    const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { coverPublicId: true } });
    if (existing?.coverPublicId) {
      await cloudinary.uploader.destroy(existing.coverPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/club-covers',
      transformation: [{ width: 1200, height: 400, crop: 'fill', gravity: 'center', quality: 'auto:good' }],
    });

    const club = await prisma.club.update({
      where: { id: clubId },
      data: { coverUrl: result.secure_url, coverPublicId: result.public_id },
      select: { coverUrl: true },
    });

    await cacheDel(`club:settings:${clubId}`);
    await cacheDel(`club:profile:${clubId}`);
    res.json({ coverUrl: club.coverUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[club cover upload]', msg);
    res.status(500).json({ error: msg });
  }
});

// DELETE /clubs/cover
router.delete('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });

  const clubId = req.user.clubId ?? '';
  const existing = await prisma.club.findUnique({ where: { id: clubId }, select: { coverPublicId: true } });
  if (existing?.coverPublicId) {
    await cloudinary.uploader.destroy(existing.coverPublicId).catch(() => {});
  }
  await prisma.club.update({
    where: { id: clubId },
    data: { coverUrl: null, coverPublicId: null },
  });
  res.json({ ok: true });
});

// POST /clubs/lead  — solicitud "Contáctenos" (venta asistida). El superadmin
// la revisa y luego crea el club manualmente.
const leadSchema = z.object({
  clubName:          z.string().min(2).max(100),
  deporte:           z.string().max(50).optional(),
  department:        z.string().max(100).optional(),
  city:              z.string().max(100).optional(),
  contactName:       z.string().min(2).max(100),
  contactPhone:      z.string().min(5).max(30),
  contactEmail:      z.string().email().optional(),
  memberCountApprox: z.number().int().min(0).max(100000).optional(),
  message:           z.string().max(1000).optional(),
});

router.post('/lead', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });

  const lead = await prisma.clubLead.create({
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || req.auth.email || undefined,
    },
  });

  await prisma.notificacion.create({
    data: {
      tipo:   'CLUB_CREADO',
      titulo: 'Nueva solicitud de club (Contáctenos)',
      cuerpo: `${parsed.data.clubName} — ${parsed.data.contactName} · ${parsed.data.contactPhone}.`,
    },
  });

  res.status(201).json({ lead });
});

// GET /clubs/name-availability?name=  — chequeo en vivo del nombre al escribir
router.get('/name-availability', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
  const name = String(req.query.name ?? '').trim();
  if (name.length < 2) return res.json({ status: 'ok' });
  const collision = await checkNameCollision(name);
  res.json({ status: collision });
});

// POST /clubs  — auto-registro de club (self-serve). El usuario ya está
// autenticado en Clerk (correo/teléfono verificados). Crea el club en estado
// PENDING con trial de 15 días y al usuario como ADMIN (User + Member).
router.post('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const existing = await prisma.user.findUnique({ where: { clerkId: req.auth.clerkId } });
  if (existing) return res.status(400).json({ error: 'El usuario ya pertenece a un club' });

  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });

  const { clubName, deporte, department, city, phone, memberCountApprox } = parsed.data;

  // Anti-suplantación: no permitir duplicar el nombre de un club verificado.
  const collision = await checkNameCollision(clubName);
  if (collision === 'taken') {
    return res.status(409).json({
      error: 'name_taken',
      message: 'Ya existe un club verificado con ese nombre. Diferéncialo con tu ciudad o un distintivo.',
    });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const club = await prisma.club.create({
    data: {
      name:              clubName.trim(),
      deporte:           deporte || undefined,
      department:        department || undefined,
      city:              city || undefined,
      phone:             phone || undefined,
      memberCountApprox: memberCountApprox ?? undefined,
      trialEndsAt,
      verificationStatus: 'PENDING',
      nameFlagged:       collision === 'similar',
      users: {
        create: {
          clerkId:         req.auth.clerkId,
          email:           req.auth.email,
          name:            req.auth.name,
          picture:         req.auth.picture,
          role:            'ADMIN',
          profileComplete: true,
        },
      },
      members: {
        create: {
          fullName:     req.auth.name || 'Administrador',
          email:        req.auth.email,
          phone:        phone || undefined,
          role:         'ADMIN',
          clerkId:      req.auth.clerkId,
          inviteStatus: 'ACCEPTED',
        },
      },
    },
    include: { users: true },
  });

  // Mantener el correo en el allowlist (consistencia con clubes creados por superadmin)
  try { await addToAllowlist(req.auth.email); } catch { /* ignorar */ }

  // Avisar al superadmin que hay un club nuevo por verificar
  await prisma.notificacion.create({
    data: {
      tipo:   'CLUB_CREADO',
      titulo: 'Nuevo club por verificar',
      cuerpo: `${clubName.trim()} se auto-registró${collision === 'similar' ? ' (nombre parecido a otro, revisar)' : ''}. Admin: ${req.auth.name || req.auth.email}.`,
    },
  });

  res.status(201).json({ club });
});

export default router;
