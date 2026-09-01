-- Grupos: con quien entrena un deportista.
--
-- Hasta hoy la planilla de una clase no se declaraba, se deducia: salia de
-- cruzar la sede de la clase con la categoria del deportista. Esa regla tiene
-- una falla exacta: dos clases que comparten sede y categoria devuelven
-- EXACTAMENTE la misma lista, asi que una sede con grupo de la manana y grupo
-- de la tarde no se puede representar.
--
-- Un grupo es un nombre y una sede. Las clases cuelgan de el y conservan su dia
-- y su hora, porque la asistencia se toma por clase y subirle el dia al grupo
-- le quitaria ese detalle.
--
-- `ClaseHorario.grupoId` queda NULLABLE a proposito. Es lo unico que deja
-- seguir funcionando a un club que todavia no armo grupos: sin grupo, la
-- planilla sale de la regla vieja. Ver `api/src/lib/planilla.ts`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Las tablas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "deporteId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberGrupo" (
    "memberId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,

    CONSTRAINT "MemberGrupo_pkey" PRIMARY KEY ("memberId","grupoId")
);

-- Dos grupos con el mismo nombre en la misma sede no se distinguen en el
-- desplegable del formulario, que es donde los ve quien se inscribe.
CREATE UNIQUE INDEX "Grupo_locationId_nombre_key" ON "Grupo"("locationId", "nombre");
CREATE INDEX "Grupo_clubId_deporteId_idx" ON "Grupo"("clubId", "deporteId");
CREATE INDEX "MemberGrupo_grupoId_idx" ON "MemberGrupo"("grupoId");

ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_deporteId_fkey"
    FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberGrupo" ADD CONSTRAINT "MemberGrupo_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberGrupo" ADD CONSTRAINT "MemberGrupo_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La clase cuelga de su grupo
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ClaseHorario" ADD COLUMN "grupoId" TEXT;

CREATE INDEX "ClaseHorario_grupoId_idx" ON "ClaseHorario"("grupoId");

-- ON DELETE SET NULL y no CASCADE: borrar un grupo no puede llevarse por
-- delante las clases ni su historial de asistencia. La clase queda suelta y
-- vuelve a la regla vieja, que es degradarse, no perder datos.
ALTER TABLE "ClaseHorario" ADD CONSTRAINT "ClaseHorario_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Relleno: los grupos que ya existen, implicitos
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hay clubes operando hoy. Si la planilla pasara a salir solo del grupo, el
-- lunes siguiente las listas de asistencia amanecerian vacias. Esto hace que la
-- migracion sea invisible: el dia despues de desplegar, cada planilla trae
-- exactamente a la misma gente que traia antes. Lo unico que cambia es que esa
-- pertenencia ya esta escrita y se puede editar.

-- 3.1 — un grupo por cada par (sede, nombre) que ya existe en el horario
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

-- 3.2 — cada clase apunta a su grupo
UPDATE "ClaseHorario" ch
SET "grupoId" = g."id"
FROM "Grupo" g
WHERE g."locationId" = ch."locationId"
  AND g."nombre"     = ch."nombre";

-- 3.3 — la pertenencia sale de la regla vieja: los que HOY apareceria en la
--       planilla de ese grupo.
--
-- DISTINCT porque dos clases del mismo grupo (lunes y miercoles) produciran la
-- misma fila dos veces, y la llave primaria es (memberId, grupoId).
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
