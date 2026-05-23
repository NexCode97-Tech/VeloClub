# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

SaaS multi-tenant para gestión de clubes de patinaje. Desarrollado por NexCode97. Monorepo con `web/` (Next.js en Vercel) y `api/` (Express en Railway), conectados a PostgreSQL en Neon.

- **Frontend:** https://veloclubtech.com
- **Backend Railway:** variable `WEB_ORIGIN` debe apuntar al dominio del frontend (CORS)
- **Repo:** NexCode97-Tech/VeloClub, rama `main`

---

## Comandos

### API (`cd api`)
```bash
npm run dev        # tsx watch — hot reload
npm run build      # prisma generate + tsc
npx prisma migrate dev --name <nombre>   # nueva migración
npx prisma studio  # UI de base de datos
```

### Web (`cd web`)
```bash
npm run dev        # Next.js dev server en :3000
npm run build      # build de producción
npm run lint       # ESLint (sin `any`, sin errores de tipos — Vercel rechaza builds con errores TS)
```

### Variables de entorno requeridas
**`api/.env`:** `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `WEB_ORIGIN`

**`web/.env.local`:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`

---

## Arquitectura

### Multi-tenancy
Toda entidad del dominio (Member, Payment, Attendance, Location, etc.) tiene `clubId` obligatorio. **Siempre filtrar por `clubId` en queries del backend** — nunca devolver datos cruzados entre clubs.

### Autenticación y roles
- Clerk gestiona identidades. El backend verifica el JWT con `verifyToken` de `@clerk/backend`.
- `requireAuth` en `api/src/auth/middleware.ts` extrae `clerkId` del token, consulta el user en Clerk y en Prisma, y popula `req.auth` y `req.user` en cada request.
- Roles en `User`: `SUPERADMIN` | `ADMIN` | `COACH` | `STUDENT`.
- Miembros (`Member`) tienen su propio `role` y pueden tener `clerkId` si fueron invitados a la app.
- `/me` es el endpoint de bootstrap: cada carga del dashboard lo llama para obtener rol y estado. Maneja migración de `clerkId` entre instancias de Clerk (busca por email si no encuentra por clerkId).

### Frontend — flujo de datos
- `apiFetch` en `web/lib/api-client.ts` es el único punto de acceso a la API. Siempre requiere `token` de Clerk (`session.getToken()`).
- `layout.tsx` del dashboard llama `/me` con retry automático para 429, determina el rol y redirige según permisos. No hace `setRole(null)` antes de confirmar la respuesta — evita flash.
- Módulos usan `visibilitychange` para refrescar datos al volver al tab.

### Estructura de rutas API
```
GET/POST   /members
GET        /members/:id
PATCH      /members/:id
DELETE     /members/:id
POST       /members/import          # importación masiva desde Excel

GET/POST   /payments
PATCH      /payments/:id
DELETE     /payments/:id

GET/POST   /attendance
GET        /attendance/monthly-stats  # últimos 6 meses en una sola query

GET/POST   /competitions
GET/POST   /competitions/:id/events
POST       /competitions/:id/events/:eventId/results

GET/POST   /training
GET/POST   /training/:id/results

GET/POST   /cashflow
GET/POST   /events                   # CalendarEvent
GET/POST   /locations

GET        /me                       # bootstrap de sesión
GET/PATCH  /clubs/:id               # configuración del club

/superadmin/*                        # solo SUPERADMIN — clubs, suscripciones, notificaciones
```

### Modelo de datos clave
- `User` = staff del club (ADMIN, COACH). Tiene `clerkId` único.
- `Member` = deportista. Puede o no tener `clerkId` (si fue invitado). Tiene su propio `role = STUDENT`.
- `Payment` = mensualidad con `month` + `year` + `memberId`. Genera `CashEntry` automáticamente al pagarse.
- `Attendance` tiene constraint `@@unique([memberId, date])` — un registro por miembro por día.
- `CalendarEvent` soporta recurrencia: `NONE | DAILY | WEEKLY | CUSTOM` (con `weekDays: Int[]`).
- `Competition → CompetitionEvent → EventResult` (resultados de competencias).
- `TrainingSession → TrainingResult` (resultados de entrenamientos).

### Design system
- Background: `#F7F7FB` | Cards: `#fff` | Border: `rgba(120,80,200,0.10)`
- Accent ADMIN: `#4361EE` | Accent COACH: `#06D6A0` | Accent STUDENT: `#7C3AED`
- Muted: `#8E87A8` | Text: `#1A1028`
- Fuentes: **Space Grotesk** (headings, `font-bold`) — **Plus Jakarta Sans** (body)
- Mobile-first PWA con bottom tab bar por rol. Desktop con sidebar fijo de 240px.
- Íconos: solo Lucide React.

### Navegación por rol (móvil / desktop)
- `ROLE_TABS` en `layout.tsx` define las tabs del bottom bar móvil por rol.
- `ROLE_NAV` define el sidebar de escritorio.
- ADMIN y COACH tienen acceso a: Dashboard, Miembros, Asistencia, Resultados, Calendario, Sedes. ADMIN además tiene Finanzas y Reportes.
- STUDENT solo ve: Inicio, Resultados, Calendario, Mis Pagos.
- La ruta `/dashboard/mas` es el "overflow" móvil para ADMIN/COACH — agrupa módulos que no caben en el tab bar.

---

## Convenciones

- **TypeScript estricto** — sin `any`. El build de Vercel falla con errores de tipos.
- `fullName` siempre en Title Case; se normaliza en el backend al crear/editar miembros.
- Rate limit: 1000 req/15min global, 100 req/15min para endpoints sensibles (`strictLimiter`).
- Al eliminar un miembro con `clerkId`, revocar sus sesiones en Clerk y banear la cuenta.
- Al cambiar el rol de un usuario, revocar sesiones activas para forzar nuevo JWT.
- Commit + push al terminar cada tarea sin pedir confirmación.
- Confirmar plan antes de cambios que toquen más de 2–3 archivos.
