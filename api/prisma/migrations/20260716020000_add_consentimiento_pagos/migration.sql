-- Consentimientos legales de pago (Ley 1480 de 2011 — Estatuto del Consumidor)
ALTER TABLE "ClubSuscripcion" ADD COLUMN "consentimientoPagoAt" TIMESTAMP(3);
ALTER TABLE "ClubSuscripcion" ADD COLUMN "consentimientoRecurrenteAt" TIMESTAMP(3);
