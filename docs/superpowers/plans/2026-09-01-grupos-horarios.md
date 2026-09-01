# Grupos y horarios — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la lista de una clase salga de un grupo declarado y no de cruzar sede con categoría, para que dos clases de la misma sede y categoría a horas distintas dejen de traer a la misma gente.

**Architecture:** Un `Grupo` es un nombre y una sede. Las clases (`ClaseHorario`) cuelgan de él y conservan su día y su hora; los deportistas se le atan por una tabla puente. `ClaseHorario.grupoId` es opcional: cuando la clase tiene grupo la planilla son sus miembros, y cuando no la tiene sigue mandando la regla vieja, para que los clubes que ya operan no amanezcan con las listas vacías. La regla de pertenencia se escribe **una sola vez** en `api/src/lib/planilla.ts` y la usan la asistencia, el reporte y el conteo.

**Tech Stack:** Prisma + PostgreSQL, Express, Vitest en el backend. Next.js 15 + TanStack Query en el frontend.

**Fases:** la 1 entrega software que funciona por sí solo: los grupos existen, se administran y arman la planilla. La 2 hace que la gente entre a su grupo sola, por formulario y por Excel. Se pueden desplegar por separado.

---

## Contexto que el implementador necesita antes de empezar

**Dos fronteras, no una.** `clubId` separa clientes y `deporteId` separa deportes dentro de un club. El filtro por deporte **no se escribe en las rutas**: va montado en el cliente de Prisma (`api/src/lib/alcance.ts`). Un modelo nuevo que viva dentro de una carpeta de deporte hay que agregarlo a la lista `DENTRO_DE_LA_CARPETA` o queda sin aislar, en silencio.

**La regla que estamos reemplazando** vive hoy en dos sitios que hay que dejar en uno:
- `api/src/routes/attendance.ts:222-225` (el reporte)
- `web/app/dashboard/asistencia/page.tsx`, función `perteneceALaClase` (la planilla en pantalla)

**Verificar sin ejecutar en local.** En este proyecto nada se corre en local: se verifica con `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npm test`, y se revisa en producción. Si un build falla con `EINVAL ... readlink .next/...` es OneDrive, no el código: `rm -rf web/.next` y repetir.

**Consultar producción** (para la verificación de la Tarea 5):
```bash
cd api
DB=$(railway variables --service Postgres --json | python -c "import json,sys;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
NODE_PATH="$(pwd)/node_modules" DATABASE_URL="$DB" node <script>
```

---

## Estructura de archivos

### Fase 1 — el grupo existe y arma la planilla

| Archivo | Responsabilidad |
|---|---|
| `api/prisma/schema.prisma` | Modelos `Grupo` y `MemberGrupo`; `ClaseHorario.grupoId` |
| `api/prisma/migrations/<ts>_grupos/migration.sql` | Tablas + relleno de los grupos que ya existen implícitos |
| `api/src/lib/planilla.ts` | **Nuevo.** El único sitio que decide quién pertenece a una clase |
| `api/src/lib/alcance.ts` | Registrar `Grupo` como modelo de carpeta |
| `api/src/routes/grupos.ts` | **Nuevo.** CRUD de grupos y asignación de deportistas |
| `api/src/index.ts` | Montar `/grupos` |
| `api/src/routes/clases.ts` | Aceptar y devolver `grupoId` |
| `api/src/routes/attendance.ts` | Usar `planilla.ts` en vez de la regla escrita a mano |
| `api/src/tests/planilla.test.ts` | **Nuevo.** La regla de pertenencia y su convivencia |
| `web/hooks/useVeloQuery.ts` | Clave e invalidación de grupos |
| `web/components/ajustes/horario-clases.tsx` | Crear grupos y colgarles clases |
| `web/app/dashboard/asistencia/page.tsx` | Planilla por grupo |

### Fase 2 — la gente entra a su grupo sola

| Archivo | Responsabilidad |
|---|---|
| `api/src/routes/inscripcion.ts` | Ofrecer los grupos y guardar el elegido |
| `web/app/inscripcion/[token]/formulario.tsx` | Campo «Grupo y horario» en el paso 3 |
| `api/src/routes/members.ts` | `grupoIds` al crear, editar e importar |
| `web/lib/excel.ts` | Columna **Grupo** en la plantilla y en la lectura |
| `web/app/dashboard/miembros/page.tsx` | Grupo en la ficha y como filtro |

---

# FASE 1

## Tarea 1: El modelo

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Paso 1: Agregar el modelo `Grupo`**

En `api/prisma/schema.prisma`, justo antes de `model ClaseHorario`:

```prisma
// ─── Grupo ───────────────────────────────────────────────────────────────────
//
// Un grupo es un nombre y una sede. Nada mas.
//
// El dia y la hora NO viven aca: viven en cada ClaseHorario. Un grupo de lunes,
// miercoles y viernes a las 6 son tres clases colgadas del mismo grupo, no un
// campo con tres valores. Importa porque la asistencia se toma por clase: si el
// dia subiera al grupo, la asistencia perderia el detalle que ya tiene.
//
// Existe para que la pertenencia sea declarada y no deducida. Antes la planilla
// salia de cruzar la sede de la clase con la categoria del deportista, y dos
// clases que compartieran las dos cosas devolvian exactamente la misma lista.

model Grupo {
  id         String        @id @default(cuid())
  clubId     String
  club       Club          @relation(fields: [clubId], references: [id], onDelete: Cascade)
  deporteId  String
  deporte    Deporte       @relation(fields: [deporteId], references: [id], onDelete: Cascade)
  locationId String
  location   Location      @relation(fields: [locationId], references: [id], onDelete: Cascade)
  nombre     String
  // Desactivar no borra: el grupo deja de ofrecerse en el formulario y de
  // aparecer al crear clases, pero conserva su gente y su historia.
  activo     Boolean       @default(true)
  clases     ClaseHorario[]
  miembros   MemberGrupo[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  // Dos grupos con el mismo nombre en la misma sede no se distinguen en el
  // desplegable del formulario, que es donde los ve quien se inscribe.
  @@unique([locationId, nombre])
  @@index([clubId, deporteId])
}

// ─── MemberGrupo ─────────────────────────────────────────────────────────────
//
// Tabla puente, igual que MemberLocation y por la misma razon: un deportista
// puede entrenar en dos grupos, y ese caso ya se dio con las sedes.

model MemberGrupo {
  memberId String
  grupoId  String
  member   Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
  grupo    Grupo  @relation(fields: [grupoId], references: [id], onDelete: Cascade)

  @@id([memberId, grupoId])
  @@index([grupoId])
}
```

