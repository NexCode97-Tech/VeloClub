# Memoria de Claude — VeloClub

Este archivo respalda los archivos de memoria local de Claude que se pierden al formatear el PC.
Al retomar el proyecto, decirle a Claude: **"lee el archivo memoria-claude.md y restaura tu memoria"**.

---

## Memoria: Contexto del proyecto

**Tipo:** project

VeloClub es una plataforma SaaS multi-tenant para clubes de patinaje. Monorepo en GitHub (`NexCode97-Tech/VeloClub`).

**Why:** Gestionar operación diaria de clubes: miembros, asistencia, pagos, flujo de caja, logros, calendario, reportes y notificaciones.

**How to apply:** Cualquier sugerencia técnica debe respetar el diseño multi-tenant (filtrar siempre por `clubId`) y el stack definido.

### Stack
- **Frontend:** `web/` — Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Clerk (`@clerk/nextjs`), TanStack Query — desplegado en Vercel
- **Backend:** `api/` — Express 4, TypeScript, Prisma ORM, `@clerk/backend` — desplegado en Render
- **Auth:** Clerk con Google OAuth (instalado vía Vercel Marketplace)
- **DB:** PostgreSQL en Render
- **Archivos:** Cloudinary (Plan 2 en adelante)

### Roles
- **Admin / Entrenador:** acceso completo
- **Alumno:** solo lectura de su propia información

### Plan de desarrollo
- **Plan 1 (Cimientos):** monorepo, auth Clerk, backend Express, Prisma, onboarding, dashboard placeholder — COMPLETADO
- **Plan 2:** Miembros, sedes, perfil alumno con Cloudinary — COMPLETADO
- **Plan 3:** Asistencia — PENDIENTE (schema Prisma actualizado, falta migración + rutas + UI)
- **Plan 4:** Pagos y flujo de caja — PENDIENTE
- **Plan 5:** Calendario y logros — PENDIENTE
- **Plan 6:** Dashboard real, reportes, notificaciones — PENDIENTE

### Infraestructura
- GitHub repo: `NexCode97-Tech/VeloClub`
- Vercel project: `veloclub` (team `hodmang97s-projects`)
- Vercel URL: `https://veloclub-plum.vercel.app`
- Backend URL (Render): `https://veloclub-api.onrender.com`

### Estado del schema Prisma (al formatear)
El schema ya incluye todos los modelos: `Club`, `User`, `Location`, `Member`, `MemberLocation`,
`Attendance`, `Payment`, `CashEntry`, `Competition`, `CompetitionEvent`, `EventResult`, `CalendarEvent`.
**Faltaba correr la migración** cuando se interrumpió la sesión.

---

## Memoria: Preferencias de trabajo

**Tipo:** feedback

1. **Siempre hacer commit y push al terminar cada tarea**, sin pedir confirmación al usuario.
   - Why: El usuario lo indicó explícitamente.
   - How to apply: Al terminar cualquier implementación, ejecutar `git add`, `git commit` y `git push` directamente.

2. **Actualizar `docs/sesiones/historial.md`** al finalizar cada sesión con lo que se hizo.

3. **Confirmar entendimiento antes de proceder** en tareas complejas o cambios importantes.

---

## Lo que falta implementar (próxima sesión)

1. Correr migración Prisma: `cd api && ./node_modules/.bin/prisma migrate dev --name add_all_sections`
2. Crear rutas backend: `attendance.ts`, `payments.ts`, `cash.ts`, `competitions.ts`, `calendar.ts`, `reports.ts`
3. Registrar rutas en `api/src/index.ts`
4. Implementar páginas frontend: Asistencia, Pagos, Flujo de Caja, Logros, Calendario, Reportes
5. Verificar build y hacer commit + push
