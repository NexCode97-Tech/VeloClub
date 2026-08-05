-- Pausa temporal de deportistas (vacaciones de fin de ano).
-- Los miembros que ya existen quedan activos.
ALTER TABLE "Member" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Member" ADD COLUMN "desactivadoAt" TIMESTAMP(3);

CREATE INDEX "Member_clubId_active_idx" ON "Member"("clubId", "active");

-- Tope de deportistas activos del ciclo, para que desactivar en masa la vispera
-- del cobro no baje el precio de ese mismo ciclo.
ALTER TABLE "ClubSuscripcion" ADD COLUMN "picoDeportistas" INTEGER;
