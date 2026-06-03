-- Agrega comprobante de pago a SuscripcionPago
ALTER TABLE "SuscripcionPago" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "SuscripcionPago" ADD COLUMN IF NOT EXISTS "receiptPublicId" TEXT;
