-- Reportes de contenido de la comunidad.
--
-- Los Terminos reservan el derecho de eliminar contenido que los incumpla
-- "previa solicitud o de oficio". Esta tabla es la solicitud.
--
-- No hay clave foranea contra Post ni contra PostComment a proposito: el
-- reporte debe sobrevivir al contenido para dejar constancia de que se
-- atendio, y una cascada lo borraria justo cuando se resuelve.

CREATE TYPE "MotivoReporte" AS ENUM (
  'SPAM', 'ACOSO', 'ODIO', 'CONTENIDO_SEXUAL', 'VIOLENCIA',
  'SUPLANTACION', 'DERECHOS_AUTOR', 'OTRO'
);

CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'ELIMINADO', 'DESESTIMADO');

CREATE TABLE "Reporte" (
  "id"              TEXT NOT NULL,
  "postId"          TEXT NOT NULL,
  "commentId"       TEXT,
  "reporterClerkId" TEXT NOT NULL,
  "reporterName"    TEXT NOT NULL,
  "clubId"          TEXT,
  "motivo"          "MotivoReporte" NOT NULL,
  "detalle"         TEXT,
  "estado"          "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
  "contenidoCopia"  TEXT NOT NULL DEFAULT '',
  "autorClerkId"    TEXT,
  "autorNombre"     TEXT NOT NULL DEFAULT '',
  "resueltoPor"     TEXT,
  "resueltoEn"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- Nadie reporta dos veces lo mismo: inflaba la cola sin aportar nada.
CREATE UNIQUE INDEX "Reporte_reporterClerkId_postId_commentId_key"
  ON "Reporte"("reporterClerkId", "postId", "commentId");

CREATE INDEX "Reporte_estado_createdAt_idx" ON "Reporte"("estado", "createdAt");
