-- Gastos de la plataforma.
--
-- Lo que cuesta sostener VeloClub. Sin `clubId` a proposito: son gastos del
-- negocio, no de un club, y no se pueden sumar con el flujo de caja de nadie.
CREATE TYPE "CategoriaGasto" AS ENUM ('INFRAESTRUCTURA', 'COMISIONES', 'PUBLICIDAD', 'HERRAMIENTAS', 'OTROS');

CREATE TABLE "GastoPlataforma" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "categoria" "CategoriaGasto" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoPlataforma_pkey" PRIMARY KEY ("id")
);

-- Las consultas siempre agrupan por mes, asi que el indice va sobre la fecha.
CREATE INDEX "GastoPlataforma_fecha_idx" ON "GastoPlataforma"("fecha");
