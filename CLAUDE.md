# VeloClub — Contexto del Proyecto

Plataforma SaaS multi-tenant para gestión de clubs de patinaje.
Desarrollada por NexCode97. Modelo: suscripción mensual por club.

## Stack
- **Frontend:** `web/` — Next.js 15 App Router, TypeScript, Tailwind, Clerk (`@clerk/nextjs`) — Vercel
- **Backend:** `api/` — Express 4, TypeScript, Prisma ORM — Railway
- **DB:** PostgreSQL en Neon
- **Auth:** Clerk con Google OAuth + allowlist de emails
- **Archivos:** Cloudinary
- **PWA:** `@ducanh2912/next-pwa` instalado y activo en prod

## URLs
- Frontend: https://veloclub-plum.vercel.app
- Repo: NexCode97-Tech/VeloClub (rama `main`)

## Roles
- **SuperAdmin (NexCode97):** panel propio en `/superadmin` — gestiona clubs, suscripciones, notificaciones
- **Admin del club:** gestión completa del club
- **Coach/Entrenador:** gestión de miembros y asistencia
- **Student/Deportista:** solo lectura de su propia información

## Design System
- Background: `#F7F7FB`
- Cards: `#fff`, border: `rgba(120,80,200,0.10)`
- Accent: `#7C3AED`, muted: `#8E87A8`, text: `#1A1028`
- Fuentes: Space Grotesk (headings), Plus Jakarta Sans (body)
- Mobile-first PWA con bottom tab bar

## Completado
- Plan 1 (Cimientos): auth, onboarding, estructura multi-tenant
- Plan 2: miembros, sedes, perfil con foto (Cloudinary), crop modal
- Importación masiva de miembros desde Excel
- Filtro de resultados por rol
- Factura PDF automática al registrar pagos (descarga automática)
- Dashboard con logo + nombre del club
- Día de corte configurable 1–31
- Orden de botones en Miembros: Descargar → Importar → Plantilla
- Panel SuperAdmin completo: clubs CRUD, miembros por club, suscripciones, pagos, notificaciones reales

## SuperAdmin — rutas API
- `GET/POST /superadmin/clubs`
- `PATCH /superadmin/clubs/:id` (editar nombre)
- `PATCH /superadmin/clubs/:id/toggle` (activar/desactivar)
- `DELETE /superadmin/clubs/:id`
- `GET/POST/PATCH/DELETE /superadmin/clubs/:id/miembros`
- `GET/POST /superadmin/suscripciones`
- `POST /superadmin/suscripciones/:clubId/pagos`
- `PATCH/DELETE /superadmin/suscripciones/pagos/:pagoId`
- `GET/PATCH /superadmin/notificaciones`

## Pendiente
- Plan 3: Asistencia (schema listo, falta migración + rutas + UI)
- Plan 4: Pagos y flujo de caja
- Plan 5: Calendario y logros
- Plan 6: Dashboard real, reportes avanzados

## Convenciones
- Siempre filtrar por `clubId` (multi-tenant)
- Commit + push sin pedir confirmación al terminar cada tarea
- Actualizar `docs/sesiones/historial.md` al finalizar sesión
- Confirmar plan antes de cambios grandes
- No usar `any` en TypeScript (ESLint estricto en Vercel)
