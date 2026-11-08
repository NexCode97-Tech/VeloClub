-- Whop: medio guardado y fecha del próximo cobro automático
ALTER TABLE "ClubSuscripcion" ADD COLUMN "whopMemberId" TEXT;
ALTER TABLE "ClubSuscripcion" ADD COLUMN "whopPaymentMethodId" TEXT;
ALTER TABLE "ClubSuscripcion" ADD COLUMN "proximoCobroAt" TIMESTAMP(3);
CREATE INDEX "ClubSuscripcion_proximoCobroAt_idx" ON "ClubSuscripcion"("proximoCobroAt");

-- Whop: id del pago y medio con que se pagó
ALTER TABLE "SuscripcionPago" ADD COLUMN "whopPaymentId" TEXT;
ALTER TABLE "SuscripcionPago" ADD COLUMN "medio" TEXT;
CREATE UNIQUE INDEX "SuscripcionPago_whopPaymentId_key" ON "SuscripcionPago"("whopPaymentId");
