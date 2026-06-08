-- AlterTable: agregar coverUrl y coverPublicId al modelo User
ALTER TABLE "User" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "coverPublicId" TEXT;
