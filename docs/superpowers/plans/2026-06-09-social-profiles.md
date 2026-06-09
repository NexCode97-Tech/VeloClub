# Social Profiles + Follow System + Club Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el perfil de usuario con layout estilo Facebook/Instagram, agregar sistema de seguidores, perfil de club con portada e insignia de verificación, galería de fotos en cuadrícula, y badge del club sobre la foto de perfil de cada miembro.

**Architecture:** Se añade un modelo `Follow` en Prisma (usando `clerkId` como identificador universal entre Users y Members). Se agregan campos `coverUrl/coverPublicId/verified` al modelo `Club`. El perfil de usuario existente (`/dashboard/perfil`) se rediseña con foto más grande, badge del club, contadores de seguidores/siguiendo y una pestaña de galería. Se crea `/dashboard/club` como nueva página para el perfil del club. Se crea `/dashboard/perfil/[id]` para ver el perfil público de cualquier miembro/usuario con botón Follow.

**Tech Stack:** Prisma (PostgreSQL en Railway), Express 4 + TypeScript, Next.js 15 App Router, Tailwind v4, Cloudinary, Framer Motion, TanStack Query, shadcn/ui.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `api/prisma/schema.prisma` | Modificar | Añadir `Follow`, campos `Club.coverUrl/coverPublicId/verified` |
| `api/prisma/migrations/20260609150000_social_profiles/migration.sql` | Crear | SQL sin BOM para nuevas columnas/tabla |
| `api/src/routes/follows.ts` | Crear | POST toggle, GET stats por clerkId |
| `api/src/routes/profiles.ts` | Crear | GET perfil público de cualquier clerkId |
| `api/src/routes/clubs.ts` | Modificar | Añadir GET /profile, POST /cover, DELETE /cover |
| `api/src/index.ts` | Modificar | Registrar `/follows` y `/profiles` |
| `web/app/dashboard/perfil/page.tsx` | Modificar | Rediseño: foto grande, badge club, contadores, galería |
| `web/app/dashboard/perfil/[id]/page.tsx` | Crear | Vista pública de perfil + botón Follow |
| `web/app/dashboard/club/page.tsx` | Crear | Perfil del club: portada, logo, miembros, badge verificado |
| `web/app/dashboard/layout.tsx` | Modificar | Añadir "Club" al nav de ADMIN y COACH |

---

## Task 1: Prisma — Modelo Follow + campos Club

**Archivos:**
- Modificar: `api/prisma/schema.prisma`
- Crear: `api/prisma/migrations/20260609150000_social_profiles/migration.sql`

- [ ] **Paso 1: Añadir campos al modelo Club y nuevo modelo Follow en schema.prisma**

En `api/prisma/schema.prisma`, modificar el modelo `Club` para añadir después de `logoPublicId`:

```prisma
model Club {
  id                String          @id @default(cuid())
  name              String
  city              String?
  department        String?
  logoUrl           String?
  logoPublicId      String?
  coverUrl          String?         // ← NUEVO
  coverPublicId     String?         // ← NUEVO
  verified          Boolean         @default(false)  // ← NUEVO
  active            Boolean         @default(true)
  trialEndsAt       DateTime?
  deporte           String?
  noAttendanceDays  Int[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  users          User[]
  locations      Location[]
  members        Member[]
  payments       Payment[]
  cashEntries    CashEntry[]
  competitions      Competition[]
  trainingSessions  TrainingSession[]
  calendarEvents    CalendarEvent[]
  attendances    Attendance[]
  suscripcion    ClubSuscripcion?
  posts          Post[]
}
```

Al final del schema, antes de los enums, añadir el modelo `Follow`:

```prisma
// ─── Follow (sistema de seguidores) ─────────────────────────────────────────

model Follow {
  id               String   @id @default(cuid())
  followerClerkId  String
  followingClerkId String
  createdAt        DateTime @default(now())

  @@unique([followerClerkId, followingClerkId])
  @@index([followerClerkId])
  @@index([followingClerkId])
}
```

- [ ] **Paso 2: Crear migración SQL limpia (sin BOM)**

Crear el directorio y el archivo de migración usando `printf` en bash para evitar BOM:

