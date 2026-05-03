-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "time" TEXT,
    "distance" TEXT,
    "laps" INTEGER,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSession_clubId_idx" ON "TrainingSession"("clubId");

-- CreateIndex
CREATE INDEX "TrainingSession_clubId_date_idx" ON "TrainingSession"("clubId", "date");

-- CreateIndex
CREATE INDEX "TrainingResult_memberId_idx" ON "TrainingResult"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingResult_sessionId_memberId_key" ON "TrainingResult"("sessionId", "memberId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
