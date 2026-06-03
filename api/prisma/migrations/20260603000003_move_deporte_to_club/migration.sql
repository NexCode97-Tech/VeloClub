-- Quita deporte de Member (si existía) y lo agrega a Club
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "deporte" TEXT;
ALTER TABLE "Member" DROP COLUMN IF EXISTS "deporte";