- [ ] **Paso 2: Colgar la clase de su grupo**

Dentro de `model ClaseHorario`, después de la línea `location   Location  @relation(...)`:

```prisma
  // Opcional a proposito, y no por indecision del modelo. Es lo unico que deja
  // seguir funcionando a un club que todavia no armo grupos: sin grupo, la
  // planilla sale de la regla vieja. Ver `api/src/lib/planilla.ts`.
  grupoId    String?
  grupo      Grupo?       @relation(fields: [grupoId], references: [id], onDelete: SetNull)
```

Y en la lista de índices de `ClaseHorario`, agregar:

```prisma
  @@index([grupoId])
```

- [ ] **Paso 3: Marcar `categoria` como respaldo**

En `model ClaseHorario`, reemplazar la linea `categoria   String?` por:

```prisma
  // RESPALDO, no criterio principal. Desde que existe `Grupo`, la planilla sale
  // del grupo; esto solo se usa en las clases que no tienen uno. Volver a
  // armar listas con la categoria es reintroducir el cruce que el grupo vino a
  // cerrar. Ver `api/src/lib/planilla.ts`.
  categoria   String?
```

- [ ] **Paso 4: Declarar las relaciones inversas**

En `model Club`, junto a `clases ClaseHorario[]`:

```prisma
  grupos                    Grupo[]
```

En `model Deporte`, junto a `clases ClaseHorario[]`:

```prisma
  grupos           Grupo[]
```

En `model Location`, junto a las demás relaciones:

```prisma
  grupos      Grupo[]
```

En `model Member`, junto a `locations MemberLocation[]`:

```prisma
  grupos            MemberGrupo[]
```

- [ ] **Paso 5: Verificar que el esquema es válido**

```bash
cd api && npx prisma validate
```
Esperado: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Paso 6: Generar el cliente**

```bash
cd api && npx prisma generate
```
Esperado: `Generated Prisma Client`

- [ ] **Paso 7: Commit**

```bash
git add api/prisma/schema.prisma
git commit -m "feat(grupos): el modelo del grupo y su tabla de pertenencia"
```

---

## Tarea 2: La migración, con su relleno

**Files:**
- Create: `api/prisma/migrations/<timestamp>_grupos/migration.sql`

- [ ] **Paso 1: Crear la migración sin aplicarla**

```bash
cd api && npx prisma migrate dev --name grupos --create-only
```
Esperado: crea la carpeta de migración y **no** la aplica.

- [ ] **Paso 2: Agregar el relleno al final del SQL generado**

Prisma escribe los `CREATE TABLE`. Al final del archivo, agregar esto tal cual:

```sql
-- ─── Relleno ────────────────────────────────────────────────────────────────
--
-- Hay clubes operando hoy. Si la planilla pasara a salir solo del grupo, el
-- lunes siguiente las listas amanecerian vacias. Este relleno hace que la
-- migracion sea invisible: el dia despues de desplegar, cada planilla trae
-- exactamente a la misma gente que traia antes.
--
-- Paso 1 — un grupo por cada par (sede, nombre) que ya existe en el horario.
INSERT INTO "Grupo" ("id", "clubId", "deporteId", "locationId", "nombre", "activo", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  c."clubId",
  c."deporteId",
  c."locationId",
  c."nombre",
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "clubId", "deporteId", "locationId", "nombre"
  FROM "ClaseHorario"
) c;

-- Paso 2 — cada clase apunta a su grupo.
UPDATE "ClaseHorario" ch
SET "grupoId" = g."id"
FROM "Grupo" g
WHERE g."locationId" = ch."locationId"
  AND g."nombre"     = ch."nombre";

-- Paso 3 — la pertenencia sale de la regla vieja: los que HOY apareceria en la
-- planilla de ese grupo. Es lo que hace que nadie note el cambio.
--
-- `DISTINCT` porque dos clases del mismo grupo (lunes y miercoles) producirian
-- la misma fila dos veces, y la llave primaria es (memberId, grupoId).
INSERT INTO "MemberGrupo" ("memberId", "grupoId")
SELECT DISTINCT m."id", g."id"
FROM "Grupo" g
JOIN "MemberLocation" ml ON ml."locationId" = g."locationId"
JOIN "Member" m          ON m."id" = ml."memberId"
JOIN "ClaseHorario" ch   ON ch."grupoId" = g."id"
WHERE m."clubId"    = g."clubId"
  AND m."deporteId" = g."deporteId"
  AND m."role"      = 'DEPORTISTA'
  AND m."active"    = true
  AND (ch."categoria" IS NULL OR m."category" = ch."categoria")
ON CONFLICT DO NOTHING;
```

- [ ] **Paso 3: Aplicar la migración**

```bash
cd api && npx prisma migrate dev
```
Esperado: `Your database is now in sync with your schema.`

- [ ] **Paso 4: Commit**

```bash
git add api/prisma/migrations
git commit -m "feat(grupos): la migracion, con el relleno que la vuelve invisible"
```

---

## Tarea 3: La regla de pertenencia, en un solo sitio

**Files:**
- Create: `api/src/lib/planilla.ts`
- Test: `api/src/tests/planilla.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

Crear `api/src/tests/planilla.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filtroDePlanilla } from '../lib/planilla';