```bash
mkdir -p "api/prisma/migrations/20260609150000_social_profiles"
printf 'ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;\nALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "coverPublicId" TEXT;\nALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;\n\nCREATE TABLE IF NOT EXISTS "Follow" (\n  "id" TEXT NOT NULL,\n  "followerClerkId" TEXT NOT NULL,\n  "followingClerkId" TEXT NOT NULL,\n  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")\n);\n\nCREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerClerkId_followingClerkId_key" ON "Follow"("followerClerkId", "followingClerkId");\nCREATE INDEX IF NOT EXISTS "Follow_followerClerkId_idx" ON "Follow"("followerClerkId");\nCREATE INDEX IF NOT EXISTS "Follow_followingClerkId_idx" ON "Follow"("followingClerkId");\n' > "api/prisma/migrations/20260609150000_social_profiles/migration.sql"
```

- [ ] **Paso 3: Verificar que el archivo no tiene BOM**

```bash
xxd "api/prisma/migrations/20260609150000_social_profiles/migration.sql" | head -1
```

Debe comenzar con `4154 4c54` (= `ALTE`), NO con `efbb bf` (BOM). Si tiene BOM, eliminar con:
```bash
printf '%s' "$(cat api/prisma/migrations/20260609150000_social_profiles/migration.sql)" > /tmp/clean.sql && mv /tmp/clean.sql "api/prisma/migrations/20260609150000_social_profiles/migration.sql"
```

- [ ] **Paso 4: Regenerar Prisma client**

```bash
cd api && npx prisma generate
```

Esperado: `✔ Generated Prisma Client`

- [ ] **Paso 5: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/
git commit -m "feat(db): add Follow model, Club cover and verified fields"
```

---

## Task 2: API — Rutas de Follow

**Archivos:**
- Crear: `api/src/routes/follows.ts`
- Modificar: `api/src/index.ts`

- [ ] **Paso 1: Crear `api/src/routes/follows.ts`**

```typescript
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
```

- [ ] **Paso 2: Registrar ruta en `api/src/index.ts`**

Añadir después de `import postsRouter`:
```typescript
import followsRouter from './routes/follows';
import profilesRouter from './routes/profiles';
```

Añadir después de `app.use('/posts', postsRouter);`:
```typescript
app.use('/follows', followsRouter);
app.use('/profiles', profilesRouter);
```

- [ ] **Paso 3: Commit**

```bash
git add api/src/routes/follows.ts api/src/index.ts
git commit -m "feat(api): add follow toggle and stats routes"
```

---

## Task 3: API — Ruta de Perfiles Públicos

**Archivos:**
- Crear: `api/src/routes/profiles.ts`

- [ ] **Paso 1: Crear `api/src/routes/profiles.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

