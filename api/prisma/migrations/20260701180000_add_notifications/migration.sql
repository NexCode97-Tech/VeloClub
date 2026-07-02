-- Notificaciones dirigidas a usuarios del club (staff o deportistas)
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientClerkId" TEXT NOT NULL,
    "clubId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "link" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_recipientClerkId_leida_createdAt_idx"
    ON "Notification"("recipientClerkId", "leida", "createdAt");
