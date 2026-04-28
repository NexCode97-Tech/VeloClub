-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "pictureUrl" TEXT,
    "picturePublicId" TEXT,
    "docNumber" TEXT,
    "docFileUrl" TEXT,
    "docFilePublicId" TEXT,
    "insuranceFileUrl" TEXT,
    "insurancePublicId" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "category" TEXT,
    "inviteEmail" TEXT,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "clerkId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLocation" (
    "memberId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "MemberLocation_pkey" PRIMARY KEY ("memberId","locationId")
);

-- CreateIndex
CREATE INDEX "Location_clubId_idx" ON "Location"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_clerkId_key" ON "Member"("clerkId");

-- CreateIndex
CREATE INDEX "Member_clubId_idx" ON "Member"("clubId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocation" ADD CONSTRAINT "MemberLocation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLocation" ADD CONSTRAINT "MemberLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