// GET /profiles/:clerkId — perfil público de cualquier usuario/miembro
// Busca primero en User, luego en Member por clerkId
router.get('/:clerkId', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const { clerkId } = req.params;

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
    // Traer imágenes de posts del usuario (para galería)
    const postImages = await prisma.post.findMany({
      where: { authorName: user.name, imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, imageUrl: true, createdAt: true },
    });

    // Contadores de follows
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
```

- [ ] **Paso 2: Commit**

```bash
git add api/src/routes/profiles.ts
git commit -m "feat(api): add public profile route GET /profiles/:clerkId"
```

---

## Task 4: API — Perfil del Club (portada + follow)

**Archivos:**
- Modificar: `api/src/routes/clubs.ts`

- [ ] **Paso 1: Añadir GET /clubs/profile en `api/src/routes/clubs.ts`**

Añadir después de `GET /clubs/settings` (línea 40), antes de `PATCH /clubs/settings`:

```typescript
// GET /clubs/profile — datos completos del club para la página de perfil del club
router.get('/profile', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });

  const clubId = req.user.clubId ?? '';
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, city: true, department: true, deporte: true,
      logoUrl: true, coverUrl: true, verified: true, createdAt: true,
      _count: { select: { members: true } },
    },
  });
  if (!club) return res.status(404).json({ error: 'Club no encontrado' });

  // Miembros activos con foto para la grid
  const members = await prisma.member.findMany({
    where: { clubId, inviteStatus: 'ACCEPTED' },
    select: {
      id: true, fullName: true, pictureUrl: true, role: true, clerkId: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });

  // Total de seguidores del club (usando el club.id como followingClerkId no aplica —
  // Para el club usamos una convención: followingClerkId = `club:${clubId}`)
  const followersCount = await prisma.follow.count({
    where: { followingClerkId: `club:${clubId}` },
  });

  res.json({ club, members, followersCount });
});
```

- [ ] **Paso 2: Añadir POST /clubs/cover y DELETE /clubs/cover**

Añadir después de `DELETE /clubs/logo` (línea 115), antes de `POST /clubs`:

```typescript
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
```

- [ ] **Paso 3: Actualizar `GET /clubs/settings` para incluir `coverUrl` y `verified`**

Cambiar el `select` en `GET /clubs/settings` para incluir los nuevos campos:

```typescript
select: {
  id: true, name: true, city: true, department: true,
  logoUrl: true, coverUrl: true, verified: true,
  noAttendanceDays: true, createdAt: true,
  suscripcion: { select: { tipoPlan: true, createdAt: true } },
},
```

- [ ] **Paso 4: Commit**

```bash
git add api/src/routes/clubs.ts
git commit -m "feat(api): add club profile, cover upload/delete routes"
```

---

## Task 5: Frontend — Rediseño `/dashboard/perfil`

**Archivos:**
- Modificar: `web/app/dashboard/perfil/page.tsx`

Cambios clave vs. el código actual:
1. Foto de perfil: `size={80}` → `size={120}`, `marginTop: -40` → `marginTop: -60`
2. Badge del club: círculo pequeño (32px) con `club.logoUrl` en esquina inferior derecha de la foto
3. Contadores: añadir `Seguidores` y `Siguiendo` junto a `Publicaciones`
4. Nueva pestaña `Fotos` en `TABS`
5. Galería: grid 3 columnas, overlay `+N` en la quinta cuando `postImages.length > 5`
6. Layout: `max-w-2xl` → `max-w-4xl mx-auto`
7. `/me` ya devuelve `coverUrl` — no hay cambio en API

- [ ] **Paso 1: Actualizar `MeResponse` para incluir `clerkId` y `followStats`**

Reemplazar la interfaz `MeResponse` actual con:

```typescript
interface MeResponse {
  status: string;
  user?: {
    id: string;
    clerkId: string;
    name: string;
    role: string;
    club?: {
      name: string; logoUrl?: string; city?: string;
      department?: string; verified?: boolean; deporte?: string;
    };
    picture?: string | null;
    coverUrl?: string | null;
    createdAt?: string;
    category?: string;
    bio?: string;
  };
}

