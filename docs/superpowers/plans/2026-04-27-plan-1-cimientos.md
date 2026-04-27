# Plan 1 — Cimientos de VeloClub (con Clerk)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base técnica de VeloClub: un frontend en Next.js (desplegado en Vercel) y un backend en Express (desplegado en Render) conectados a PostgreSQL, con login con Google manejado por Clerk y registro de un club nuevo.

**Architecture:** Monorepo con dos carpetas: `web/` (Next.js 15 + TypeScript + Tailwind + shadcn/ui + Clerk) y `api/` (Express + TypeScript + Prisma + PostgreSQL). Autenticación con Clerk (Vercel Marketplace) que provee Google login automáticamente y componentes UI listos. El backend verifica los tokens de Clerk usando `@clerk/backend` para autorizar peticiones. Multi-tenant: cada usuario pertenece a un club (`clubId`) y todas las consultas se filtran por ese club.

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, **Clerk (`@clerk/nextjs`)**, TanStack Query
- **Backend:** Node.js 20+, Express 4, TypeScript, Prisma ORM, **`@clerk/backend`**
- **Auth:** Clerk (instalado vía Vercel Marketplace, con Google como proveedor)
- **Base de datos:** PostgreSQL (Render Free Tier)
- **Hosting:** Vercel (web), Render (api), Cloudinary (archivos — Plan 2)

---

## Estructura de Archivos

```
VeloClub/
├── web/                          # Frontend Next.js
│   ├── app/
│   │   ├── layout.tsx            # Envuelve con ClerkProvider
│   │   ├── page.tsx              # Landing
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   ├── onboarding/page.tsx   # Crear club nuevo
│   │   └── dashboard/page.tsx
│   ├── lib/
│   │   └── api-client.ts         # Cliente para llamar al backend
│   ├── components/ui/            # shadcn/ui
│   ├── middleware.ts             # clerkMiddleware
│   ├── .env.local
│   ├── package.json
│   └── tsconfig.json
├── api/                          # Backend Express
│   ├── src/
│   │   ├── index.ts
│   │   ├── auth/
│   │   │   └── middleware.ts     # Verifica token de Clerk
│   │   ├── routes/
│   │   │   ├── clubs.ts
│   │   │   └── me.ts
│   │   └── db/client.ts          # Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── docs/superpowers/
├── .gitignore
└── README.md
```

---

## Task 1: Inicializar el repositorio y la estructura del monorepo

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Inicializar git en la raíz**

```bash
git init
git branch -M main
git remote add origin https://github.com/HodmanG97/VeloClub.git
```

- [ ] **Step 2: Crear `.gitignore`**

```gitignore
node_modules/
.next/
dist/
build/
out/
.env
.env.local
.env*.local
.vscode/
.idea/
.DS_Store
Thumbs.db
npm-debug.log*
api/prisma/dev.db
```

- [ ] **Step 3: Crear `README.md`**

```markdown
# VeloClub

Plataforma SaaS multi-tenant para clubes de patinaje.

## Estructura
- `web/` — Frontend Next.js + Clerk (Vercel)
- `api/` — Backend Express + Prisma (Render)
- `docs/` — Specs y planes
```

- [ ] **Step 4: Commit inicial**

```bash
git add .
git commit -m "chore: initialize monorepo structure"
git push -u origin main
```

---

## Task 2: Inicializar el frontend Next.js

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Cuando pregunte por Turbopack, responder **Yes**.

- [ ] **Step 2: Verificar que arranca**

```bash
cd web
npm run dev
```

Abrir http://localhost:3000. Detener con Ctrl+C.

- [ ] **Step 3: Instalar dependencias adicionales**

```bash
cd web
npm install @clerk/nextjs
npm install @tanstack/react-query
npm install zod
```

- [ ] **Step 4: Inicializar shadcn/ui**

```bash
cd web
npx shadcn@latest init
```

Responder: Style **Default**, Base color **Slate**, CSS variables **Yes**.

- [ ] **Step 5: Instalar componentes shadcn**

```bash
cd web
npx shadcn@latest add button input label card form
```

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Next.js with Tailwind, shadcn/ui and Clerk"
git push
```

---

## Task 3: Inicializar el backend Express

- [ ] **Step 1: Crear estructura del backend**

```bash
mkdir api
cd api
npm init -y
```

- [ ] **Step 2: Instalar dependencias**

```bash
cd api
npm install express cors helmet dotenv @clerk/backend
npm install -D typescript @types/node @types/express @types/cors tsx
```

- [ ] **Step 3: Crear `api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Configurar scripts en `api/package.json`**

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

- [ ] **Step 5: Crear `api/src/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
```

