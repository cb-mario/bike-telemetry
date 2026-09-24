-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "maxSpeedKmh" REAL;
ALTER TABLE "Activity" ADD COLUMN "sportType" TEXT;
ALTER TABLE "Activity" ADD COLUMN "stravaId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "summaryPolyline" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "stravaAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "stravaAthleteId" TEXT;
ALTER TABLE "User" ADD COLUMN "stravaLastSyncAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "stravaRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "stravaTokenExpiresAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_stravaId_key" ON "Activity"("stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stravaAthleteId_key" ON "User"("stravaAthleteId");