// La pieza que decide quien entra a una planilla. Lo que se prueba no es que
// arme la lista, es que un club que todavia no armo grupos siga viendo
// exactamente lo que veia: si esta regla se equivoca, las listas de asistencia
// de los clubes que ya operan amanecen vacias o con gente de mas.

describe('una clase con grupo', () => {
  it('trae a los miembros del grupo, y la categoria deja de mandar', () => {
    expect(filtroDePlanilla({
      grupoId: 'g1', locationId: 'sede-1', categoria: 'Menores 3-10 años',
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      grupos: { some: { grupoId: 'g1' } },
    });
  });

  it('no filtra por sede: la sede ya la define el grupo', () => {
    const f = filtroDePlanilla({ grupoId: 'g1', locationId: 'sede-1', categoria: null });
    expect(f).not.toHaveProperty('locations');
  });
});

describe('una clase sin grupo', () => {
  it('cae a la regla vieja: sede cruzada con categoria', () => {
    expect(filtroDePlanilla({
      grupoId: null, locationId: 'sede-1', categoria: 'Menores 3-10 años',
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
      category: 'Menores 3-10 años',
    });
  });

  it('sin categoria declarada no filtra por categoria, o la lista saldria vacia', () => {
    expect(filtroDePlanilla({
      grupoId: null, locationId: 'sede-1', categoria: null,
    })).toEqual({
      role: 'DEPORTISTA',
      active: true,
      locations: { some: { locationId: 'sede-1' } },
    });
  });
});

describe('sin clase ninguna', () => {
  it('el dia entero de una sede', () => {
    expect(filtroDePlanilla({ grupoId: null, locationId: 'sede-1', categoria: null }))
      .toMatchObject({ locations: { some: { locationId: 'sede-1' } } });
  });

  it('sin sede tampoco, trae el club entero de esa carpeta', () => {
    expect(filtroDePlanilla({ grupoId: null, locationId: null, categoria: null }))
      .toEqual({ role: 'DEPORTISTA', active: true });
  });
});
```

- [ ] **Paso 2: Correr el test y ver que falla**

```bash
cd api && npx vitest run src/tests/planilla.test.ts
```
Esperado: FAIL, `Cannot find module '../lib/planilla'`

- [ ] **Paso 3: Escribir la implementación mínima**

Crear `api/src/lib/planilla.ts`:

```typescript
/**
 * Quien entra a la planilla de una clase.
 *
 * Existe para que la regla se escriba una sola vez. Estaba en dos sitios —el
 * reporte del backend y la pantalla de asistencia— y cualquier cambio habia que
 * acordarse de hacerlo en los dos, que es exactamente como se desincronizan.
 *
 * La regla, en dos renglones:
 *
 *   clase CON grupo  ->  los miembros de ese grupo. La categoria deja de mandar
 *                        y la sede tampoco hace falta: el grupo ya la tiene.
 *   clase SIN grupo  ->  la regla vieja, sede cruzada con categoria.
 *
 * El segundo renglon no es una transicion: es lo que deja seguir funcionando a
 * un club que nunca armo grupos, y se queda.
 */

export interface ClaseDeLaPlanilla {
  grupoId:    string | null;
  locationId: string | null;
  categoria:  string | null;
}

/** El `where` de Prisma para `member.findMany`, sin `clubId` ni `deporteId`:
 *  esos los pone el alcance por su cuenta. */
export function filtroDePlanilla({ grupoId, locationId, categoria }: ClaseDeLaPlanilla) {
  // Un deportista en pausa nunca entra: quedaria ausente todos los dias de sus
  // vacaciones y le arruinaria el porcentaje del año.
  const base = { role: 'DEPORTISTA' as const, active: true };

  if (grupoId) return { ...base, grupos: { some: { grupoId } } };

  return {
    ...base,
    ...(locationId ? { locations: { some: { locationId } } } : {}),
    // Sin categoria declarada no se filtra: una clase abierta a todas dejaria
    // la planilla vacia si se comparara contra null.
    ...(categoria ? { category: categoria } : {}),
  };
}
```

- [ ] **Paso 4: Correr el test y ver que pasa**

```bash
cd api && npx vitest run src/tests/planilla.test.ts
```
Esperado: PASS, 6 tests.

- [ ] **Paso 5: Commit**

```bash
git add api/src/lib/planilla.ts api/src/tests/planilla.test.ts
git commit -m "feat(grupos): la regla de quien entra a una planilla, en un solo sitio"
```

---

## Tarea 4: El aislamiento por deporte

**Files:**
- Modify: `api/src/lib/alcance.ts`

- [ ] **Paso 1: Registrar el modelo**

En `api/src/lib/alcance.ts`, dentro de `DENTRO_DE_LA_CARPETA`, agregar `'Grupo'` después de `'ClaseHorario'`:

```typescript
const DENTRO_DE_LA_CARPETA = new Set([
  'Location',
  'Member',
  'Attendance',
  'ClaseHorario',
  'Grupo',
  'Payment',
  'CashEntry',
  'Competition',
  'TrainingSession',
  'CalendarEvent',
  'Post',
]);
```

`MemberGrupo` **no** va en la lista: no tiene `deporteId` propio, y se llega a él siempre a través de `Member` o de `Grupo`, que sí están aislados.

- [ ] **Paso 2: Verificar que el arranque no reporta el modelo como inexistente**

```bash
cd api && npx tsc --noEmit
```
Esperado: sin errores. El chequeo de nombres corre al importar el módulo y escribiría `[alcance] estos modelos no existen` si el nombre estuviera mal.

- [ ] **Paso 3: Commit**

```bash
git add api/src/lib/alcance.ts
git commit -m "feat(grupos): el grupo se aisla por deporte como todo lo demas"
```

---

## Tarea 5: Verificar que la migración no le cambió la planilla a nadie

Esta tarea no escribe código de producto. Es la condición que el spec pone para dar la migración por buena, y sin ella no se despliega.

**Files:**
- Create: `scripts/verificar-migracion-grupos.js` (temporal, se borra al final)

- [ ] **Paso 1: Escribir el comparador**

Crear `scripts/verificar-migracion-grupos.js`:

```javascript
// Compara, para cada clase de cada club, la planilla VIEJA contra la NUEVA.
// Deben coincidir persona por persona. Si una sola no coincide, la migracion
// esta mal y se revierte.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const clases = await prisma.claseHorario.findMany({
    include: { club: { select: { name: true } } },
  });

  let fallas = 0;

  for (const c of clases) {
    // VIEJA: sede de la clase cruzada con su categoria
    const vieja = await prisma.member.findMany({
      where: {
        clubId: c.clubId, deporteId: c.deporteId,
        role: 'DEPORTISTA', active: true,
        locations: { some: { locationId: c.locationId } },
        ...(c.categoria ? { category: c.categoria } : {}),
      },
      select: { id: true }, orderBy: { id: 'asc' },
    });

    // NUEVA: los miembros del grupo al que quedo colgada
    const nueva = c.grupoId ? await prisma.member.findMany({
      where: { role: 'DEPORTISTA', active: true, grupos: { some: { grupoId: c.grupoId } } },
      select: { id: true }, orderBy: { id: 'asc' },
    }) : vieja;

    const a = vieja.map(m => m.id).join(',');
    const b = nueva.map(m => m.id).join(',');

    if (a === b) {
      console.log('OK   ' + c.club.name + ' · ' + c.nombre + ' (' + vieja.length + ')');
    } else {
      fallas++;
      console.log('FALLA ' + c.club.name + ' · ' + c.nombre);
      console.log('   vieja: ' + vieja.length + '  nueva: ' + nueva.length);
      const sobran = nueva.filter(m => !vieja.some(v => v.id === m.id)).map(m => m.id);
      const faltan = vieja.filter(m => !nueva.some(n => n.id === m.id)).map(m => m.id);
      if (sobran.length) console.log('   sobran: ' + sobran.join(', '));
      if (faltan.length) console.log('   faltan: ' + faltan.join(', '));
    }
  }

  console.log('\n==> clases con diferencia: ' + fallas);
  if (fallas > 0) process.exitCode = 1;
})().finally(() => prisma.$disconnect());
```

- [ ] **Paso 2: Correrlo contra producción**

```bash
cd api
DB=$(railway variables --service Postgres --json | python -c "import json,sys;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
NODE_PATH="$(pwd)/node_modules" DATABASE_URL="$DB" node ../scripts/verificar-migracion-grupos.js
```
Esperado: todas las líneas `OK` y `==> clases con diferencia: 0`.

**Si sale cualquier `FALLA`, parar acá.** No seguir con las tareas siguientes: el relleno de la Tarea 2 está mal y hay que corregirlo antes.

- [ ] **Paso 3: Borrar el script y commitear el resultado**

```bash
rm scripts/verificar-migracion-grupos.js
git commit --allow-empty -m "chore(grupos): migracion verificada contra produccion, 0 diferencias"
```

---

## Tarea 6: Las rutas del grupo

**Files:**
- Create: `api/src/routes/grupos.ts`
- Modify: `api/src/index.ts`

- [ ] **Paso 1: Escribir el router**

Crear `api/src/routes/grupos.ts`:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { carpetaDe } from '../lib/deportes';
import { prisma } from '../db/client';
import { emitToClub } from '../lib/sse';
import { sedeEsDelClub } from '../lib/sedes';

const router = Router();

const grupoSchema = z.object({
  nombre:     z.string().min(1).max(60),
  locationId: z.string().min(1),
});

const grupoParcial = grupoSchema.partial().extend({
  activo: z.boolean().optional(),
});

// Quien arma los grupos es quien dirige el club. Un entrenador los consulta al
// pasar asistencia, pero no le reorganiza los grupos al club.
function soloAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

// GET /grupos — los grupos de la carpeta, con sus clases y cuanta gente tienen
router.get('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  const grupos = await prisma.grupo.findMany({
    where: { clubId: req.user.clubId ?? '' },
    include: {
      location: { select: { id: true, name: true } },
      clases:   { select: { id: true, diaSemana: true, hora: true, activa: true } },
      _count:   { select: { miembros: true } },
    },
    orderBy: [{ nombre: 'asc' }],
  });
  res.json({ grupos });
});

// POST /grupos
router.post('/', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador' });

  const parsed = grupoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  if (!await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  const existe = await prisma.grupo.findFirst({
    where: { locationId: parsed.data.locationId, nombre: parsed.data.nombre.trim() },
    select: { id: true },
  });
  if (existe) return res.status(409).json({ error: 'Esa sede ya tiene un grupo con ese nombre' });

  const grupo = await prisma.grupo.create({
    data: {
      clubId,
      deporteId:  await carpetaDe(req),
      locationId: parsed.data.locationId,
      nombre:     parsed.data.nombre.trim(),
    },
  });

  emitToClub(clubId, 'attendance');
  res.status(201).json({ grupo });
});

// PATCH /grupos/:id
router.patch('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador' });

  const parsed = grupoParcial.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  const actual = await prisma.grupo.findFirst({
    where: { id: req.params.id, clubId }, select: { id: true },
  });
  if (!actual) return res.status(404).json({ error: 'Grupo no encontrado' });

  if (parsed.data.locationId && !await sedeEsDelClub(parsed.data.locationId, clubId)) {
    return res.status(403).json({ error: 'La sede no pertenece a este club' });
  }

  const grupo = await prisma.grupo.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.nombre     !== undefined ? { nombre: parsed.data.nombre.trim() } : {}),
      ...(parsed.data.locationId !== undefined ? { locationId: parsed.data.locationId } : {}),
      ...(parsed.data.activo     !== undefined ? { activo: parsed.data.activo } : {}),
    },
  });

  emitToClub(clubId, 'attendance');
  res.json({ grupo });
});

// DELETE /grupos/:id — solo si no tiene clases colgadas.
//
// El sentido de la falla es intencional: borrar un grupo con clases las dejaria
// sin padre y sus planillas caerian sin aviso a la regla vieja, que es
// exactamente el cruce que este modelo vino a evitar.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador' });

  const clubId = req.user.clubId ?? '';
  const grupo = await prisma.grupo.findFirst({
    where: { id: req.params.id, clubId },
    select: { id: true, _count: { select: { clases: true } } },
  });
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
  if (grupo._count.clases > 0) {
    return res.status(409).json({ error: 'El grupo todavía tiene clases. Quítaselas o desactívalo.' });
  }

  await prisma.grupo.delete({ where: { id: req.params.id } });
  emitToClub(clubId, 'attendance');
  res.json({ ok: true });
});

// PUT /grupos/:id/miembros — reemplaza la lista completa de un grupo
router.put('/:id/miembros', requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (!soloAdmin(req.user.role)) return res.status(403).json({ error: 'Solo un administrador' });

  const parsed = z.object({ memberIds: z.array(z.string()).max(500) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const clubId = req.user.clubId ?? '';
  const grupo = await prisma.grupo.findFirst({ where: { id: req.params.id, clubId }, select: { id: true } });
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

  // Los ids se comprueban contra la carpeta: sin esto, un id de otro deporte
  // entraria al grupo y el alcance no lo atrapa, porque MemberGrupo no lleva
  // deporteId propio.
  const validos = await prisma.member.findMany({
    where: { id: { in: parsed.data.memberIds }, clubId },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.memberGrupo.deleteMany({ where: { grupoId: grupo.id } }),
    prisma.memberGrupo.createMany({
      data: validos.map(m => ({ memberId: m.id, grupoId: grupo.id })),
      skipDuplicates: true,
    }),
  ]);

  emitToClub(clubId, 'attendance');
  res.json({ ok: true, asignados: validos.length });
});

export default router;
```

- [ ] **Paso 2: Montarlo**

En `api/src/index.ts`, junto a la línea `app.use('/clases', clasesRouter);`:

```typescript
import gruposRouter from './routes/grupos';
```
y
```typescript
app.use('/grupos', gruposRouter);
```

`/grupos` **no** se declara en `clubEntero`: vive dentro de una carpeta de deporte, como las clases.

- [ ] **Paso 3: Verificar tipos**

```bash
cd api && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Paso 4: Commit**

```bash
git add api/src/routes/grupos.ts api/src/index.ts
git commit -m "feat(grupos): las rutas para crear grupos y asignarles deportistas"
```

---

## Tarea 7: La clase cuelga de su grupo

**Files:**
- Modify: `api/src/routes/clases.ts`

- [ ] **Paso 1: Aceptar `grupoId` en el esquema**

En `api/src/routes/clases.ts`, dentro de `claseSchema`, después de `categoria`:

```typescript
  // Null es una clase suelta, sin grupo: su planilla sale de la regla vieja.
  grupoId:    z.string().nullable().optional(),
```

- [ ] **Paso 2: Guardarlo al crear**

En el `POST /`, dentro del `data:` de `prisma.claseHorario.create`, junto a `categoria`:

```typescript
      grupoId:    parsed.data.grupoId ?? null,
```

- [ ] **Paso 3: Guardarlo al editar**

En el `PATCH /:id`, junto a la línea de `categoria`:

```typescript
      ...(parsed.data.grupoId !== undefined ? { grupoId: parsed.data.grupoId } : {}),
```

- [ ] **Paso 4: Devolverlo en las dos consultas**

En `GET /`, agregar al `findMany` de clases:

```typescript
    include: { location: { select: { id: true, name: true } },
               grupo:    { select: { id: true, nombre: true } } },
```

En `GET /dia`, el `findMany` de `clases` ya trae `include: { location: ... }`. Agregarle:

```typescript
               grupo:    { select: { id: true, nombre: true } },
```

- [ ] **Paso 5: Verificar tipos**

```bash
cd api && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Paso 6: Commit**

```bash
git add api/src/routes/clases.ts
git commit -m "feat(grupos): la clase cuelga de un grupo"
```

---

## Tarea 8: El reporte usa la regla nueva

**Files:**
- Modify: `api/src/routes/attendance.ts:199-230`

- [ ] **Paso 1: Traer el grupo junto a la sede y la categoría**

En `GET /attendance/report`, donde hoy dice:

```typescript
    const clase = await prisma.claseHorario.findFirst({
      where: { id: claseId, clubId },
      select: { locationId: true, categoria: true },
    });
    if (!clase) return res.status(403).json({ error: 'La clase no pertenece a este club' });
    claseSede = clase.locationId;
    claseCategoria = clase.categoria;
```

reemplazar por:

```typescript
    const clase = await prisma.claseHorario.findFirst({
      where: { id: claseId, clubId },
      select: { locationId: true, categoria: true, grupoId: true },
    });
    if (!clase) return res.status(403).json({ error: 'La clase no pertenece a este club' });
    claseSede = clase.locationId;
    claseCategoria = clase.categoria;
    claseGrupo = clase.grupoId;
```

Y donde se declaran las variables, junto a `let claseCategoria: string | null = null;`:

```typescript
  let claseGrupo: string | null = null;
```

- [ ] **Paso 2: Reemplazar la regla escrita a mano**

Donde hoy dice:

```typescript
  const members = await prisma.member.findMany({
    where: {
      clubId,
      role: 'DEPORTISTA',
      active: true,
      ...(sedeFiltro ? { locations: { some: { locationId: sedeFiltro } } } : {}),
      // La planilla de esa clase solo tiene a los de su categoria; el reporte
      // debe listar exactamente a los mismos.
      ...(claseCategoria ? { category: claseCategoria } : {}),
    },
```

reemplazar por:

```typescript
  const members = await prisma.member.findMany({
    where: {
      clubId,
      // La regla vive en `lib/planilla.ts` y no aca. El reporte tiene que
      // listar exactamente a los mismos que la pantalla de asistencia, y
      // escribirla dos veces es como se desincronizaron la vez pasada.
      ...filtroDePlanilla({
        grupoId:    claseGrupo,
        locationId: sedeFiltro ?? null,
        categoria:  claseCategoria,
      }),
    },
```

- [ ] **Paso 3: Importar la función**

Al inicio de `api/src/routes/attendance.ts`, junto a los demás imports de `../lib`:

```typescript
import { filtroDePlanilla } from '../lib/planilla';
```

- [ ] **Paso 4: Verificar que la suite sigue verde**

```bash
cd api && npm test
```
Esperado: todos los tests pasan, incluidos los 6 de `planilla.test.ts`.

- [ ] **Paso 5: Commit**

```bash
git add api/src/routes/attendance.ts
git commit -m "feat(grupos): el reporte pregunta por el grupo antes que por la categoria"
```

---

## Tarea 9: La pantalla de asistencia arma la planilla por grupo

**Files:**
- Modify: `web/app/dashboard/asistencia/page.tsx`

- [ ] **Paso 1: Traer el grupo en el tipo de la clase**

En `interface ClaseDia`, agregar:

```typescript
  grupoId: string | null;
```

- [ ] **Paso 2: Traer los grupos de cada miembro**

Buscar el `interface Member` de esa pantalla y agregarle:

```typescript
  grupos?: { grupoId: string }[];
```

- [ ] **Paso 3: Cambiar la regla de pertenencia**

Reemplazar la función `perteneceALaClase` completa por:

```typescript
  // Misma regla que `api/src/lib/planilla.ts`, y por eso los comentarios estan
  // alla y no aca: con grupo manda el grupo, sin grupo manda sede + categoria.
  const grupoClase     = claseActiva?.grupoId ?? null;
  const categoriaClase = claseActiva?.categoria ?? null;
  const perteneceALaClase = useCallback((m: Member) => {
    // Un deportista en pausa nunca entra: quedaria ausente todos los dias de
    // sus vacaciones y le arruinaria el porcentaje del año.
    if (m.active === false) return false;
    if (grupoClase) return (m.grupos ?? []).some(g => g.grupoId === grupoClase);
    if (!m.locations.some(l => l.location.id === selectedLoc)) return false;
    if (categoriaClase && m.category !== categoriaClase) return false;
    return true;
  }, [selectedLoc, categoriaClase, grupoClase]);
```

- [ ] **Paso 4: Devolver los grupos desde el backend**

En `api/src/routes/members.ts`, en el `select` del `GET /members` (línea ~103), agregar junto a `locations`:

```typescript
        grupos: { select: { grupoId: true } },
```

- [ ] **Paso 5: Verificar tipos y build**

```bash
cd web && npx tsc --noEmit && rm -rf .next && npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Paso 6: Commit**

```bash
git add web/app/dashboard/asistencia/page.tsx api/src/routes/members.ts
git commit -m "feat(grupos): la planilla en pantalla sale del grupo"
```

---

## Tarea 10: Crear y editar grupos desde el panel

**Files:**
- Modify: `web/components/ajustes/horario-clases.tsx`
- Modify: `web/hooks/useVeloQuery.ts`

- [ ] **Paso 1: Clave de consulta e invalidación**

En `web/hooks/useVeloQuery.ts`, dentro del objeto `QK`:

```typescript
  grupos: () => ['grupos'] as const,
```

Y en el `case 'attendance'` del invalidador, junto a las dos líneas que ya están:

```typescript
        qc.invalidateQueries({ queryKey: QK.grupos() });
```

- [ ] **Paso 2: Tipo y carga de grupos en el componente**

En `web/components/ajustes/horario-clases.tsx`, junto a `interface Clase`:

```typescript
interface Grupo {
  id: string;
  nombre: string;
  activo: boolean;
  location: { id: string; name: string };
  clases: { id: string; diaSemana: number; hora: string; activa: boolean }[];
  _count: { miembros: number };
}
```

Agregar el estado junto a `const [clases, setClases] = useState<Clase[]>([]);`:

```typescript
  const [grupos, setGrupos] = useState<Grupo[]>([]);
```

Y en el `Promise.all` de la carga inicial, junto a la llamada de `/clases`:

```typescript
        apiFetch<{ grupos: Grupo[] }>('/grupos', { token }),
```
guardando el resultado con `setGrupos(resGrupos.grupos)`.

- [ ] **Paso 3: Selector de grupo en el modal de clase**

Dentro del modal «Nueva clase», entre el campo «Sede» y el campo «Categoría»:

```tsx
<div className="space-y-1.5">
  <Label className="text-[12px]">Grupo</Label>
  {/* Solo los grupos de la sede elegida: un grupo es un nombre Y una sede, asi
      que ofrecer los de otra sede es ofrecer algo que no existe. */}
  <Desplegable
    valor={editando.grupoId ?? ''}
    opciones={grupos
      .filter(g => g.activo && g.location.id === editando.locationId)
      .map(g => ({ valor: g.id, texto: g.nombre }))}
    vacio="Sin grupo"
    onElegir={v => setEditando({ ...editando, grupoId: v || null })}
  />
  <p className="text-[11px] text-muted-foreground">
    Sin grupo, la lista sale de la sede y la categoría, y dos clases iguales traen la misma gente.
  </p>
</div>
```

Y agregar `grupoId: string | null` al tipo del estado `editando`, con `grupoId: null` en su valor inicial.

- [ ] **Paso 4: Enviar `grupoId` al guardar**

En el `cuerpo` que se manda a `/clases`, junto a `categoria`:

```typescript
        grupoId: editando.grupoId,
```

- [ ] **Paso 5: Sección de grupos, encima del horario**

Antes de la lista de clases, dentro del mismo bloque:

```tsx
<div>
  <h3 className="text-[13px] font-semibold text-foreground m-0">Grupos</h3>
  <p className="text-[11px] text-muted-foreground">
    Un grupo es un nombre y una sede. Las clases cuelgan de él y sus deportistas entran a la lista de todas.
  </p>
</div>
<div className="flex flex-col gap-1.5">
  {grupos.map(g => (
    <div key={g.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
      style={{ background: '#fff', border: '1.5px solid rgba(26,16,40,0.08)' }}>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground m-0 truncate">{g.nombre}</p>
        <p className="text-[11px] text-muted-foreground m-0 truncate">
          {g.location.name} · {g._count.miembros} deportistas · {g.clases.length} clases
        </p>
      </div>
    </div>
  ))}
</div>
```

Con un botón «Agregar grupo» que abra un modal de dos campos (nombre y sede) y haga `POST /grupos`, siguiendo exactamente la misma forma que el modal de clase que ya existe en este archivo.

- [ ] **Paso 6: Verificar**

```bash
cd web && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build
```
Esperado: `✓ Compiled successfully`, sin avisos nuevos.

- [ ] **Paso 7: Commit**

```bash
git add web/components/ajustes/horario-clases.tsx web/hooks/useVeloQuery.ts
git commit -m "feat(grupos): crear grupos y colgarles clases desde Ajustes"
```

---

## Tarea 11: Asignar deportistas a un grupo

**Files:**
- Modify: `web/components/ajustes/horario-clases.tsx`

- [ ] **Paso 1: Modal de asignación**

Al tocar un grupo de la lista de la Tarea 10, abrir un modal con la lista de deportistas de esa sede y una casilla por cada uno, con los del grupo ya marcados. Al guardar:

```typescript
await apiFetch(`/grupos/${grupoId}/miembros`, {
  token, method: 'PUT', body: { memberIds: seleccionados },
});
```

La lista de candidatos sale de `GET /members`, filtrando en el cliente por la sede del grupo:

```typescript
const candidatos = miembros.filter(m =>
  m.role === 'DEPORTISTA' && m.active !== false &&
  m.locations.some(l => l.location.id === grupo.location.id));
```

- [ ] **Paso 2: Verificar**

```bash
cd web && npx tsc --noEmit && rm -rf .next && npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Paso 3: Commit**

```bash
git add web/components/ajustes/horario-clases.tsx
git commit -m "feat(grupos): asignar deportistas a un grupo desde el panel"
```

---

**Fin de la Fase 1.** En este punto los grupos existen, se administran, y la planilla de una clase con grupo sale de su gente. Los clubes que no armaron grupos siguen exactamente igual. Se puede desplegar.

---

# FASE 2

## Tarea 12: El formulario ofrece los grupos

**Files:**
- Modify: `api/src/routes/inscripcion.ts`
- Modify: `web/app/inscripcion/[token]/formulario.tsx`

- [ ] **Paso 1: Devolver los grupos en la configuración del enlace**

En `GET /:token` de `api/src/routes/inscripcion.ts`, junto a la consulta de `sedes`:

```typescript
  const grupos = await prisma.grupo.findMany({
    where: { activo: true },
    select: {
      id: true, nombre: true, locationId: true,
      clases: { where: { activa: true }, select: { diaSemana: true, hora: true } },
    },
    orderBy: { nombre: 'asc' },
  });
```

Y agregarlo a la respuesta, junto a `sedes`:

```typescript
    grupos,
```

- [ ] **Paso 2: Aceptar y guardar el grupo elegido**

En el esquema del `POST /:token`, junto a `category`:

```typescript
  grupoId: z.string().optional(),
```

Y en el `create` del miembro, junto a `locations: { create: [{ locationId: sede.id }] }`:

```typescript
        // El grupo se comprueba contra la sede elegida: un id de otro sitio
        // metido a mano en la peticion entraria sin esto.
        ...(d.grupoId ? { grupos: { create: [{ grupoId: d.grupoId }] } } : {}),
```

Antes del `create`, la comprobación:

```typescript
  if (d.grupoId) {
    const g = await prisma.grupo.findFirst({
      where: { id: d.grupoId, locationId: sede.id, activo: true },
      select: { id: true },
    });
    if (!g) return res.status(400).json({ error: 'Ese grupo no existe en la sede elegida', campo: 'grupoId' });
  }
```

- [ ] **Paso 3: El campo en el paso 3 del formulario**

En `web/app/inscripcion/[token]/formulario.tsx`, en el bloque `{paso === 2 && (`, justo después del campo «Sede donde entrena»:

```tsx
{gruposDeLaSede.length > 0 && (
  <Campo etiqueta="Grupo y horario" obligatorio error={errores.grupoId}
    falta={faltaba('grupoId')} listo={traido('grupoId')}>
    <Desplegable
      valor={d.grupoId}
      opciones={gruposDeLaSede.map(g => ({
        valor: g.id,
        texto: g.nombre,
        // Los dias y la hora debajo del nombre: la persona elige por horario,
        // que es como piensa, no por un nombre de grupo que no conoce.
        detalle: resumenHorario(g.clases),
      }))}
      vacio="Elegir grupo"
      error={!!errores.grupoId}
      onElegir={v => set('grupoId', v)}
    />
  </Campo>
)}
```

Con estas piezas cerca de los demás derivados del componente:

```tsx
const gruposDeLaSede = useMemo(
  () => (config?.grupos ?? []).filter(g => g.locationId === d.locationId),
  [config, d.locationId]);

// "Lun, Mié, Vie · 6:00 a. m." — los dias juntos y la hora una sola vez cuando
// todas las clases coinciden, que es el caso normal de un grupo.
function resumenHorario(clases: { diaSemana: number; hora: string }[]): string {
  if (!clases.length) return 'Sin horario definido';
  const dias = [...new Set(clases.map(c => c.diaSemana))]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(v => DIA_CORTO_3[v]).join(', ');
  const horas = [...new Set(clases.map(c => c.hora))].sort();
  return `${dias} · ${horas.map(horaLegible).join(' / ')}`;
}
```

Los dos ayudantes que usa `resumenHorario` hay que importarlos al inicio del archivo:

```typescript
import { DIA_CORTO_3 } from '@/lib/dias';
import { horaLegible } from '@/components/ajustes/horario-clases';
```

Y el tipo de `config` gana el campo:

```typescript
  grupos: { id: string; nombre: string; locationId: string;
            clases: { diaSemana: number; hora: string }[] }[];
```

- [ ] **Paso 4: Hacerlo obligatorio cuando la sede tiene grupos**

En la validación del paso 2 (`if (paso === 2)`), junto a la de `locationId`:

```typescript
      if (gruposDeLaSede.length > 0 && !d.grupoId) e.grupoId = 'Elige tu grupo y horario';
```

Agregar `grupoId: ''` al estado inicial, `'grupoId'` a la lista de campos rastreados, `grupoId: 2` al mapa `pasoDelCampo`, y `grupoId: d.grupoId || undefined` al cuerpo que se envía.

- [ ] **Paso 5: Verificar**

```bash
cd api && npx tsc --noEmit && cd ../web && npx tsc --noEmit && rm -rf .next && npm run build
```
Esperado: sin errores, `✓ Compiled successfully`

- [ ] **Paso 6: Commit**

```bash
git add api/src/routes/inscripcion.ts web/app/inscripcion/\[token\]/formulario.tsx
git commit -m "feat(grupos): el formulario pregunta el grupo y su horario"
```

---

## Tarea 13: El Excel trae la columna Grupo

**Files:**
- Modify: `web/lib/excel.ts`
- Modify: `api/src/routes/members.ts`

- [ ] **Paso 1: La columna en la plantilla**

En `web/lib/excel.ts`, en el arreglo `headers`, agregar `'Grupo'` justo después de `'Sede'`. Agregar el valor de ejemplo correspondiente en `example`, y a la lista de notas:

```typescript
    '* Grupo: debe existir en la sede de esa fila; si no coincide, la fila entra sin grupo',
```

- [ ] **Paso 2: Leerla al importar**

Donde hoy dice `const locationName = texto(r, 'Sede');`, agregar debajo:

```typescript
        const grupoName = texto(r, 'Grupo');
```

y pasarlo en el objeto que se envía, junto a `category`:

```typescript
          grupoName,
```

- [ ] **Paso 3: Resolverla en el backend**

En `POST /members/import` de `api/src/routes/members.ts`, donde se resuelve la sede de cada fila, agregar después:

```typescript
    // Ojo: distinto de lo que hace la columna de sede, que ante un nombre
    // inexistente descarta la fila entera. Un grupo que no coincide NO pierde
    // al deportista: entra sin grupo y se reporta al final. Ese comportamiento
    // ya costo dos filas perdidas en New Power Skate el 1 de septiembre.
    let grupoId: string | null = null;
    if (fila.grupoName && locationId) {
      const g = await prisma.grupo.findFirst({
        where: { nombre: fila.grupoName.trim(), locationId, activo: true },
        select: { id: true },
      });
      if (g) grupoId = g.id;
      else avisos.push(`Fila ${i + 2}: el grupo "${fila.grupoName}" no existe en esa sede. Entró sin grupo.`);
    }
```

Y al crear el miembro, junto a `locations`:

```typescript
        ...(grupoId ? { grupos: { create: [{ grupoId }] } } : {}),
```

- [ ] **Paso 4: Verificar**

```bash
cd api && npx tsc --noEmit && npm test && cd ../web && npx tsc --noEmit && rm -rf .next && npm run build
```
Esperado: todo verde.

- [ ] **Paso 5: Commit**

```bash
git add web/lib/excel.ts api/src/routes/members.ts
git commit -m "feat(grupos): la plantilla de Excel trae la columna Grupo"
```

---

## Tarea 14: El grupo en Miembros

**Files:**
- Modify: `web/app/dashboard/miembros/page.tsx`

- [ ] **Paso 1: Mostrarlo en la ficha**

En la ficha del deportista, junto a donde hoy se pinta `category`, agregar el nombre de su grupo (que llega en `m.grupos`, resuelto contra la lista de `/grupos`).

- [ ] **Paso 2: Filtro por grupo**

Junto al filtro de categoría que ya existe (`catFilter`), agregar `grupoFilter` con la misma forma: un `Desplegable` con los grupos de la carpeta y la opción «Todos», y sumar la condición a las funciones de filtrado:

```typescript
const matchGrupo = grupoFilter === 'ALL'
  || (m.grupos ?? []).some(g => g.grupoId === grupoFilter);
```

- [ ] **Paso 3: Verificar**

```bash
cd web && npx tsc --noEmit && rm -rf .next && npm run build
```
Esperado: `✓ Compiled successfully`

- [ ] **Paso 4: Commit**

```bash
git add web/app/dashboard/miembros/page.tsx
git commit -m "feat(grupos): el grupo se ve y se filtra en Miembros"
```

---

## Tarea 15: Cerrar

- [ ] **Paso 1: Suite completa**

```bash
cd api && npm test && npx tsc --noEmit && npm run lint
cd ../web && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build
```
Esperado: todo verde, sin avisos nuevos.

- [ ] **Paso 2: Actualizar `CLAUDE.md`**

En la sección «Modelo de datos clave», agregar:

```markdown
- `Grupo` = con quién entrena un deportista. Es un nombre y una sede; el día y
  la hora viven en sus `ClaseHorario`. La planilla de una clase con grupo son
  sus miembros; sin grupo cae a la regla vieja, sede cruzada con categoría. Esa
  decisión vive en un solo sitio, `api/src/lib/planilla.ts`.
```

En «Estructura de rutas API», junto a `/deportes`:

```
GET/POST   /grupos                     # los grupos de la carpeta
PATCH      /grupos/:id
DELETE     /grupos/:id                 # solo si no tiene clases
PUT        /grupos/:id/miembros        # reemplaza la lista del grupo
```

- [ ] **Paso 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: los grupos en el mapa del proyecto"
```