- [ ] **Step 6: Crear `api/.env`**

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB
CLERK_SECRET_KEY=sk_test_xxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxx
```

⚠️ Reemplazar `DATABASE_URL` con el **External Database URL** de Render. Las claves de Clerk se obtienen en el Task 5.

- [ ] **Step 7: Probar que arranca**

```bash
cd api
npm run dev
```

Abrir http://localhost:4000/health — debe responder OK.

- [ ] **Step 8: Commit**

```bash
git add api/
git commit -m "feat(api): scaffold Express backend"
git push
```

---

## Task 4: Instalar Prisma y conectar a la base de datos

- [ ] **Step 1: Instalar Prisma**

```bash
cd api
npm install prisma @prisma/client
npx prisma init
```

- [ ] **Step 2: Definir el schema en `api/prisma/schema.prisma`**

Reemplazar contenido completo:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Club {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
}

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  name      String
  picture   String?
  role      Role     @default(ADMIN)
  clubId    String
  club      Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([clubId])
}

enum Role {
  ADMIN
  COACH
  STUDENT
}
```

- [ ] **Step 3: Crear la primera migración**

```bash
cd api
npx prisma migrate dev --name init
```

- [ ] **Step 4: Crear `api/src/db/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Commit**

```bash
git add api/
git commit -m "feat(api): add Prisma with Club and User models"
git push
```

---

## Task 5: Instalar Clerk desde el Vercel Marketplace

- [ ] **Step 1: Crear el proyecto en Vercel primero (si no está creado)**

Asegúrate de tener el proyecto `veloclub` creado en https://vercel.com (ya lo creamos antes).

- [ ] **Step 2: Instalar la integración de Clerk desde Vercel Marketplace**

1. Abrir https://vercel.com/marketplace/clerk
2. Clic en **Add Integration** o **Install**
3. Seleccionar el equipo `veloclubtech-3830's projects`
4. Seleccionar el proyecto `veloclub`
5. Aceptar — Vercel crea automáticamente las variables de entorno `CLERK_SECRET_KEY` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` en tu proyecto Vercel.

- [ ] **Step 3: Acceder al dashboard de Clerk**

Después de instalar, Vercel te da acceso al dashboard de Clerk desde la pestaña **Storage / Integrations** del proyecto. Entra ahí.

- [ ] **Step 4: Habilitar Google como proveedor de login**

En el dashboard de Clerk:
1. Menú lateral → **User & Authentication** → **Social Connections**
2. Activar **Google** (clic en el toggle)
3. Clerk usa sus credenciales por defecto para desarrollo. Para producción luego se configuran credenciales propias de Google Cloud (lo dejamos para más adelante).

- [ ] **Step 5: Copiar las claves de Clerk a tu archivo local**

En el dashboard de Clerk → **API Keys**, copiar:
- **Publishable Key** (empieza con `pk_test_...`)
- **Secret Key** (empieza con `sk_test_...`)

Crear `web/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Y agregar las mismas claves al `api/.env` (la `CLERK_SECRET_KEY` ya estaba en el placeholder, ahora ponle el valor real).

⚠️ **Nunca subir `.env` ni `.env.local` a git** (ya están en `.gitignore`).

---

## Task 6: Configurar Clerk en el frontend

**Files:**
- Create: `web/middleware.ts`
- Modify: `web/app/layout.tsx`
- Create: `web/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `web/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Crear `web/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 2: Modificar `web/app/layout.tsx`**

Reemplazar el contenido completo:

```tsx
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'VeloClub',
  description: 'Plataforma para clubes de patinaje',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Crear `web/app/providers.tsx`**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 4: Crear `web/app/sign-in/[[...sign-in]]/page.tsx`**

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 5: Crear `web/app/sign-up/[[...sign-up]]/page.tsx`**

```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <SignUp />
    </div>
  );
}
```

- [ ] **Step 6: Reemplazar `web/app/page.tsx` (landing)**

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50">
      <h1 className="text-5xl font-bold">VeloClub</h1>
      <p className="text-lg text-slate-600">La plataforma de tu club de patinaje</p>
      <SignedOut>
        <div className="flex gap-3">
          <Link href="/sign-in"><Button size="lg">Iniciar sesión</Button></Link>
          <Link href="/sign-up"><Button size="lg" variant="outline">Crear cuenta</Button></Link>
        </div>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard"><Button size="lg">Ir al dashboard</Button></Link>
      </SignedIn>
    </main>
  );
}
```

- [ ] **Step 7: Probar el flujo de login**

```bash
cd web
npm run dev
```

1. Abrir http://localhost:3000
2. Clic en "Crear cuenta"
3. Clic en "Continue with Google"
4. Autenticarte
5. Te debe redirigir a `/dashboard` (todavía da 404, eso es esperado)

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat(web): integrate Clerk with sign-in/sign-up pages and middleware"
git push
```

