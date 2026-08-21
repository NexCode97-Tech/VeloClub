-- Inscripcion por enlace: cada club comparte un formulario publico y las
-- familias llenan sus propios datos, en vez de que alguien arme un Excel.

-- ── De donde vino cada miembro y si ya lo revisaron ─────────────────────────
CREATE TYPE "OrigenMiembro" AS ENUM ('MANUAL', 'EXCEL', 'FORMULARIO');
CREATE TYPE "EstadoInscripcion" AS ENUM ('PENDIENTE', 'APROBADO');

-- Los dos default importan: todo lo que ya existe queda MANUAL y APROBADO. Sin
-- eso, la migracion dejaria a los 1.551 miembros actuales esperando aprobacion
-- y fuera de la app.
ALTER TABLE "Member" ADD COLUMN "origen"      "OrigenMiembro"     NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Member" ADD COLUMN "inscripcion" "EstadoInscripcion" NOT NULL DEFAULT 'APROBADO';
ALTER TABLE "Member" ADD COLUMN "aprobadoAt"  TIMESTAMP(3);

-- ── Acudiente del menor de edad ─────────────────────────────────────────────
-- No se crea tabla aparte ni se tocan emergencyContact y emergencyPhone: esos
-- ya guardan a quien responde por el deportista y estan poblados. Se agregan
-- solo los dos datos que faltaban.
ALTER TABLE "Member" ADD COLUMN "guardianRelation"  TEXT;
ALTER TABLE "Member" ADD COLUMN "guardianDocNumber" TEXT;

-- ── El enlace del club ──────────────────────────────────────────────────────
-- El token es aleatorio y no derivado del nombre: con una url adivinable,
-- cualquiera encontraria el formulario de cualquier club probando nombres.
ALTER TABLE "Club" ADD COLUMN "inscripcionToken"     TEXT;
ALTER TABLE "Club" ADD COLUMN "inscripcionAbierta"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Club" ADD COLUMN "inscripcionEsperados" INTEGER;

CREATE UNIQUE INDEX "Club_inscripcionToken_key" ON "Club"("inscripcionToken");

-- ── Indices de consulta ─────────────────────────────────────────────────────
-- La bandeja de pendientes y el aviso de documento repetido corren seguido y
-- siempre acotados al club.
CREATE INDEX "Member_clubId_inscripcion_idx" ON "Member"("clubId", "inscripcion");
CREATE INDEX "Member_clubId_docNumber_idx"   ON "Member"("clubId", "docNumber");

-- Correo y documento unicos por club: NO se imponen todavia.
--
-- Hay duplicados heredados de la plantilla de Excel, y un indice unico sobre
-- esas columnas falla al crearse y deja la migracion a medias en produccion.
-- Mientras tanto la unicidad la sostiene la aplicacion, que revisa antes de
-- crear y avisa mientras se escribe. El dia que los duplicados esten resueltos,
-- la garantia de verdad son estas dos lineas:
--
--   CREATE UNIQUE INDEX "Member_club_email_key"
--     ON "Member"("clubId", lower("email")) WHERE "email" IS NOT NULL AND "email" <> '';
--   CREATE UNIQUE INDEX "Member_club_doc_key"
--     ON "Member"("clubId", "docNumber") WHERE "docNumber" IS NOT NULL AND "docNumber" <> '';
--
-- Van parciales porque los registros sin correo ni documento quedan en NULL, y
-- en Postgres dos NULL nunca chocan entre si.
