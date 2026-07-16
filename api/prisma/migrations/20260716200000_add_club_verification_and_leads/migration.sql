-- CreateEnum
CREATE TYPE "ClubVerification" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED');

-- AlterTable
ALTER TABLE "Club"
  ADD COLUMN "verificationStatus" "ClubVerification" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "nameFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "memberCountApprox" INTEGER,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Backfill: los clubes existentes ya son legítimos → quedan verificados
UPDATE "Club" SET "verificationStatus" = 'VERIFIED', "verified" = true;

-- CreateTable
CREATE TABLE "ClubLead" (
    "id" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "deporte" TEXT,
    "city" TEXT,
    "department" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "memberCountApprox" INTEGER,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubLead_pkey" PRIMARY KEY ("id")
);
