-- CreateEnum
CREATE TYPE "NotificacionTipo" AS ENUM ('CLUB_CREADO', 'CLUB_DESACTIVADO', 'PAGO_VENCIDO', 'PAGO_REGISTRADO');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "tipo" "NotificacionTipo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);
