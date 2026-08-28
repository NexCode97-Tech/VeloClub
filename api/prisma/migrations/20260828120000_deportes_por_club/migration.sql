-- Varios deportes por club.
--
-- Cada club pasa a tener carpetas («deportes») con aislamiento total: sus
-- deportistas, sedes, asistencia, caja y resultados no se mezclan con los de
-- otra carpeta. Lo unico que las cruza es el dueno del club.
--
-- Todo lo que hay hoy es patinaje, asi que a cada club se le crea una carpeta
-- «Patinaje» y se le cuelga lo que ya tenia. El enlace de inscripcion se muda
-- de Club a Deporte CONSERVANDO EL MISMO TOKEN: los enlaces que los clubes ya
-- repartieron por WhatsApp tienen que seguir abriendo.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La tabla de carpetas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Deporte" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "inscripcionToken" TEXT,
    "inscripcionAbierta" BOOLEAN NOT NULL DEFAULT false,
    "inscripcionEsperados" INTEGER,
    "inscripcionVenceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Deporte_inscripcionToken_key" ON "Deporte"("inscripcionToken");
CREATE INDEX "Deporte_clubId_idx" ON "Deporte"("clubId");
CREATE UNIQUE INDEX "Deporte_clubId_nombre_key" ON "Deporte"("clubId", "nombre");

ALTER TABLE "Deporte" ADD CONSTRAINT "Deporte_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una carpeta «Patinaje» por club, con el enlace de inscripcion que el club ya
-- tenia. `createdAt` toma la del club para que la carpeta no aparezca como
-- creada hoy en una plataforma que lleva meses andando.
INSERT INTO "Deporte" (
  "id", "clubId", "nombre", "activo",
  "inscripcionToken", "inscripcionAbierta", "inscripcionEsperados", "inscripcionVenceAt",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  'Patinaje',
  true,
  c."inscripcionToken",
  c."inscripcionAbierta",
  c."inscripcionEsperados",
  c."inscripcionVenceAt",
  c."createdAt",
  NOW()
FROM "Club" c;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La columna, primero opcional, para poder llenarla antes de exigirla
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Location"        ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Member"          ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Attendance"      ADD COLUMN "deporteId" TEXT;
ALTER TABLE "ClaseHorario"    ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Payment"         ADD COLUMN "deporteId" TEXT;
ALTER TABLE "CashEntry"       ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Competition"     ADD COLUMN "deporteId" TEXT;
ALTER TABLE "TrainingSession" ADD COLUMN "deporteId" TEXT;
ALTER TABLE "CalendarEvent"   ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Post"            ADD COLUMN "deporteId" TEXT;

-- En este punto hay exactamente una carpeta por club, asi que el cruce por
-- clubId no tiene ambiguedad posible.
UPDATE "Location"        t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "Member"          t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "Attendance"      t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "ClaseHorario"    t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "Payment"         t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "CashEntry"       t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "Competition"     t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "TrainingSession" t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "CalendarEvent"   t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";
UPDATE "Post"            t SET "deporteId" = d."id" FROM "Deporte" d WHERE d."clubId" = t."clubId";

-- Si algo quedo sin carpeta, la migracion se detiene aca en vez de dejar una
-- fila huerfana que despues nadie ve porque justamente no pertenece a ninguna.
DO $$
DECLARE huerfanas INT;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "Location"        WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "Member"          WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "Attendance"      WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "ClaseHorario"    WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "Payment"         WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "CashEntry"       WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "Competition"     WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "TrainingSession" WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "CalendarEvent"   WHERE "deporteId" IS NULL) +
    (SELECT COUNT(*) FROM "Post"            WHERE "deporteId" IS NULL)
  INTO huerfanas;
  IF huerfanas > 0 THEN
    RAISE EXCEPTION 'Quedaron % filas sin carpeta de deporte; se aborta la migracion', huerfanas;
  END IF;
END $$;

ALTER TABLE "Location"        ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "Member"          ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "Attendance"      ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "ClaseHorario"    ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "Payment"         ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "CashEntry"       ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "Competition"     ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "TrainingSession" ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "CalendarEvent"   ALTER COLUMN "deporteId" SET NOT NULL;
ALTER TABLE "Post"            ALTER COLUMN "deporteId" SET NOT NULL;

