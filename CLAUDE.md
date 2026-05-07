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

## Módulos implementados (estado real del código)

### ✅ Miembros (`/dashboard/miembros`)
- CRUD completo con roles: ADMIN, COACH, STUDENT
- Importación masiva desde Excel (manejo de fechas seriales, errores Prisma)
- Filtro por rol, búsqueda por nombre/email
- Foto de perfil con crop modal (Cloudinary)
- Documentos adjuntos (doc + seguro)
- Sedes asignadas (ocultas para ADMIN)
- Normalización automática de nombres a Title Case
- fullName normalizado al crear y editar

### ✅ Asistencia (`/dashboard/asistencia`)
- Registro de asistencia por fecha y miembro
- Estados: PRESENT, ABSENT, MEDICAL_EXCUSE, LATE
- Filtro por sede y fecha
- Días sin asistencia configurables por club (`noAttendanceDays`)

### ✅ Pagos y Finanzas (`/dashboard/pagos`, `/dashboard/finanzas`, `/dashboard/flujo-caja`)
- Pagos de mensualidad por miembro (PENDING, PAID, OVERDUE, REFUNDED)
- Día de corte configurable por miembro (1–31)
- Factura PDF automática al registrar pago
- Flujo de caja: ingresos, gastos, reembolsos (`CashEntry`)
- Vista de finanzas consolidada

### ✅ Resultados — antes llamado "Logros" (`/dashboard/logros`)
- **Tipo 1 — Competencias** (`/dashboard/logros/[id]`):
  `Competition` → `CompetitionEvent` → `EventResult` (posición, categoría, observaciones)
- **Tipo 2 — Entrenamientos** (`/dashboard/logros/entrenamiento/[id]`):
  `TrainingSession` → `TrainingResult` (tiempo, distancia, vueltas, observaciones)

### ✅ Calendario (`/dashboard/calendario`)
- Eventos con tipos: TRAINING, MEETUP, COMPETITION
- Recurrencia: NONE, DAILY, WEEKLY, CUSTOM (días de la semana)
- Vinculado a sedes (`locationId`)

### ✅ Sedes (`/dashboard/sedes`)
- CRUD de sedes del club
- Vinculadas a miembros, asistencia, entrenamientos y eventos

### ✅ Ajustes (`/dashboard/ajustes`)
- Configuración del club (nombre, ciudad, logo, días sin asistencia)

### ✅ Reportes (`/dashboard/reportes`)
- Exportación de datos

### ✅ Panel SuperAdmin (`/superadmin`)
- Clubs CRUD (crear, editar nombre, activar/desactivar, eliminar)
- Miembros por club
- Suscripciones y pagos de plataforma
- Notificaciones globales

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
- `POST /superadmin/fix-member-names` (one-shot, normalizar nombres)

## Bugs pendientes (no tocar hasta confirmar)
- [ ] **BUG — Rol/sesión no se actualiza en tiempo real:** Al cambiar el rol de un miembro (ej. ADMIN → COACH) la sesión activa sigue con los permisos anteriores porque el JWT de Clerk no se invalida. ⚠️ No implementar mientras el usuario esté trabajando desde ese perfil.

## Posibles mejoras futuras
- Botón de WhatsApp para notificar morosos (wa.me, gratis, sin API)
- Dashboard con KPIs reales (ingresos del mes, asistencia, miembros activos)
- Reportes avanzados con filtros

## Convenciones
- Siempre filtrar por `clubId` (multi-tenant)
- Commit + push sin pedir confirmación al terminar cada tarea
- Confirmar plan antes de cambios grandes
- No usar `any` en TypeScript (ESLint estricto en Vercel)
- `fullName` siempre en Title Case (se normaliza en el backend)
