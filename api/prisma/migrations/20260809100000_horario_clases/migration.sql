-- Horario de clases del club, y asistencia colgada de una clase.
--
-- El bug que esto arregla: Attendance tenia UNIQUE (memberId, date), o sea una
-- asistencia por deportista por dia, con la sede como simple etiqueta. Marcar
-- en la segunda sede encontraba la fila de la primera y la sobrescribia.

CREATE TABLE "ClaseHorario" (
  "id"         TEXT NOT NULL,
  "clubId"     TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "nombre"     TEXT NOT NULL,
  -- 0 = domingo … 6 = sabado, igual que Club."noAttendanceDays"
  "diaSemana"  INTEGER NOT NULL,
  -- "HH:mm" en 24h. Es una hora de reloj que se repite cada semana, no un
  -- instante: guardarla como timestamp arrastra husos horarios sin necesidad.
  "hora"       TEXT NOT NULL,
  "categoria"  TEXT,
  "activa"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClaseHorario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClaseHorario_clubId_diaSemana_activa_idx"
  ON "ClaseHorario"("clubId", "diaSemana", "activa");

ALTER TABLE "ClaseHorario"
  ADD CONSTRAINT "ClaseHorario_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClaseHorario"
  ADD CONSTRAINT "ClaseHorario_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La asistencia pasa a poder colgar de una clase. Queda en NULL para todo lo
-- ya registrado, que es la verdad: se tomo cuando no existia el horario.
ALTER TABLE "Attendance" ADD COLUMN "claseId" TEXT;

-- SET NULL y no CASCADE: si una clase llegara a borrarse de verdad, su
-- historial de asistencia se conserva. Borrar el horario no borra el pasado.
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_claseId_fkey"
  FOREIGN KEY ("claseId") REFERENCES "ClaseHorario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Attendance_claseId_date_idx" ON "Attendance"("claseId", "date");

-- ─── La unicidad ─────────────────────────────────────────────────────────────
--
-- Dos indices parciales en vez de uno compuesto. Un UNIQUE (memberId, date,
-- claseId) a secas NO sirve: en Postgres dos NULL nunca son iguales, asi que
-- todas las filas sin clase —las viejas y las de cualquier club que no arme
-- horario— quedarian sin proteccion y se podrian duplicar. Justo el bug que
-- estamos cerrando, entrando por otra puerta.

DROP INDEX IF EXISTS "Attendance_memberId_date_key";

-- Sin clase: sigue mandando una por deportista por dia, como hasta hoy.
CREATE UNIQUE INDEX "Attendance_sin_clase_key"
  ON "Attendance"("memberId", "date")
  WHERE "claseId" IS NULL;

-- Con clase: una por deportista por dia POR CLASE. Manana y tarde conviven.
CREATE UNIQUE INDEX "Attendance_por_clase_key"
  ON "Attendance"("memberId", "date", "claseId")
  WHERE "claseId" IS NOT NULL;
