-- Plata que entro sin pasar por la pasarela: el saldo que un club paga por
-- Bre-B, una consultoria, lo que sea. Vive aparte de SuscripcionPago porque ese
-- modelo manda la vigencia de un club, y estos movimientos no la mueven.
CREATE TABLE "IngresoPlataforma" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "clubNombre" TEXT,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngresoPlataforma_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IngresoPlataforma_fecha_idx" ON "IngresoPlataforma"("fecha");
