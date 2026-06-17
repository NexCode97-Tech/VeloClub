# Historial de Sesiones — VeloClub

Registro cronológico de lo trabajado en cada sesión con Claude Code.
Actualizar al final de cada sesión o cuando se complete un bloque de trabajo importante.

---

## Sesión 2026-06-16

**Modelo:** Claude Opus 4.8
**Estado inicial:** Working tree limpio, rama `main`, app en producción

### Completado esta sesión

- [x] **Menú "Más" (móvil):** agregado módulo "Club" al menú radial del rol ADMIN
  (antes solo COACH/STUDENT). Arco del `BottomCircleMenu` ahora es adaptativo:
  con 5+ ítems abre a 120° y radio 150 para que los íconos no se solapen.
- [x] **Fix tests backend:** vitest corría también los tests compilados en `dist/`
  tras un build y fallaban. `tsconfig` excluye `src/tests` del build de producción
  y vitest solo corre `src/**/*.test.ts`. 11/11 tests pasan.
- [x] **Trial en tiempo real (superadmin):** nuevo hook `web/lib/use-now.ts`
  (re-render cada 30s). El badge "Prueba · Nd" y el texto de días restantes en
  `/superadmin/clubs` se descuentan solos sin recargar.
- [x] **Registro Civil (RC):** agregado como tipo de documento en el formulario de
  miembros y en la plantilla de Excel (`web/lib/excel.ts`, dropdown + notas).
- [x] **Fix tarifa mensual:** al cambiar la tarifa de un miembro, los pagos
  PENDING/OVERDUE ya generados conservaban el monto viejo. Backend
  (`PUT /members/:id`) ahora hace `updateMany` de los pagos no pagados al nuevo
  monto (los PAID no se tocan) y el front invalida las queries de pagos.
- [x] **Dropdown de deporte (superadmin crear/editar club):** `SportSelect` se
  recortaba dentro del modal en móvil. Reescrito con portal a `document.body`
  + `position: fixed` + clamp al viewport (abre hacia arriba si no cabe).
- [x] **Campo teléfono del admin con indicativo de país:** reutilizado el
  componente `PhoneInput` en crear y editar club (opcional). Backend guarda
  `phone` en el Member admin; `/clubs/:id/miembros` devuelve `phone` para pre-llenar.
- [x] **Fix selector de país (`PhoneInput`):** mismo patrón de recorte que
  `SportSelect`. Aplicado el fix de portal al componente compartido → beneficia
  los 4 formularios que lo usan (ajustes, club, miembros, superadmin).
- [x] **Descripción + Open Graph profesional:** la meta description decía
  "Plataforma para clubes de patinaje" (limitaba a un deporte). Cambiada a
  "Plataforma integral para la gestión de clubes deportivos" en `layout.tsx` y
  `manifest.ts`. Agregado bloque `openGraph` + `twitter` con `metadataBase` y una
  imagen de marca dedicada `public/og-image.png` (1200×630, logo VC + tagline +
  dominio) → el preview del enlace se ve grande y profesional al compartir.
- [x] **Fix teléfono recortado en Ajustes → Mi perfil (móvil):** nombre y teléfono
  estaban en `grid grid-cols-2`; en móvil el selector de país apretaba el número.
  Cambiado a `grid-cols-1 sm:grid-cols-2` (apila en móvil, lado a lado en desktop).
- [x] **Fix "Guardar cambios" del teléfono no hacía nada (Ajustes):** bug de 3 capas:
  1. Front: `handleSaveProfile` salía en silencio en `if (!memberMe?.id) return`.
  2. Back: el lookup del miembro propio era estricto por `clerkId`, pero los miembros
     creados por el superadmin arrancan **sin clerkId** (vinculados por email) → 404.
  3. Deploy: Railway se quedó en un commit anterior y no tomó el fix.
  Solución: nuevo `PATCH /members/me/contact` self-resolving; `GET /members/me` y
  ese endpoint ahora buscan por `OR: [{ clerkId }, { email }]` dentro del club (igual
  que `me.ts`); el PATCH **auto-vincula el clerkId** si estaba null; front muestra
  error si falla. Re-deploy de Railway forzado con commit vacío.

