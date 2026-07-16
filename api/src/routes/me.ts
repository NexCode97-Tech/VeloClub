import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { v2 as cloudinary } from 'cloudinary';
import { removeFromAllowlist, revokeClerkAccess } from '../lib/clerk-allowlist';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const { clerkId, email, name, picture } = req.auth;

  // Superadmin check (case-insensitive, soporta coma o salto de línea como separador)
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(/[,\n]/).map(e => e.trim().toLowerCase()).filter(Boolean);
if (superadminEmails.includes(email.toLowerCase())) {
    // Buscar por email (case-insensitive) — el clerkId puede haber cambiado al migrar de instancia
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    let user;
    if (existingByEmail && existingByEmail.clerkId !== clerkId) {
      // Actualizar el clerkId al de la nueva instancia
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId, name, picture, role: 'SUPERADMIN', profileComplete: true },
      });
    } else {
      user = await prisma.user.upsert({
        where: { clerkId },
        update: { name, picture, role: 'SUPERADMIN', profileComplete: true },
        create: { clerkId, email, name, picture: picture ?? null, role: 'SUPERADMIN', profileComplete: true },
      });
    }
    return res.json({ status: 'superadmin', user });
  }

  // Check if user already exists in DB — buscar por clerkId o por email (migración de instancia)
  let user = await prisma.user.findUnique({ where: { clerkId }, include: { club: true } });
  if (!user) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { club: true },
    });
    if (byEmail) {
      // Actualizar clerkId al de la nueva instancia
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { clerkId },
        include: { club: true },
      });
    }
  }

  if (user) {
    // Update name/picture if changed in Clerk
    let resolvedName = name || user.name;
    if (!resolvedName || resolvedName === 'Usuario') {
      const member = await prisma.member.findFirst({
        where: { OR: [{ clerkId }, { email: { equals: email, mode: 'insensitive' } }] },
      });
      if (member?.fullName) resolvedName = member.fullName;
    }
    if (user.name !== resolvedName || user.picture !== picture) {
      user = await prisma.user.update({
        where: { clerkId },
        data: { name: resolvedName, picture },
        include: { club: true },
      });
    }

    // Sincronizar foto de Clerk/Google al Member, Posts y Comentarios si cambió
    if (picture && user.picture === picture) {
      // La foto es la misma que ya tenemos — verificar si posts/comments están desactualizados
    }
    if (picture) {
      const linkedMember = await prisma.member.findFirst({ where: { clerkId } });
      const pictureChanged = linkedMember ? linkedMember.pictureUrl !== picture : false;

      // Actualizar Member
      if (linkedMember && pictureChanged) {
        await prisma.member.update({
          where: { id: linkedMember.id },
          data: { pictureUrl: picture },
        });
      }

      // Sincronizar authorAvatar en Posts y Comentarios del usuario
      // Se hace siempre (no solo cuando cambia) para cubrir posts creados antes de la sincronización
      const userName = user.name;
      await Promise.all([
        prisma.post.updateMany({
          where: { authorName: userName, clubId: user.clubId ?? undefined, authorAvatar: { not: picture } },
          data: { authorAvatar: picture },
        }),
        prisma.postComment.updateMany({
          where: { authorName: userName, authorAvatar: { not: picture } },
          data: { authorAvatar: picture },
        }),
      ]);
    }

    // Check club active
    if (user.club && !user.club.active) {
      return res.json({ status: 'inactive' });
    }

    // Check trial
    const now = new Date();
    const trialEndsAt = user.club?.trialEndsAt ?? null;
    if (trialEndsAt && trialEndsAt < now) {
      return res.json({ status: 'trial_expired', role: user.role });
    }
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : null;
    const trial = trialDaysLeft !== null
      ? { daysLeft: trialDaysLeft, endsAt: trialEndsAt!.toISOString() }
      : null;

    if (!user.profileComplete) {
      return res.json({ status: 'complete_profile', user });
    }

    return res.json({ status: 'ok', user: { ...user, coverUrl: user.coverUrl ?? null }, trial });
  }

  // New user — check if email was pre-registered as a Member (case-insensitive)
  const member = await prisma.member.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { club: true },
  });

  if (!member) {
    return res.json({ status: 'no_access' });
  }

  if (!member.club.active) {
    return res.json({ status: 'inactive' });
  }

  // Check trial para nuevo usuario
  const nowNew = new Date();
  if (member.club.trialEndsAt && member.club.trialEndsAt < nowNew) {
    return res.json({ status: 'trial_expired', role: member.role });
  }

  // Create user record linked to this member's club
  const newUser = await prisma.user.create({
    data: {
      clerkId,
      email,
      name: member.fullName,
      picture: picture ?? null,
      role: member.role,
      clubId: member.clubId,
      profileComplete: true,
    },
    include: { club: true },
  });

  // Link member to clerkId y sincronizar foto de Clerk/Google
  await prisma.member.update({
    where: { id: member.id },
    data: {
      clerkId,
      inviteStatus: 'ACCEPTED',
      ...(picture ? { pictureUrl: picture } : {}),
    },
  });

  return res.json({ status: 'complete_profile', user: newUser });
});

