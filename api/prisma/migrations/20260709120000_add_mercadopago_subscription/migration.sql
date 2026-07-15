-- AlterTable
ALTER TABLE "ClubSuscripcion"
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mpPreapprovalId" TEXT,
  ADD COLUMN "mpPayerEmail" TEXT,
  ADD COLUMN "ultimoMontoSincronizado" DOUBLE PRECISION,
  ADD COLUMN "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ultimoIntentoFallidoAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SuscripcionPago" ADD COLUMN "mpPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionPago_mpPaymentId_key" ON "SuscripcionPago"("mpPaymentId");
