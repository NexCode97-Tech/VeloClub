import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const { clerkId, email, name, picture } = req.auth;

  // Superadmin check
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);
  if (superadminEmails.includes(email)) {
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { name, picture, role: 'SUPERADMIN', profileComplete: true },
      create: { clerkId, email, name, picture: picture ?? null, role: 'SUPERADMIN', profileComplete: true },
    });
    return res.json({ status: 'superadmin', user });
  }

  // Check if user already exists in DB
  let user = await prisma.user.findUnique({ where: { clerkId }, include: { club: true } });

  if (user) {
    // Update name/picture if changed in Clerk
    if (user.name !== name || user.picture !== picture) {
      user = await prisma.user.update({
        where: { clerkId },
        data: { name, picture },
        include: { club: true },
      });
    }

    // Check club active
    if (user.club && !user.club.active) {
      return res.json({ status: 'inactive' });
    }

    if (!user.profileComplete) {
      return res.json({ status: 'complete_profile', user });
    }

    return res.json({ status: 'ok', user });
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

  // Link member to clerkId
  await prisma.member.update({
    where: { id: member.id },
    data: { clerkId, inviteStatus: 'ACCEPTED' },
  });

  return res.json({ status: 'complete_profile', user: newUser });
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

export default router;
