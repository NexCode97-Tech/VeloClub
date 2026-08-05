-- CreateEnum
CREATE TYPE "TrainingScenario" AS ENUM ('PISTA', 'GIMNASIO');

-- AlterTable: los entrenamientos existentes se registraron con campos de pista
ALTER TABLE "TrainingSession" ADD COLUMN "escenario" "TrainingScenario" NOT NULL DEFAULT 'PISTA';

-- AlterTable: campos de gimnasio
ALTER TABLE "TrainingResult" ADD COLUMN "exercise" TEXT;
ALTER TABLE "TrainingResult" ADD COLUMN "weight" TEXT;
ALTER TABLE "TrainingResult" ADD COLUMN "sets" INTEGER;
ALTER TABLE "TrainingResult" ADD COLUMN "reps" INTEGER;
ALTER TABLE "TrainingResult" ADD COLUMN "mark" TEXT;