### Notas técnicas
- Patrón estándar para dropdowns dentro de modales con `overflow`: portal +
  `fixed` + clamp al viewport + reposición en scroll/resize (respeta
  `visualViewport` para teclado móvil). Aplicado en `SportSelect` y `PhoneInput`.
- **Resolver "el miembro propio" SIEMPRE por `OR: [{ clerkId }, { email }]`**, nunca
  solo por `clerkId`: los miembros creados por el superadmin no tienen clerkId hasta
  su primer login y pueden quedar vinculados solo por email.
- **Deploy backend:** el API corre en **Railway** (no Vercel). El CI de GitHub Actions
  (`security.yml`) solo audita/lintea, NO despliega. Si Railway se queda en un commit
  viejo, forzar con `git commit --allow-empty` + push.
- **CI en rojo (pendiente):** `npm audit --audit-level=high` falla por 3 vulns high
  (esbuild/tsx, form-data). No bloquea el deploy de Railway, pero conviene `npm audit fix`.
- Typecheck y build de front y back verificados en cada paso.

---

## Sesión 2026-04-29

**Modelo:** Claude Sonnet 4.6
**Estado inicial:** Working tree limpio, rama `main`

### Contexto recuperado
- La sesión anterior se bloqueó (Claude se cortó mid-task)
- La tarea pendiente era: **convertir la app a PWA**
- El trabajo de PWA **no se llegó a iniciar** — no hay manifest, service worker, ni config PWA

### Estado del proyecto al inicio de sesión
- Plan 1 (Cimientos) mayoritariamente completo según commits recientes
- Páginas del dashboard existentes: `asistencia`, `calendario`, `flujo-caja`, `logros`, `miembros`, `pagos`, `reportes`, `sedes`
- Páginas adicionales: `completar-perfil`, `inactivo`, `no-access`, `superadmin`
- Auth con Clerk funcionando
- Backend en Render con rutas `/me` y `/clubs`
- No existen archivos `.env` locales (variables manejadas en Vercel/Render)

### Pendiente esta sesión
- [ ] Convertir la app a PWA (manifest + service worker + config Next.js)

### Completado esta sesión
- [x] Recuperación de contexto del proyecto
- [x] Creación de este archivo de historial
- [x] Memoria del proyecto guardada en `.claude/projects/.../memory/`
- [x] Conversión a PWA:
  - Instalado `@ducanh2912/next-pwa`
  - Creado `web/app/manifest.ts` (nombre, íconos, colores, start_url `/dashboard`)
  - Actualizado `web/next.config.ts` con config PWA (desactivado en dev, activo en prod)
  - Actualizado `web/.gitignore` para ignorar archivos generados (`sw.js`, `workbox-*.js`)
  - Build verificado exitosamente — `/manifest.webmanifest` aparece en rutas

---

## Plantilla para próximas sesiones

