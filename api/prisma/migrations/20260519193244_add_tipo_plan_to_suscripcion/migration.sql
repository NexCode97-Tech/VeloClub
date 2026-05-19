-- CreateEnum
CREATE TYPE "TipoPlan" AS ENUM ('MENSUAL', 'ANUAL');

-- AlterTable
ALTER TABLE "ClubSuscripcion" ADD COLUMN     "tipoPlan" "TipoPlan" NOT NULL DEFAULT 'MENSUAL';
