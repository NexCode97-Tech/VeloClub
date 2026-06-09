ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "coverPublicId" TEXT;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "Follow" (
  "id" TEXT NOT NULL,
  "followerClerkId" TEXT NOT NULL,
  "followingClerkId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerClerkId_followingClerkId_key" ON "Follow"("followerClerkId", "followingClerkId");
CREATE INDEX IF NOT EXISTS "Follow_followerClerkId_idx" ON "Follow"("followerClerkId");
CREATE INDEX IF NOT EXISTS "Follow_followingClerkId_idx" ON "Follow"("followingClerkId");
