-- AddColumn monthlyFee to Member
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "monthlyFee" DOUBLE PRECISION;
