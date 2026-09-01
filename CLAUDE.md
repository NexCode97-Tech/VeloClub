# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

SaaS multi-tenant para gestión de clubes de patinaje. Desarrollado por NexCode97. Monorepo con `web/` (Next.js en Vercel) y `api/` (Express en Railway), conectados a PostgreSQL. La base es un servicio de Postgres 18 dentro del mismo proyecto de Railway, no un proveedor aparte.

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

### Multi-tenancy y deportes
Hay **dos fronteras**, no una:

1. **`clubId`** separa clientes. Toda entidad del dominio lo lleva obligatorio.
2. **`deporteId`** separa deportes *dentro* de un club. Un club puede ofrecer
   patinaje y natación, y cada uno es una carpeta con sus propios deportistas,
   sedes, asistencia, mensualidades, caja y resultados. Nada se comparte.

**El filtro por deporte NO se escribe en las rutas.** Va montado en el cliente
de Prisma (`api/src/lib/alcance.ts`), en el mismo sitio donde vive la auditoría
y por la misma razón: instrumentar cincuenta rutas a mano significa olvidarse de
la próxima que alguien agregue. `requireAuth` resuelve la carpeta activa y la
deja en el contexto de la petición; el cliente la aplica a todo lo que se
consulte después.

Las rutas que cruzan clubes a propósito se declaran en `api/src/index.ts` con
`clubEntero`: superadmin, muro público, perfiles, buscador, `/me`, `/deportes`.
**El sentido de la falla es intencional**: olvidar una declaración deja una
pantalla vacía que alguien reporta el mismo día; el olvido contrario mostraría
datos de otro deporte sin que lo notara nadie.

Para una consulta suelta que sí debe ver el club completo existe
`prismaClubEntero` en `api/src/db/client.ts`. Está separado justo para que se
note: `grep prismaClubEntero` lista, en una sola pantalla, cada consulta que
mira más allá de una carpeta. Ahí vive el conteo que define el precio del plan
— el club paga por la **suma de todos sus deportes**, no por carpeta.

Dos cosas que la base de datos no atrapa y hay que cuidar a mano:
- **Las claves de Redis llevan el deporte** además del club. Una clave por club
  le serviría a natación la lista cacheada de patinaje, y la consulta ni
  llegaría a hacerse.
- **Los trabajos en cola reciben el `deporteId` en el payload.** Corren fuera de
  la petición, así que no heredan el contexto.

Quién cruza carpetas: **cualquier ADMIN**. Entrenadores y deportistas viven en
la suya y el selector se les queda como rótulo, no como control. La condición se
resuelve **solo por el rol** (`resolverCarpeta` en `api/src/lib/deportes.ts`),
nunca por «es el dueño»: el dueño se declara a mano desde el panel de
superadmin, y bastaría nombrar ahí a un entrenador para colarle el permiso por
la puerta de atrás.

`Club.ownerUserId` **no gobierna permisos**. Es el interlocutor declarado del
club — a quién responde. Se declara y no se deduce; la migración inicial lo
dedujo del ADMIN más antiguo y se corrige desde Superadmin → Clubes → el club →
«Dueño del club».

El **enlace de inscripción es por deporte** (`Deporte.inscripcionToken`): quien
entra por él cae directo en esa carpeta, sin que nadie tenga que repartirlo
después.

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

GET        /me                       # bootstrap de sesión (incluye el selector de deporte)
GET/PATCH  /clubs/:id               # configuración del club

GET/POST   /grupos                     # los grupos de la carpeta
PATCH      /grupos/:id
DELETE     /grupos/:id                 # solo si no tiene clases colgadas
PUT        /grupos/:id/miembros        # reemplaza la lista completa del grupo

GET/POST   /deportes                 # las carpetas del club
PATCH      /deportes/:id             # renombrar, activar, desactivar
DELETE     /deportes/:id             # solo si está vacía

