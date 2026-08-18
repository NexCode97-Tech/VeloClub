-- Bitacora de acciones irreversibles.
--
-- Se borraron cinco clubes y no quedo forma de saber quien, cuando ni con que:
-- el endpoint borraba, respondia ok y no escribia nada. Esta tabla es para que
-- eso no vuelva a pasar.
--
-- `datos` guarda una copia de lo eliminado. Sin ella el registro contaria que
-- algo se perdio pero no permitiria recuperarlo, que es justo lo que hizo falta.

CREATE TABLE "Auditoria" (
  "id"           TEXT NOT NULL,
  "accion"       TEXT NOT NULL,
  "entidad"      TEXT NOT NULL,
  "entidadId"    TEXT,
  "resumen"      TEXT NOT NULL,
  -- Nombre y correo del actor se copian, no se referencian: si esa cuenta se
  -- borra despues, el registro tiene que seguir diciendo quien fue.
  "actorClerkId" TEXT,
  "actorEmail"   TEXT,
  "actorNombre"  TEXT,
  "actorRol"     TEXT,
  "clubId"       TEXT,
  "clubNombre"   TEXT,
  "datos"        JSONB,
  "ip"           TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- Sin claves foraneas a proposito: el registro debe sobrevivir al borrado de
-- todo lo que menciona. Una cascada lo destruiria justo cuando importa.
CREATE INDEX "Auditoria_createdAt_idx"         ON "Auditoria"("createdAt");
CREATE INDEX "Auditoria_accion_createdAt_idx"  ON "Auditoria"("accion", "createdAt");
CREATE INDEX "Auditoria_clubId_createdAt_idx"  ON "Auditoria"("clubId", "createdAt");