interface PostImage { id: string; imageUrl: string }

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}
```

- [ ] **Paso 2: Añadir estados para galería y follow stats en el componente**

Añadir después de `const [deletingCover, setDeletingCover] = useState(false);`:

```typescript
const [postImages, setPostImages]     = useState<PostImage[]>([]);
const [followStats, setFollowStats]   = useState<FollowStats>({ followersCount: 0, followingCount: 0, isFollowing: false });
const [myClerkId, setMyClerkId]       = useState<string>('');
```

- [ ] **Paso 3: Cargar galería y follow stats en el `useEffect` inicial**

En el bloque `(async () => { ... })()` del `useEffect`, después de `setCurrentUserId(userId ?? '')`:

```typescript
// Cargar imágenes de posts para la galería
if (meRes.status === 'fulfilled') {
  const clerkId = meRes.value.user ? userId ?? '' : '';
  setMyClerkId(clerkId);
  if (clerkId) {
    try {
      const token2 = await session?.getToken();
      const imagesRes = await apiFetch<{ posts: { id: string; imageUrl?: string | null }[] }>(
        `/posts?scope=public`, { token: token2 }
      );
      const imgs = imagesRes.posts
        .filter(p => p.imageUrl)
        .map(p => ({ id: p.id, imageUrl: p.imageUrl! }));
      setPostImages(imgs);

      const statsRes = await apiFetch<FollowStats>(`/follows/stats/${clerkId}`, { token: token2 });
      setFollowStats(statsRes);
    } catch { /* silencioso */ }
  }
}
```

- [ ] **Paso 4: Actualizar `TABS` para incluir "Fotos"**

```typescript
const TABS = ['Publicaciones', 'Fotos', 'Acerca de'] as const;
type Tab = typeof TABS[number];
```

- [ ] **Paso 5: Reemplazar el bloque de Avatar + Nombre + Stats en el JSX**

Reemplazar desde `{/* Info del usuario */}` hasta el cierre del `<div className="px-5 pb-5">`:

```tsx
{/* Info del usuario */}
<div className="px-5 pb-5 max-w-4xl mx-auto w-full">
  {/* Avatar con badge del club */}
  <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
    <div className="relative z-10">
      {/* Foto de perfil */}
      <div className="rounded-full border-4 border-white overflow-hidden"
        style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.20)', width: 120, height: 120 }}>
        <Avatar src={user?.picture} name={user?.name ?? 'Usuario'} size={120} role={role} />
      </div>
      {/* Badge del club — esquina inferior derecha */}
      {user?.club?.logoUrl && (
        <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white overflow-hidden"
          style={{ width: 32, height: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={user.club.logoUrl} alt={user.club.name} className="w-full h-full object-cover" />
        </div>
      )}
      {/* Badge verificado si el club está verificado */}
      {user?.club?.verified && !user?.club?.logoUrl && (
        <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white flex items-center justify-center"
          style={{ width: 28, height: 28, background: '#4361EE' }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  </div>

  {/* Nombre y rol */}
  <div className="mt-3">
    <h1 className="text-[24px] font-semibold text-foreground leading-tight uppercase"
      style={{ fontFamily: 'inherit' }}>
      {user?.name ?? 'Usuario'}
    </h1>
    <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase"
      style={{ background: rc.bg, color: rc.text }}>
      {roleLabels[role] ?? role}
    </span>
  </div>

  {/* Stats: Publicaciones · Seguidores · Siguiendo */}
  <div className="flex items-center gap-6 mt-4">
    <div className="text-center">
      <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{posts.length}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Publicaciones</p>
    </div>
    <div className="text-center">
      <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{followStats.followersCount}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Seguidores</p>
    </div>
    <div className="text-center">
      <p className="text-[18px] font-bold text-foreground leading-none" style={{ fontFamily: 'inherit' }}>{followStats.followingCount}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Siguiendo</p>
    </div>
  </div>

  {/* Bio */}
  {user?.bio && (
    <p className="mt-3 text-[13px] text-foreground/80 leading-relaxed max-w-lg">{user.bio}</p>
  )}

  {/* Metadata */}
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
    {user?.club?.name && (
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
        <span className="text-[12px] text-muted-foreground">{user.club.name}</span>
        {user.club.verified && (
          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#4361EE' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
    )}
    {(user?.club?.city || user?.club?.department) && (
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
        <span className="text-[12px] text-muted-foreground">
          {[user.club?.city, user.club?.department].filter(Boolean).join(', ')}
        </span>
      </div>
    )}
    {user?.createdAt && (
      <div className="flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
        <span className="text-[12px] text-muted-foreground">
          Miembro desde {formatJoinDate(user.createdAt)}
        </span>
      </div>
    )}
  </div>
</div>
```

- [ ] **Paso 6: Actualizar el contenedor del tab para usar max-w-4xl**

Cambiar la línea:
```tsx
<div className="w-full px-4 sm:px-6 py-4 max-w-2xl">
```
por:
```tsx
<div className="w-full px-4 sm:px-6 py-4 max-w-4xl mx-auto">
```

- [ ] **Paso 7: Añadir tab de Fotos al switch de contenido**

Después del bloque `{activeTab === 'Publicaciones' && ...}` y antes de `{activeTab === 'Acerca de' && ...}`:

```tsx
{activeTab === 'Fotos' && (
  <motion.div key="fotos"
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
    {postImages.length === 0 ? (
      <div className="rounded-2xl px-6 py-10 flex flex-col items-center text-center mt-4"
        style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.04),rgba(67,97,238,0.03))', border: '1px solid rgba(124,58,237,0.10)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg,#7C3AED,#4361EE)' }}>
          <ImagePlus className="w-6 h-6 text-white" />
        </div>
        <p className="text-[14px] font-bold text-foreground mb-1">Sin fotos aún</p>
        <p className="text-[12px] text-muted-foreground">Las fotos de tus publicaciones aparecerán aquí.</p>
      </div>
    ) : (
      <div className="grid grid-cols-3 gap-1 mt-2">
        {postImages.slice(0, 5).map((img, idx) => {
          const isLast = idx === 4 && postImages.length > 5;
          const remaining = postImages.length - 5;
          return (
            <div key={img.id}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
              style={{ background: '#f0f0f0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt="Foto"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {isLast && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.52)' }}>
                  <span className="text-white font-bold text-[22px]">+{remaining}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </motion.div>
)}
```

- [ ] **Paso 8: Commit**

```bash
git add web/app/dashboard/perfil/page.tsx
git commit -m "feat(perfil): redesign with larger photo, club badge, follow counters, photo gallery"
```

---

## Task 6: Frontend — `/dashboard/perfil/[id]` (perfil público)

**Archivos:**
- Crear: `web/app/dashboard/perfil/[id]/page.tsx`

- [ ] **Paso 1: Crear `web/app/dashboard/perfil/[id]/page.tsx`**

```tsx
'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { MapPin, CalendarDays, Users, ImagePlus, UserPlus, UserCheck } from 'lucide-react';

const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super Admin', ADMIN: 'Administrador',
  COACH: 'Entrenador',      STUDENT: 'Deportista',
};
const roleColors: Record<string, { text: string; bg: string }> = {
  SUPERADMIN: { text: '#EF476F', bg: 'rgba(239,71,111,0.12)' },
  ADMIN:      { text: '#FFB703', bg: 'rgba(255,183,3,0.12)' },
  COACH:      { text: '#06D6A0', bg: 'rgba(6,214,160,0.12)' },
  STUDENT:    { text: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
};
const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

interface PublicProfile {
  clerkId: string;
  name: string;
  picture?: string | null;
  coverUrl?: string | null;
  role: string;
  createdAt: string;
  club?: { id: string; name: string; city?: string; department?: string; logoUrl?: string; verified?: boolean };
  postImages: { id: string; imageUrl: string }[];
  followersCount: number;
  followingCount: number;
}

export default function PublicProfilePage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const targetClerkId = params.id;

  const [profile, setProfile]       = useState<PublicProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [following, setFollowing]   = useState(false);
  const [toggling, setToggling]     = useState(false);
  const isOwnProfile                = userId === targetClerkId;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await session?.getToken();
        const [profileRes, statsRes] = await Promise.allSettled([
          apiFetch<{ profile: PublicProfile }>(`/profiles/${targetClerkId}`, { token }),
          apiFetch<{ followersCount: number; followingCount: number; isFollowing: boolean }>(
            `/follows/stats/${targetClerkId}`, { token }
          ),
        ]);
        if (profileRes.status === 'fulfilled') {
          const p = profileRes.value.profile;
          if (statsRes.status === 'fulfilled') {
            p.followersCount = statsRes.value.followersCount;
            p.followingCount = statsRes.value.followingCount;
            setFollowing(statsRes.value.isFollowing);
          }
          setProfile(p);
        }
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, userId, targetClerkId, session]);

  async function handleFollow() {
    if (!profile || toggling) return;
    setToggling(true);
    try {
      const token = await session?.getToken();
      const res = await apiFetch<{ following: boolean }>(
        `/follows/toggle/${targetClerkId}`, { token, method: 'POST' }
      );
      setFollowing(res.following);
      setProfile(p => p ? {
        ...p,
        followersCount: p.followersCount + (res.following ? 1 : -1),
      } : p);
    } catch { /* silencioso */ }
    finally { setToggling(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-[14px] font-semibold text-muted-foreground">Perfil no encontrado</p>
        <button onClick={() => router.back()}
          className="text-[13px] text-purple-600 font-medium hover:underline cursor-pointer">
          Volver
        </button>
      </div>
    );
  }

  const role = profile.role;
  const rc   = roleColors[role] ?? roleColors.STUDENT;

  return (
    <div className="min-h-full bg-background">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner */}
        <div className="relative h-36 sm:h-48"
          style={{ background: profile.coverUrl ? undefined : 'linear-gradient(135deg, #7C3AED 0%, #4361EE 60%, #06D6A0 100%)' }}>
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />
        </div>

        {/* Info */}
        <div className="px-5 pb-5 max-w-4xl mx-auto w-full">
          <div className="flex items-end justify-between" style={{ marginTop: -60 }}>
            {/* Foto con badge del club */}
            <div className="relative z-10">
              <div className="rounded-full border-4 border-white overflow-hidden"
                style={{ boxShadow: '0 4px 16px rgba(124,58,237,0.20)', width: 120, height: 120 }}>
                <MemberAvatar
                  name={profile.name}
                  photoUrl={profile.picture}
                  gradient={ROLE_GRADIENT[role] ?? ROLE_GRADIENT.STUDENT}
                  size={120}
                />
              </div>
              {profile.club?.logoUrl && (
                <div className="absolute bottom-0.5 right-0.5 rounded-full border-2 border-white overflow-hidden"
                  style={{ width: 32, height: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.club.logoUrl} alt={profile.club.name} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Botón Follow — solo si no es el propio perfil */}
            {!isOwnProfile && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFollow}
                disabled={toggling}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-60"
                style={following
                  ? { background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1.5px solid rgba(124,58,237,0.25)' }
                  : { background: 'linear-gradient(135deg,#7C3AED,#4361EE)', color: '#fff', border: 'none' }
                }
              >
                {following
                  ? <><UserCheck className="w-4 h-4" /> Siguiendo</>
                  : <><UserPlus className="w-4 h-4" /> Seguir</>
                }
              </motion.button>
            )}
          </div>

          {/* Nombre + rol */}
          <div className="mt-3">
            <h1 className="text-[24px] font-semibold text-foreground leading-tight uppercase">
              {profile.name}
            </h1>
            <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase"
              style={{ background: rc.bg, color: rc.text }}>
              {roleLabels[role] ?? role}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.postImages.length}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Fotos</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Seguidores</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{profile.followingCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Siguiendo</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {profile.club?.name && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">{profile.club.name}</span>
                {profile.club.verified && (
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: '#4361EE' }}>
                    <svg viewBox="0 0 24 24" fill="none" className="w-2 h-2">
                      <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            )}
            {(profile.club?.city || profile.club?.department) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  {[profile.club?.city, profile.club?.department].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {profile.createdAt && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
                <span className="text-[12px] text-muted-foreground">
                  Miembro desde {formatJoinDate(profile.createdAt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Galería de fotos */}
      <div className="px-4 sm:px-6 py-4 max-w-4xl mx-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Fotos</p>
        {profile.postImages.length === 0 ? (
          <div className="rounded-2xl px-6 py-8 flex flex-col items-center text-center"
            style={{ background: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.08)' }}>
            <ImagePlus className="w-8 h-8 mb-2" style={{ color: '#8E87A8' }} />
            <p className="text-[13px] text-muted-foreground">Sin fotos publicadas</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {profile.postImages.slice(0, 5).map((img, idx) => {
              const isLast    = idx === 4 && profile.postImages.length > 5;
              const remaining = profile.postImages.length - 5;
              return (
                <div key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                  style={{ background: '#f0f0f0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt="Foto"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {isLast && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.52)' }}>
                      <span className="text-white font-bold text-[22px]">+{remaining}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Commit**

```bash
git add web/app/dashboard/perfil/
git commit -m "feat(perfil): add public profile page with follow button /perfil/[id]"
```

---

## Task 7: Frontend — `/dashboard/club` (Perfil del Club)

**Archivos:**
- Crear: `web/app/dashboard/club/page.tsx`

- [ ] **Paso 1: Crear `web/app/dashboard/club/page.tsx`**

```tsx
'use client';

import { useAuth, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api-client';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { MapPin, Camera, Pencil, Trash2, ImagePlus, BadgeCheck, Users } from 'lucide-react';
import Link from 'next/link';

const ROLE_GRADIENT: Record<string, string> = {
  SUPERADMIN: 'linear-gradient(135deg,#EF476F,#C1121F)',
  ADMIN:      'linear-gradient(135deg,#FFB703,#FB8500)',
  COACH:      'linear-gradient(135deg,#06D6A0,#0CB68D)',
  STUDENT:    'linear-gradient(135deg,#7C3AED,#A855F7)',
};

interface ClubMember {
  id: string; fullName: string; pictureUrl?: string | null;
  role: string; clerkId?: string | null;
}

interface ClubProfile {
  id: string; name: string; city?: string | null; department?: string | null;
  deporte?: string | null; logoUrl?: string | null; coverUrl?: string | null;
  verified: boolean; createdAt: string;
  _count: { members: number };
}

export default function ClubProfilePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const router = useRouter();

  const [club, setClub]               = useState<ClubProfile | null>(null);
  const [members, setMembers]         = useState<ClubMember[]>([]);
  const [followersCount, setFollowers] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [userRole, setUserRole]       = useState<string>('');
  const [coverUrl, setCoverUrl]       = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverMenuOpen, setCoverMenuOpen]   = useState(false);
  const [deletingCover, setDeletingCover]   = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    (async () => {
      try {
        const token = await session?.getToken();
        const [meRes, clubRes] = await Promise.allSettled([
          apiFetch<{ status: string; user?: { role: string } }>('/me', { token }),
          apiFetch<{ club: ClubProfile; members: ClubMember[]; followersCount: number }>(
            '/clubs/profile', { token }
          ),
        ]);
        if (meRes.status === 'fulfilled') setUserRole(meRes.value.user?.role ?? '');
        if (clubRes.status === 'fulfilled') {
          setClub(clubRes.value.club);
          setCoverUrl(clubRes.value.club.coverUrl ?? null);
          setMembers(clubRes.value.members);
          setFollowers(clubRes.value.followersCount);
        }
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, [isLoaded, isSignedIn, session, router]);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('La imagen no puede superar 5MB'); return; }
    setUploadingCover(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const token = await session?.getToken();
        const res = await apiFetch<{ coverUrl: string }>('/clubs/cover', {
          method: 'POST', token, body: JSON.stringify({ base64 }),
        });
        setCoverUrl(res.coverUrl);
      } catch (err) {
        alert('Error al subir la portada: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
      } finally { setUploadingCover(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[14px] text-muted-foreground">Club no encontrado</p>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="min-h-full bg-background">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="bg-white border-b border-border"
        style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Banner portada del club */}
        <div className="relative h-36 sm:h-48"
          style={{ background: coverUrl ? undefined : 'linear-gradient(135deg, #4361EE 0%, #7C3AED 60%, #06D6A0 100%)' }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Portada" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.22) 100%)' }} />

          {/* Botón portada — solo ADMIN */}
          {isAdmin && (
            <div className="absolute top-3 right-3">
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              {!coverUrl ? (
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => !uploadingCover && coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                  style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}>
                  {uploadingCover
                    ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Camera className="w-3.5 h-3.5" />}
                </motion.button>
              ) : (
                <div className="relative">
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => !uploadingCover && !deletingCover && setCoverMenuOpen(v => !v)}
                    disabled={uploadingCover || deletingCover}
                    className="flex items-center justify-center w-9 h-9 rounded-xl text-white cursor-pointer disabled:opacity-60"
                    style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.30)' }}>
                    {(uploadingCover || deletingCover)
                      ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <Pencil className="w-3.5 h-3.5" />}
                  </motion.button>
                  {coverMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setCoverMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl overflow-hidden"
                        style={{ background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                        <button onClick={() => { setCoverMenuOpen(false); coverInputRef.current?.click(); }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                          <ImagePlus className="w-4 h-4 text-muted-foreground" /> Cambiar foto
                        </button>
                        <button
                          onClick={async () => {
                            setCoverMenuOpen(false); setDeletingCover(true);
                            try {
                              const token = await session?.getToken();
                              await apiFetch('/clubs/cover', { method: 'DELETE', token });
                              setCoverUrl(null);
                            } catch (err) {
                              alert('Error: ' + (err instanceof Error ? err.message : 'intenta de nuevo'));
                            } finally { setDeletingCover(false); }
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-border">
                          <Trash2 className="w-4 h-4" /> Eliminar
                        </button>
                      </motion.div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info del club */}
        <div className="px-5 pb-5 max-w-4xl mx-auto w-full">
          <div className="flex items-end justify-between" style={{ marginTop: -52 }}>
            {/* Logo del club */}
            <div className="relative z-10">
              <div className="rounded-2xl border-4 border-white overflow-hidden"
                style={{ width: 100, height: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', background: club.logoUrl ? undefined : 'linear-gradient(135deg,#4361EE,#7C3AED)' }}>
                {club.logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                  : (
                    <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                      {club.name.charAt(0).toUpperCase()}
                    </div>
                  )
                }
              </div>
            </div>
          </div>

          {/* Nombre + badge verificado */}
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-[24px] font-semibold text-foreground leading-tight uppercase">
              {club.name}
            </h1>
            {club.verified && (
              <BadgeCheck className="w-6 h-6 shrink-0" style={{ color: '#4361EE' }} />
            )}
          </div>
          {club.deporte && (
            <span className="inline-block mt-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-widest uppercase"
              style={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE' }}>
              {club.deporte}
            </span>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{club._count.members}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Miembros</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-foreground leading-none">{followersCount}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#8E87A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Seguidores</p>
            </div>
          </div>

          {/* Ubicación */}
          {(club.city || club.department) && (
            <div className="flex items-center gap-1.5 mt-3">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#8E87A8' }} />
              <span className="text-[12px] text-muted-foreground">
                {[club.city, club.department].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Grid de miembros */}
      <div className="px-4 sm:px-6 py-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-3.5 h-3.5" style={{ color: '#8E87A8' }} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Miembros</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {members.map(m => (
            <Link
              key={m.id}
              href={m.clerkId ? `/dashboard/perfil/${m.clerkId}` : '#'}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
            >
              <div className="rounded-full overflow-hidden" style={{ width: 56, height: 56 }}>
                <MemberAvatar
                  name={m.fullName}
                  photoUrl={m.pictureUrl}
                  gradient={ROLE_GRADIENT[m.role] ?? ROLE_GRADIENT.STUDENT}
                  size={56}
                />
              </div>
              <p className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-2">
                {m.fullName.split(' ')[0]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 2: Commit**

```bash
git add web/app/dashboard/club/page.tsx
git commit -m "feat(club): add club profile page with cover, members grid, verified badge"
```

---

## Task 8: Frontend — Nav + Layout

**Archivos:**
- Modificar: `web/app/dashboard/layout.tsx`

- [ ] **Paso 1: Añadir ícono `Building2` a los imports de lucide en layout.tsx**

Cambiar la línea de imports de lucide para incluir `Building2`:
```typescript
import {
  Home, Users, CalendarCheck, Trophy, CalendarDays,
  BarChart2, MapPin, CreditCard, CircleDollarSign,
  Settings, UserCircle, RefreshCw, ChevronLeft, ChevronRight,
  Building2,
} from 'lucide-react';
```

- [ ] **Paso 2: Añadir "Club" a `ADMIN_NAV` y `COACH_NAV`**

En `ADMIN_NAV`, añadir después de `Reportes` y antes de `Mi Perfil`:
```typescript
{ href: '/dashboard/club', label: 'Club', icon: Building2 },
```

En `COACH_NAV`, añadir después de `Calendario` y antes de `Mi Perfil`:
```typescript
{ href: '/dashboard/club', label: 'Club', icon: Building2 },
```

- [ ] **Paso 3: Commit y push final**

```bash
git add web/app/dashboard/layout.tsx
git commit -m "feat(nav): add Club profile link to sidebar for ADMIN and COACH"
git push
```

---

## Verificación completa

- [ ] Deploy en Railway ejecuta migración sin P3009 (verificar logs de Railway)
- [ ] `/dashboard/perfil` muestra foto 120px con badge del club en esquina inferior derecha
- [ ] Contadores Seguidores / Siguiendo muestran valores correctos (0 si sin follows)
- [ ] Tab "Fotos" muestra galería 3 columnas; con >5 fotos la quinta muestra `+N`
- [ ] `/dashboard/perfil/[clerkId]` carga perfil de otro usuario con botón "Seguir"
- [ ] Botón "Seguir" cambia a "Siguiendo" y actualiza el contador en tiempo real
- [ ] `/dashboard/club` carga con logo, nombre, miembros, badge verificado (si `verified=true`)
- [ ] ADMIN puede subir/eliminar portada del club
- [ ] Nav sidebar muestra "Club" para ADMIN y COACH
- [ ] Sidebar colapsado: "Club" aparece como ícono sin label