/superadmin/*                        # solo SUPERADMIN — clubs, suscripciones, notificaciones
```

### Modelo de datos clave
- `Deporte` = la carpeta. Cuelga del club y lleva su propio enlace de inscripción.
- `User` = staff del club (ADMIN, ENTRENADOR). Tiene `clerkId` único y un
  `deporteId` opcional: es la carpeta donde trabaja. En null no vive en ninguna
  en particular y entra por la más antigua. No confundir con permisos: quien
  cambia de deporte se decide por el rol.
- `Member` = deportista. Puede o no tener `clerkId` (si fue invitado). Tiene su propio `role = STUDENT`.
- `Payment` = mensualidad con `month` + `year` + `memberId`. Genera `CashEntry` automáticamente al pagarse.
- `Grupo` = **con quién entrena** un deportista. Es un nombre y una sede; el día
  y la hora viven en sus `ClaseHorario`. La planilla de una clase con grupo son
  sus miembros; **sin grupo cae a la regla vieja**, sede cruzada con categoría.
  Esa decisión vive en un solo sitio: `api/src/lib/planilla.ts`. La regla en una
  línea: **la categoría describe al deportista, el grupo dice con quién
  entrena**. Antes la categoría hacía las dos cosas, y por eso dos clases de la
  misma sede y categoría a horas distintas devolvían la misma lista.
- `Attendance` tiene constraint `@@unique([memberId, date])` — un registro por miembro por día.
- `CalendarEvent` soporta recurrencia: `NONE | DAILY | WEEKLY | CUSTOM` (con `weekDays: Int[]`).
- `Competition → CompetitionEvent → EventResult` (resultados de competencias).
- `TrainingSession → TrainingResult` (resultados de entrenamientos).

### Design system
- **Morado de marca: `#381DA0`.** Es el único oficial y el que va en botones,
  enlaces, estados activos y el sidebar.
- Background: `#F7F7FB` | Cards: `#fff` | Border: `rgba(120,80,200,0.10)`
- Accent ADMIN: `#4361EE` | Accent COACH: `#06D6A0` | Accent STUDENT: `#381DA0`
- Muted: `#8E87A8` | Text: `#1A1028`
- **Sin degradados de marca dentro de la app.** El morado va plano, incluida la
  pantalla de carga y la transición entre rutas. Tres excepciones: la landing
  conserva los suyos, las gráficas conservan el área bajo la línea, y las
  máscaras de scroll, sombras y halos de ambiente no son marca aunque estén
  escritos con `gradient`.
- Fuente: **Geist Sans**, la única de toda la plataforma. Se carga en `app/layout.tsx`
  con `geist/font/sans`, no desde Google Fonts. Títulos y cuerpo son la misma familia:
  lo que los separa es el peso y el `letter-spacing`. **Nunca escribir un nombre de
  fuente suelto** en `style` ni en una clase; si no se carga, el navegador cae al sans
  del sistema y la pantalla se ve distinta en cada computador. Para código y cifras
  alineadas, **Geist Mono** vía `font-mono`.
- Mobile-first PWA con bottom tab bar por rol. Desktop con sidebar de 210px
  (64 colapsado), visible desde `md`.

### Íconos

Son **propios**, en `web/components/ui/custom-icons.tsx`. Lucide queda solo
donde todavía no hay equivalente dibujado; al agregar uno propio se reemplaza
en **todos** sus usos de una vez, no solo en la pantalla que se esté tocando.
Un mismo concepto con dos dibujos según la pantalla es el error que más veces
ha aparecido aquí: pasó con el verificado, con el teléfono y con la billetera.

Dos reglas al agregar uno:

- **El lienzo lleva margen si el dibujo llega al borde**: `viewBox="-2 -2 28 28"`
  en vez de `"0 0 24 24"`, sin tocar el `path`. El tamaño que se escribe
  (`w-[13px]`) se le da al lienzo, no al dibujo, así que uno que llene el borde
  se ve un sexto más grande que un Lucide del mismo tamaño, y si tiene un canto
  recto pegado al límite, esa fila de píxeles se pinta a medias y se lee como
  recortada. Le pasó al calendario.
- **El tamaño va por clase, nunca con `size`.** `size` es una prop de Lucide, no
  un atributo de SVG: en los propios no hace nada y en TypeScript falla si la
  lista mezcla unos y otros.

Los ~50 íconos viejos no llevan ese margen. **No se normalizan en masa**: sus
tamaños están calibrados a ojo por toda la plataforma y cambiarlos de golpe
obliga a revisarla entera a ciegas. Se normalizan por pantalla, cuando se
trabaje en ella y se pueda mirar el resultado. Mientras convivan las dos
generaciones, un ícono viejo junto a uno nuevo se compensa en el tamaño de ese
uso —`w-[11px]` contra `w-[13px]` en las fichas de Inicio— con el porqué al lado.

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