// PATCH /me/bio — actualizar bio del usuario
router.patch('/bio', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const { bio } = req.body as { bio?: string };
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { bio: bio?.trim() || null },
    select: { bio: true },
  });
  res.json({ bio: updated.bio });
});

// POST /me/cover — subir foto de portada del perfil
router.post('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const { base64 } = req.body as { base64?: string };
  if (!base64) return res.status(400).json({ error: 'base64 requerido' });

  try {
    // Eliminar portada anterior si existe
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { coverPublicId: true } });
    if (current?.coverPublicId) {
      await cloudinary.uploader.destroy(current.coverPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(base64, {
      folder: 'veloclub/covers',
      transformation: [{ width: 1200, height: 400, crop: 'fill', gravity: 'center', quality: 'auto:good' }],
    });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { coverUrl: result.secure_url, coverPublicId: result.public_id },
    });

    res.json({ coverUrl: user.coverUrl });
  } catch (err) {
    console.error('cover upload error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Error al subir la portada' });
  }
});

// DELETE /me/cover — eliminar foto de portada
router.delete('/cover', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  try {
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { coverPublicId: true } });
    if (current?.coverPublicId) {
      await cloudinary.uploader.destroy(current.coverPublicId).catch(() => {});
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { coverUrl: null, coverPublicId: null },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('cover delete error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Error al eliminar la portada' });
  }
});

// PATCH /me/profile — complete profile on first login
router.patch('/profile', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const { phone, birthDate, emergencyContact, emergencyPhone } = req.body as {
    phone?: string; birthDate?: string; emergencyContact?: string; emergencyPhone?: string;
  };

  const user = await prisma.user.update({
    where: { clerkId: req.auth.clerkId },
    data: { profileComplete: true },
    include: { club: true },
  });

  const member = await prisma.member.findFirst({ where: { clerkId: req.auth.clerkId } });
  if (member) {
    await prisma.member.update({
      where: { id: member.id },
      data: {
        phone: phone ?? member.phone ?? undefined,
        birthDate: birthDate ? new Date(birthDate) : member.birthDate ?? undefined,
        emergencyContact: emergencyContact ?? member.emergencyContact ?? undefined,
        emergencyPhone: emergencyPhone ?? member.emergencyPhone ?? undefined,
      },
    });
  }

  res.json({ status: 'ok', user });
});

// DELETE /me — el propio usuario elimina su cuenta (Admin, Entrenador o Deportista).
// El Member se anonimiza (no se borra) para conservar pagos/asistencia por
// obligaciones contables del club; el acceso a Clerk queda revocado.
router.delete('/', requireAuth, async (req, res) => {
  if (!req.auth || !req.user) return res.status(401).json({ error: 'No autenticado' });

  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { clerkId: req.auth.clerkId },
        ...(req.auth.email ? [{ email: { equals: req.auth.email, mode: 'insensitive' as const } }] : []),
      ],
    },
  });

  // No permitir que el único admin de un club activo elimine su cuenta —
  // dejaría el club sin nadie que lo administre.
  if (member?.role === 'ADMIN') {
    const otherAdmins = await prisma.member.count({
      where: { clubId: member.clubId, role: 'ADMIN', id: { not: member.id } },
    });
    if (otherAdmins === 0) {
      return res.status(409).json({
        error: 'unique_admin',
        message: 'Eres el único administrador de este club. Agrega otro administrador desde Miembros, o elimina el club, antes de eliminar tu cuenta.',
      });
    }
  }

  // Revocar acceso Clerk (banea + revoca sesiones) y quitar del allowlist
  if (req.auth.email) {
    try { await removeFromAllowlist(req.auth.email); } catch { /* ignorar */ }
  }
  await revokeClerkAccess(req.auth.clerkId);

  // Anonimizar el Member — conserva pagos/asistencia, borra datos personales
  if (member) {
    const publicIds = [member.picturePublicId, member.docFilePublicId, member.insurancePublicId].filter(Boolean) as string[];
    await Promise.all(publicIds.map(id => cloudinary.uploader.destroy(id).catch(() => {})));

    await prisma.member.update({
      where: { id: member.id },
      data: {
        fullName: 'Usuario eliminado',
        email: null,
        phone: null,
        pictureUrl: null,
        picturePublicId: null,
        docType: null,
        docNumber: null,
        docFileUrl: null,
        docFilePublicId: null,
        insuranceFileUrl: null,
        insurancePublicId: null,
        emergencyContact: null,
        emergencyPhone: null,
        eps: null,
        clerkId: null,
      },
    });
  }

  // Borrar el registro de autenticación/perfil
  const currentUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { coverPublicId: true } });
  if (currentUser?.coverPublicId) {
    await cloudinary.uploader.destroy(currentUser.coverPublicId).catch(() => {});
  }
  await prisma.user.delete({ where: { id: req.user.id } }).catch(() => {});

  res.json({ ok: true });
});

// PATCH /me/accept-terms — el usuario acepta la Política de Tratamiento de Datos
// y los Términos y Condiciones. Aplica a todos los roles con User (ADMIN, COACH,
// STUDENT); el superadmin nunca llega aquí porque /me lo redirige antes.
router.patch('/accept-terms', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { termsAcceptedAt: new Date() },
    select: { termsAcceptedAt: true },
  });
  res.json({ termsAcceptedAt: user.termsAcceptedAt });
});

export default router;

