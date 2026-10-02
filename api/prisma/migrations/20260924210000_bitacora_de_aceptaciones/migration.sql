-- La bitacora de aceptaciones legales.
--
-- El campo User.termsAcceptedAt es uno solo y se sobrescribe, asi que no sirve
-- como prueba: al cambiar el documento la aceptacion anterior desaparece. Esta
-- tabla solo crece y es lo que se ensena cuando alguien pregunta.
--
-- El titular va copiado en texto y sin llave foranea a proposito. Una relacion
-- con borrado en cascada se llevaria la evidencia el dia que se borre la
-- cuenta, que es justo el dia en que hace falta.

CREATE TYPE "OrigenAceptacion" AS ENUM ('COMPUERTA', 'INSCRIPCION');

CREATE TABLE "AceptacionLegal" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT,
    "titularNombre"     TEXT NOT NULL,
    "titularEmail"      TEXT NOT NULL,
    "clubId"            TEXT,
    "clubNombre"        TEXT,
    "aceptoTerminos"    BOOLEAN NOT NULL,
    "autorizoDatos"     BOOLEAN NOT NULL,
    "version"           TEXT NOT NULL,
    "porMenor"          BOOLEAN NOT NULL DEFAULT false,
    "autorizanteNombre" TEXT,
    "autorizanteDoc"    TEXT,
    "ip"                TEXT,
    "navegador"         TEXT,
    "origen"            "OrigenAceptacion" NOT NULL,
    "creadoEn"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceptacionLegal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AceptacionLegal_userId_idx"   ON "AceptacionLegal"("userId");
CREATE INDEX "AceptacionLegal_clubId_idx"   ON "AceptacionLegal"("clubId");
CREATE INDEX "AceptacionLegal_creadoEn_idx" ON "AceptacionLegal"("creadoEn");

-- Que version acepto cada quien. Sin esto, cambiar el texto no vuelve a
-- preguntarle a nadie y la aceptacion vieja queda amparando un documento que ya
-- no existe.
ALTER TABLE "User" ADD COLUMN "terminosVersion" TEXT;