```
## Sesión YYYY-MM-DD

**Modelo:** Claude Sonnet 4.6 / Opus / etc.
**Estado inicial:** (clean / cambios pendientes / rama X)

### Contexto recuperado
- 

### Pendiente esta sesión
- [ ] 

### Completado esta sesión
- [x] 

### Problemas encontrados
- 

### Próximos pasos
- 

---

## Sesión 2026-06-01

**Modelo:** Claude Opus 4.6
**Commit final:** `5447bdd`

### Completado esta sesión

#### UI — Bottom bar + BottomCircleMenu
- Integración visual bump/bar: bump como hijo del bar con `overflow: visible` + `filter: drop-shadow` unificado → silueta de una sola pieza
- Burbujas del menú Más: color sólido, íconos blancos, etiquetas con `textShadow`
- Animación entrada/salida simétricas (mismo spring: stiffness 300, damping 24)
- Componente convertido a controlado (isOpen/onToggle/onClose) — estado en layout
- Overlay oscuro con blur cuando el menú está abierto

#### Modal de miembros — Rediseño completo
- Reemplazado Dialog por bottom sheet multi-paso con animación iOS (cubic-bezier 0.32,0.72,0,1 / 460ms)
- Pasos dinámicos por rol: STUDENT (5 pasos), COACH (3), ADMIN (2)
- Paso "Acudiente": guardianName/guardianPhone → emergencyContact/emergencyPhone
- Campo monthlyFee con formato COP y día de pago en la misma fila
- Avatar en tiempo real con iniciales mientras se escribe el nombre
- Step indicator animado (pill activo con flex:2)

#### API — Cron endpoints proactivos
- `POST /cron/generate-payments`: genera pagos PENDING del mes actual para todos los miembros con `monthlyFee` + `paymentDueDay` configurados (idempotente, no duplica si ya existe)
- `POST /cron/mark-overdue`: marca PENDING → OVERDUE cuando `dueDate` pasó
- Protección por header `X-Cron-Secret` (env var `CRON_SECRET`)
- Notificación SSE por cada club afectado

#### Finanzas — Tab "Estado"
- Nuevo tab "Estado de deportistas" entre Mensualidades y Flujo de Caja
- Vista de todos los STUDENTs con su estado de pago del mes seleccionado
- Estado: PAID / PENDING / OVERDUE / Sin pago este mes / Sin configurar
- Ordenamiento: OVERDUE → PENDING → sin pago → PAID → sin configurar
- Botón "Generar": crea pago PENDING con la tarifa configurada del miembro
- Botón "Marcar pagado" directo sin abrir modal
- WhatsApp al emergencyPhone (o phone) — solo aparece cuando hay pago pendiente/vencido
- Mini resumen numérico: Pagados / Pendientes / Sin pago

#### Base de datos
- `monthlyFee Float?` agregado a schema.prisma (ya estaba desde sesión anterior)
- Migración formal creada: `20260601000000_add_monthly_fee`
- Build script actualizado: `prisma migrate deploy && prisma generate && tsc` — la migración se aplica automáticamente en cada deploy de Railway

#### PWA
- Fix: removidos `cacheOnFrontEndNav` y `aggressiveFrontEndNavCaching` de `next.config.ts` — eliminaba crash `_async_to_generator is not defined` en el service worker

### Problemas encontrados
- Credenciales locales de Neon (`.env`) desactualizadas — `prisma db push` local fallaba con P1000. Solución: migración formal vía SQL + `prisma migrate deploy` en el build de Railway
- `prisma.config.ts` usa dotenvx que interfería con Prisma CLI. Solución: el build de Railway tiene el DATABASE_URL como env var de Railway, no necesita dotenv

### Próximos pasos
- Configurar Railway Cron Jobs en el dashboard de Railway:
  - `POST /cron/generate-payments` — día 1 de cada mes (cron: `0 8 1 * *`)
  - `POST /cron/mark-overdue` — todos los días (cron: `0 9 * * *`)
  - Agregar env var `CRON_SECRET` en Railway
- Verificar que la migración de `monthlyFee` se aplique correctamente en el próximo deploy
- Plan 3 — Asistencia: módulo pendiente de implementar

## Sesión 2026-06-10

**Cambios (commit 71c1771):**
- Fix global de animaciones: eliminado scale de entrada en todos los módulos (cargan como Inicio)
- Badge de rol en sentence case; imágenes de posts completas (object-contain)
- Mi Perfil: avatar 150px + modal para editar teléfono/correo (PUT /members/:id)
- Club: logo 150/170px, botón Seguir visible para admin
- Ajustes: rediseño desktop en dos columnas (Mi perfil | Mi club), ayuda y cerrar sesión en Mi perfil
- Social: Post/PostComment guardan authorClerkId (migración 20260610150000); clic en avatar/nombre redirige al perfil del autor (posts nuevos)
- Corregido error de sintaxis en perfil/page.tsx que rompía el build

**Pendiente:** Plan 3 (Asistencia) · trial 15 días (plan) · lightbox tab Fotos en Mi Perfil