CREATE INDEX "Location_deporteId_idx"        ON "Location"("deporteId");
CREATE INDEX "Member_deporteId_idx"          ON "Member"("deporteId");
CREATE INDEX "Attendance_deporteId_idx"      ON "Attendance"("deporteId");
CREATE INDEX "ClaseHorario_deporteId_idx"    ON "ClaseHorario"("deporteId");
CREATE INDEX "Payment_deporteId_idx"         ON "Payment"("deporteId");
CREATE INDEX "CashEntry_deporteId_idx"       ON "CashEntry"("deporteId");
CREATE INDEX "Competition_deporteId_idx"     ON "Competition"("deporteId");
CREATE INDEX "TrainingSession_deporteId_idx" ON "TrainingSession"("deporteId");
CREATE INDEX "CalendarEvent_deporteId_idx"   ON "CalendarEvent"("deporteId");
CREATE INDEX "Post_deporteId_idx"            ON "Post"("deporteId");

ALTER TABLE "Location"        ADD CONSTRAINT "Location_deporteId_fkey"        FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Member"          ADD CONSTRAINT "Member_deporteId_fkey"          FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance"      ADD CONSTRAINT "Attendance_deporteId_fkey"      FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaseHorario"    ADD CONSTRAINT "ClaseHorario_deporteId_fkey"    FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment"         ADD CONSTRAINT "Payment_deporteId_fkey"         FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashEntry"       ADD CONSTRAINT "CashEntry_deporteId_fkey"       FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competition"     ADD CONSTRAINT "Competition_deporteId_fkey"     FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_deporteId_fkey" FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"   ADD CONSTRAINT "CalendarEvent_deporteId_fkey"   FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post"            ADD CONSTRAINT "Post_deporteId_fkey"            FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. El staff y el dueno
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "deporteId" TEXT;
CREATE INDEX "User_deporteId_idx" ON "User"("deporteId");
ALTER TABLE "User" ADD CONSTRAINT "User_deporteId_fkey"
  FOREIGN KEY ("deporteId") REFERENCES "Deporte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Todo el staff de un club queda amarrado a la carpeta de Patinaje. El
-- SUPERADMIN de la plataforma no tiene club y no entra aca.
UPDATE "User" u
   SET "deporteId" = d."id"
  FROM "Deporte" d
 WHERE d."clubId" = u."clubId"
   AND u."clubId" IS NOT NULL
   AND u."role" <> 'SUPERADMIN';

ALTER TABLE "Club" ADD COLUMN "ownerUserId" TEXT;
CREATE UNIQUE INDEX "Club_ownerUserId_key" ON "Club"("ownerUserId");

-- El dueno es el ADMIN mas antiguo del club: es quien lo registro. Queda
-- escrito de una vez para no volver a deducirlo nunca mas.
UPDATE "Club" c
   SET "ownerUserId" = (
     SELECT u."id" FROM "User" u
      WHERE u."clubId" = c."id" AND u."role" = 'ADMIN'
      ORDER BY u."createdAt" ASC, u."id" ASC
      LIMIT 1
   );

-- El dueno cruza todas las carpetas, y eso se representa con la carpeta en
-- null. Va despues del UPDATE de arriba, que lo dejo amarrado como a los demas.
UPDATE "User" u
   SET "deporteId" = NULL
  FROM "Club" c
 WHERE c."ownerUserId" = u."id";

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Contexto en bitacora y moderacion (registro, no filtro)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Reporte"   ADD COLUMN "deporteId" TEXT;
ALTER TABLE "Auditoria" ADD COLUMN "deporteId" TEXT,
                        ADD COLUMN "deporteNombre" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Se retiran de Club los campos que ya viven en Deporte
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX "Club_inscripcionToken_key";
ALTER TABLE "Club" DROP COLUMN "inscripcionToken",
                   DROP COLUMN "inscripcionAbierta",
                   DROP COLUMN "inscripcionEsperados",
                   DROP COLUMN "inscripcionVenceAt";
