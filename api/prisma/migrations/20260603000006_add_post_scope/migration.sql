-- CreateEnum
CREATE TYPE "PostScope" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "scope" "PostScope" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Post" ADD COLUMN "clubName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Post_scope_createdAt_idx" ON "Post"("scope", "createdAt");
