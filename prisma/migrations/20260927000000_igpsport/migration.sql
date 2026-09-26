-- AlterTable
ALTER TABLE "User" ADD COLUMN     "igpsportAccount" TEXT,
ADD COLUMN     "igpsportAccessToken" TEXT,
ADD COLUMN     "igpsportTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "igpsportLastSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "igpsportId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_igpsportId_key" ON "Activity"("igpsportId");
