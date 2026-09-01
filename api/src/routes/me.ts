import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { selectorDeDeporte } from '../lib/deportes';
import { estadoPrimerHorario } from '../lib/primer-horario';
import { prisma } from '../db/client';
import { v2 as cloudinary } from 'cloudinary';
import { removeFromAllowlist, revokeClerkAccess } from '../lib/clerk-allowlist';
import { verificarYDesactivarSiVencido } from '../lib/sync-suscripciones';
import { validarSubida } from '../lib/upload-guard';
import { uploadLimiter } from '../lib/rate-limit';

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
    // Autorreparacion: una cuenta sin club que si tiene registro de miembro se
    // vuelve a vincular sola al entrar. Sin esto, la persona queda atrapada en
    // un estado del que no puede salir por su cuenta: Ajustes responde 404
    // (busca un club con id vacio) y no puede asignar sedes al crear miembros,
    // porque todo se valida contra un club que no existe. Le paso a tres
    // cuentas, dos de ellas administradores, y solo se pudo arreglar a mano.
    if (!user.clubId) {
      const miembroDelUsuario = await prisma.member.findFirst({
        where: {
          OR: [
            { clerkId },
            ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ],
        },
        select: { clubId: true, deporteId: true, role: true, club: { select: { active: true } } },
        orderBy: { createdAt: 'desc' },
      });
      // Un club desactivado no se revincula: ahi el bloqueo es intencional
      if (miembroDelUsuario?.club?.active) {
        user = await prisma.user.update({
          where: { clerkId },
          // El rol manda desde el registro de miembro, que es donde el club lo
          // administra: al desvincularse, una cuenta podia quedar con un rol
          // viejo y menos permisos de los que le corresponden.
          data: {
            clubId: miembroDelUsuario.clubId,
            role: miembroDelUsuario.role,
            deporteId: miembroDelUsuario.deporteId,
          },
          include: { club: true },
        });
        console.log(`[me] cuenta revinculada al club ${miembroDelUsuario.clubId}: ${email}`);
      }
    }

    // Nombre visible: gana el lado donde de verdad lo cambiaron.
    //
    // Hay tres copias del nombre — Clerk, User y Member — y se puede editar
    // desde dos sitios: Ajustes de VeloClub y el modal de cuenta de Clerk. Con
    // una regla fija ("manda Clerk" o "manda el club") uno de los dos caminos
    // siempre pierde: editabas en un lado y al recargar volvía el otro valor.
    //
    // La señal de quién cambió es comparar Clerk contra la última copia que
    // guardamos en User: si difieren, la edición fue en Clerk. Si coinciden, en
    // Clerk no tocaron nada y manda el registro de miembro, que es donde el
    // club administra el nombre y de donde sale el resto de la interfaz.
    //
    // Esto además corrige lo que ya estaba en producción: un administrador con
    // «ADMINISTRADOR VELOCLUB» en Clerk aparecía así en el sidebar mientras
    // Miembros, el feed y Mi perfil lo llamaban por su nombre real.
    const miembroVinculado = await prisma.member.findFirst({
      where: { OR: [{ clerkId }, { email: { equals: email, mode: 'insensitive' } }] },
      select: { id: true, fullName: true },
    });
    const cambiadoEnClerk = !!name && name !== user.name;
    const resolvedName = cambiadoEnClerk
      ? name
      : (miembroVinculado?.fullName || user.name || name);

    // El nombre elegido baja al registro de miembro para que las tres copias
    // queden iguales; si no, la próxima carga volvería a verlas distintas y
    // reabriría el mismo desacuerdo.
    if (miembroVinculado && resolvedName && miembroVinculado.fullName !== resolvedName) {
      await prisma.member.update({
        where: { id: miembroVinculado.id },
        data: { fullName: resolvedName },
      });
    }
    if (user.name !== resolvedName || user.picture !== picture) {
      const nombreCambio = user.name !== resolvedName;
      user = await prisma.user.update({
        where: { clerkId },
        data: { name: resolvedName, picture },
        include: { club: true },
      });

      // El nombre también firma lo ya publicado. Sin esto, cambiarlo lo dejaba
      // corregido en el perfil pero con el nombre viejo en cada publicación y
      // comentario, que es donde más lo ven los demás.
      //
      // Se filtra por authorClerkId y no por authorName: dos personas del mismo
      // club pueden llamarse igual, y renombrar por nombre le cambiaría la firma
      // a la publicación de otro.
      if (nombreCambio && resolvedName) {
        await Promise.all([
          prisma.post.updateMany({
            where: { authorClerkId: clerkId, authorName: { not: resolvedName } },
            data: { authorName: resolvedName },
          }),
          prisma.postComment.updateMany({
            where: { authorClerkId: clerkId, authorName: { not: resolvedName } },
            data: { authorName: resolvedName },
          }),
        ]);
      }
    }

    // Sincronizar foto de Clerk/Google al Member, Posts y Comentarios si cambió
    if (picture && user.picture === picture) {
      // La foto es la misma que ya tenemos — verificar si posts/comments están desactualizados
    }
    if (picture) {
      // Se busca por clerkId O por email, igual que el nombre unas líneas más
      // arriba. Antes solo miraba clerkId, y un miembro creado por el club no
      // lo tiene: la foto nueva se veía en el sidebar, que la lee de Clerk, y
      // en Miembros seguía la vieja porque el registro nunca se enteraba.
      const linkedMember = await prisma.member.findFirst({
        where: { OR: [{ clerkId }, { email: { equals: email, mode: 'insensitive' } }] },
        select: { id: true, pictureUrl: true },
      });
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

    // Check club active — incluir el rol es imprescindible: la página /inactivo
    // decide con él si muestra la pantalla de pago (ADMIN) o el aviso de "avísale
    // a tu admin" (coach/deportista). Sin rol, hasta el admin quedaba atrapado
    // sin poder pagar para reactivar el club.
    if (user.club && !user.club.active) {
      return res.json({ status: 'inactive', role: user.role });
    }

    // Miembro desactivado (pausa por vacaciones). Es un estado propio y no
    // 'inactive' porque el mensaje es muy distinto: el club sigue funcionando,
    // el que está en pausa es él, y quien lo reactiva es su administrador.
    const miembro = await prisma.member.findFirst({
      where: { clubId: user.clubId ?? '', clerkId },
      select: { active: true },
    });
    if (miembro && !miembro.active) {
      return res.json({ status: 'member_inactive', role: user.role });
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

    // Ya pasó el trial (o nunca lo tuvo) — verificar que el plan pagado siga
    // vigente y desactivar al instante si venció, sin esperar al cron diario.
    if (user.clubId && trialEndsAt === null) {
      const vencido = await verificarYDesactivarSiVencido(user.clubId);
      if (vencido) return res.json({ status: 'inactive', role: user.role });
    }

    if (!user.profileComplete) {
      return res.json({ status: 'complete_profile', user });
    }

    return res.json({
      status: 'ok',
      user: { ...user, coverUrl: user.coverUrl ?? null },
      trial,
      deportes: await selectorDeDeporte(req),
      // Viaja en /me y no en una consulta aparte: el panel ya lo llama en cada
      // carga, y una peticion mas solo para preguntar si abrir un modal se
      // paga en cada entrada de cada usuario.
      primerHorario: await estadoPrimerHorario({
        clubId: user.clubId,
        deporteId: req.deporteId,
        rol: user.role,
        aplazadoAt: user.horarioAplazadoAt,
        aplazos: user.horarioAplazos,
      }),
    });
  }

  // New user — check if email was pre-registered as a Member (case-insensitive)
  //
  // Se busca por clerkId ADEMÁS de por correo. Un miembro ya vinculado que se
  // quedó sin registro de User (o cuyo correo en Clerk dejó de coincidir con el
  // que tiene en el club) caía en `needs_onboarding` y terminaba creándose otro
  // club, aunque el suyo lo tuviera como administrador. Le pasó a un
  // administrador de SBM Barbosa: Member con rol ADMIN, clerkId vinculado y sin
  // User, así que el backend nunca lo vio como administrador.
  //
  // Es el mismo criterio que ya usa la autorreparación de arriba; aquí faltaba.
  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { clerkId },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    include: { club: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!member) {
    // Usuario autenticado sin club ni invitación previa → puede auto-registrar
    // su club (self-serve) o contactarnos. El onboarding decide.
    return res.json({ status: 'needs_onboarding' });
  }

  if (!member.club.active) {
    return res.json({ status: 'inactive', role: member.role });
  }

  if (!member.active) {
    return res.json({ status: 'member_inactive', role: member.role });
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
      // Hereda la carpeta de su ficha: entra al deporte en el que el club lo
      // tiene, no al primero que haya.
      deporteId: member.deporteId,
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

// PATCH /me/name — el usuario actualiza su nombre visible. Sincroniza las tres
// fuentes (User, Member y Clerk) para que /me no lo revierta en el próximo login.
router.patch('/name', requireAuth, async (req, res) => {
  if (!req.auth || !req.user) return res.status(401).json({ error: 'No autenticado' });
  const name = String((req.body as { name?: string }).name ?? '').trim();
  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres' });
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { name } });

  const member = await prisma.member.findFirst({ where: { clerkId: req.auth.clerkId } });
  if (member) {
    await prisma.member.update({ where: { id: member.id }, data: { fullName: name } });
  }

  // La firma de lo ya publicado también es el nombre. Se hace acá y no solo en
  // /me porque para cuando /me vuelva a correr, User y Clerk ya coinciden con el
  // nombre nuevo y no queda señal de que hubo un cambio que propagar.
  await Promise.all([
    prisma.post.updateMany({
      where: { authorClerkId: req.auth.clerkId, authorName: { not: name } },
      data: { authorName: name },
    }),
    prisma.postComment.updateMany({
      where: { authorClerkId: req.auth.clerkId, authorName: { not: name } },
      data: { authorName: name },
    }),
  ]);

  // Sincronizar en Clerk (si falla, User/Member ya quedaron actualizados)
  try {
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    const [firstName, ...rest] = name.split(/\s+/);
    await clerk.users.updateUser(req.auth.clerkId, { firstName, lastName: rest.join(' ') || undefined });
  } catch (err) {
    console.error('clerk name sync error:', err instanceof Error ? err.message : err);
  }

  res.json({ name });
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
router.post('/cover', uploadLimiter, requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const { base64 } = req.body as { base64?: string };
  const vCover = validarSubida(base64, 'image');
  if (!vCover.ok) return res.status(400).json({ error: vCover.error });

  try {
    // Eliminar portada anterior si existe
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { coverPublicId: true } });
    if (current?.coverPublicId) {
      await cloudinary.uploader.destroy(current.coverPublicId).catch(() => {});
    }

    const result = await cloudinary.uploader.upload(vCover.data, {
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

  res.json({ status: 'ok', user, deportes: await selectorDeDeporte(req) });
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
// y los Términos y Condiciones. Aplica a todos los roles con User (ADMIN, ENTRENADOR,
// DEPORTISTA); el superadmin nunca llega aquí porque /me lo redirige antes.
router.patch('/accept-terms', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { termsAcceptedAt: new Date() },
    select: { termsAcceptedAt: true },
  });
  res.json({ termsAcceptedAt: user.termsAcceptedAt });
});

// POST /me/aplazar-horario — «Ahora no» del modal de armar el horario.
//
// Suma uno y guarda la fecha. La regla de que hacer con esos dos numeros vive
// en `lib/primer-horario.ts`, no aca: esta ruta solo anota lo que paso.
router.post('/aplazar-horario', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const user = await prisma.user.update({
    where: { clerkId: req.auth.clerkId },
    data: {
      horarioAplazadoAt: new Date(),
      horarioAplazos: { increment: 1 },
    },
    select: { horarioAplazos: true },
  });

  res.json({ ok: true, aplazos: user.horarioAplazos });
});

export default router;

