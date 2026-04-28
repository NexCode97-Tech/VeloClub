/*
  Warnings:

  - You are about to drop the column `inviteEmail` on the `Member` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "inviteEmail";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileComplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "clubId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");
