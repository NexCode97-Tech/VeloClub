-- Notificaciones push: los dispositivos de cada persona y la marca de los recordatorios enviados.
CREATE TABLE "PushDispositivo" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDispositivo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushDispositivo_endpoint_key" ON "PushDispositivo"("endpoint");
CREATE INDEX "PushDispositivo_clerkId_idx" ON "PushDispositivo"("clerkId");

CREATE TABLE "RecordatorioEnviado" (
    "clave" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordatorioEnviado_pkey" PRIMARY KEY ("clave")
);
CREATE INDEX "RecordatorioEnviado_createdAt_idx" ON "RecordatorioEnviado"("createdAt");