---

## Task 7: Middleware de autenticación con Clerk en el backend

**Files:**
- Create: `api/src/auth/middleware.ts`

- [ ] **Step 1: Crear `api/src/auth/middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { prisma } from '../db/client';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
});

declare global {
  namespace Express {
    interface Request {
      auth?: {
        clerkId: string;
        email: string;
        name: string;
        picture?: string;
      };
      user?: { id: string; clubId: string; role: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const token = header.substring(7);
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const clerkId = payload.sub as string;

    const clerkUser = await clerk.users.getUser(clerkId);
    req.auth = {
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'Usuario',
      picture: clerkUser.imageUrl,
    };

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (user) {
      req.user = { id: user.id, clubId: user.clubId, role: user.role };
    }
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Token inválido' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/
git commit -m "feat(api): add Clerk auth middleware"
git push
```

---

## Task 8: Endpoints `/me` y `/clubs` en el backend

**Files:**
- Create: `api/src/routes/me.ts`
- Create: `api/src/routes/clubs.ts`
- Modify: `api/src/index.ts`

- [ ] **Step 1: Instalar zod en el backend**

```bash
cd api
npm install zod
```

- [ ] **Step 2: Crear `api/src/routes/me.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const user = await prisma.user.findUnique({
    where: { clerkId: req.auth.clerkId },
    include: { club: true },
  });

  if (!user) {
    return res.json({ user: null, needsOnboarding: true });
  }

  res.json({ user, needsOnboarding: false });
});

export default router;
```

- [ ] **Step 3: Crear `api/src/routes/clubs.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';

const router = Router();

const createClubSchema = z.object({
  clubName: z.string().min(2).max(100),
});

router.post('/', requireAuth, async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'No autenticado' });

  const existing = await prisma.user.findUnique({
    where: { clerkId: req.auth.clerkId },
  });
  if (existing) {
    return res.status(400).json({ error: 'El usuario ya pertenece a un club' });
  }

  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos inválidos', issues: parsed.error.issues });
  }

  const club = await prisma.club.create({
    data: {
      name: parsed.data.clubName,
      users: {
        create: {
          clerkId: req.auth.clerkId,
          email: req.auth.email,
          name: req.auth.name,
          picture: req.auth.picture,
          role: 'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  res.status(201).json({ club });
});

export default router;
```

- [ ] **Step 4: Modificar `api/src/index.ts`**

Reemplazar contenido completo:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import meRouter from './routes/me';
import clubsRouter from './routes/clubs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'veloclub-api' });
});

app.use('/me', meRouter);
app.use('/clubs', clubsRouter);

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
```

- [ ] **Step 5: Probar**

```bash
cd api
npm run dev
```

Debe arrancar sin errores.

- [ ] **Step 6: Commit**

```bash
git add api/
git commit -m "feat(api): add /me and /clubs endpoints"
git push
```

---

## Task 9: Cliente API y página de onboarding

**Files:**
- Create: `web/lib/api-client.ts`
- Create: `web/app/onboarding/page.tsx`

- [ ] **Step 1: Crear `web/lib/api-client.ts`**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Crear `web/app/onboarding/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';

export default function OnboardingPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return <p className="p-8">Cargando...</p>;
  if (!isSignedIn) {
    router.push('/sign-in');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/clubs', {
        method: 'POST',
        token,
        body: JSON.stringify({ clubName }),
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crea tu club</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="clubName">Nombre del club</Label>
              <Input
                id="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                minLength={2}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Crear club'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/
git commit -m "feat(web): add onboarding page to create a club"
git push
```

---

## Task 10: Página de Dashboard placeholder

**Files:**
- Create: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Crear `web/app/dashboard/page.tsx`**

```tsx
'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

interface MeResponse {
  user: { name: string; club: { name: string } } | null;
  needsOnboarding: boolean;
}

export default function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MeResponse['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    (async () => {
      try {
        const token = await getToken();
        const me = await apiFetch<MeResponse>('/me', { token });
        if (me.needsOnboarding) {
          router.push('/onboarding');
        } else {
          setData(me.user);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    })();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (loading) return <p className="p-8">Cargando...</p>;

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-600">
            Bienvenido, {data?.name} — Club: {data?.club.name}
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
      <div className="bg-white rounded-lg p-6 shadow">
        <p>Aquí va el contenido del dashboard (próximos planes).</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Probar el flujo completo en local**

1. Iniciar el backend: `cd api && npm run dev`
2. En otra terminal: `cd web && npm run dev`
3. Abrir http://localhost:3000
4. "Crear cuenta" → "Continue with Google" → autenticarte
5. Te lleva a `/dashboard`, detecta que no tienes club y redirige a `/onboarding`
6. Crear club
7. Te lleva al dashboard con tu nombre y el del club

- [ ] **Step 3: Commit**

```bash
git add web/
git commit -m "feat(web): add dashboard with onboarding redirect"
git push
```

---

## Task 11: Desplegar el backend en Render

- [ ] **Step 1: En Render, crear un Web Service**

1. https://dashboard.render.com → **+ New** → **Web Service**
2. Conectar `HodmanG97/VeloClub`
3. Configurar:
   - **Name:** `veloclub-api`
   - **Region:** la misma que la base de datos
   - **Branch:** `main`
   - **Root Directory:** `api`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm start`
   - **Plan:** Free

- [ ] **Step 2: Variables de entorno en Render**

```
DATABASE_URL=<Internal Database URL de Render>
CLERK_SECRET_KEY=<sk_test_... de Clerk>
CLERK_PUBLISHABLE_KEY=<pk_test_... de Clerk>
WEB_ORIGIN=https://veloclub.vercel.app
PORT=10000
NODE_ENV=production
```

- [ ] **Step 3: Crear el servicio**

Esperar al primer build (5-10 min). Probar `https://veloclub-api.onrender.com/health` — debe responder OK.

- [ ] **Step 4: Anotar la URL del backend**

---

## Task 12: Desplegar el frontend en Vercel

- [ ] **Step 1: Configurar Root Directory en Vercel**

1. Proyecto `veloclub` en https://vercel.com
2. **Settings** → **General** → **Root Directory** → cambiar a `web`
3. **Framework Preset** → **Next.js**

- [ ] **Step 2: Variables de entorno en Vercel**

Las claves de Clerk (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) ya están porque vinieron del Marketplace. Agregar:

```
NEXT_PUBLIC_API_URL=<URL de Render del Task 11>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

- [ ] **Step 3: Desplegar**

Settings → Deployments → **Redeploy**.

- [ ] **Step 4: Probar el flujo en producción**

1. Abrir la URL de Vercel
2. Crear cuenta con Google
3. Crear club
4. Llegar al dashboard

---

## Task 13: Documentar el setup

- [ ] **Step 1: Actualizar `README.md`**

```markdown
# VeloClub

Plataforma SaaS multi-tenant para clubes de patinaje.

## Estructura
- `web/` — Frontend Next.js + Clerk (Vercel)
- `api/` — Backend Express + Prisma (Render)

## Correr en local

### Backend
\`\`\`bash
cd api
npm install
cp .env.example .env  # rellenar valores
npx prisma migrate dev
npm run dev
\`\`\`

### Frontend
\`\`\`bash
cd web
npm install
cp .env.local.example .env.local  # rellenar valores
npm run dev
\`\`\`

Abrir http://localhost:3000

## Despliegue
- Frontend: Vercel (root: `web/`) — Clerk instalado vía Marketplace
- Backend: Render (root: `api/`)
- Base de datos: PostgreSQL en Render
- Auth: Clerk (Google login)
- Archivos: Cloudinary (Plan 2)
```

- [ ] **Step 2: Crear archivos `.env.example`**

`api/.env.example`:
```env
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@host/db
CLERK_SECRET_KEY=sk_test_
CLERK_PUBLISHABLE_KEY=pk_test_
```

`web/.env.local.example`:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_
CLERK_SECRET_KEY=sk_test_
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- [ ] **Step 3: Commit final**

```bash
git add .
git commit -m "docs: add README and env examples"
git push
```

---

## Resultado del Plan 1

Al terminar este plan tienes:

- Repo `VeloClub` con monorepo `web/` + `api/`
- Frontend desplegado en Vercel
- Backend desplegado en Render
- Base de datos PostgreSQL en Render con tablas `Club` y `User`
- **Login con Google manejado por Clerk** (componentes UI listos, sin código de OAuth manual)
- Un usuario nuevo puede registrarse, crear su club y entrar al dashboard placeholder
- Aislamiento multi-tenant base (cada usuario asociado a un `clubId`)

**Lo que NO está incluido (planes siguientes):**
- Plan 2: Miembros, sedes, perfil de alumno con Cloudinary
- Plan 3: Asistencia
- Plan 4: Pagos y flujo de caja
- Plan 5: Calendario y logros
- Plan 6: Dashboard real, reportes, notificaciones
