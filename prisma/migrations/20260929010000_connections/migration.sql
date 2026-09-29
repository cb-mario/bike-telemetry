-- Conexiones con servicios externos en su propia tabla (antes, columnas strava* en "User")
-- y registro de qué salida externa corresponde a cada actividad (antes, "Activity"."stravaId").
-- Se crean las tablas, se copian los datos y después se borran las columnas antiguas

-- CreateTable
CREATE TABLE "Connection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "account" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityImport" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_userId_provider_key" ON "Connection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_provider_account_key" ON "Connection"("provider", "account");

-- CreateIndex
CREATE INDEX "ActivityImport_activityId_idx" ON "ActivityImport"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityImport_provider_externalId_key" ON "ActivityImport"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityImport" ADD CONSTRAINT "ActivityImport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia de datos: cuentas de Strava conectadas y salidas ya importadas
INSERT INTO "Connection" ("userId", "provider", "account", "accessToken", "refreshToken", "tokenExpiresAt", "lastSyncAt", "updatedAt")
SELECT "id", 'strava', "stravaAthleteId", "stravaAccessToken", "stravaRefreshToken", "stravaTokenExpiresAt", "stravaLastSyncAt", CURRENT_TIMESTAMP
FROM "User"
WHERE "stravaAthleteId" IS NOT NULL;

INSERT INTO "ActivityImport" ("activityId", "provider", "externalId")
SELECT "id", 'strava', "stravaId"
FROM "Activity"
WHERE "stravaId" IS NOT NULL;

-- DropIndex
DROP INDEX "User_stravaAthleteId_key";

-- DropIndex
DROP INDEX "Activity_stravaId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stravaAccessToken",
DROP COLUMN "stravaAthleteId",
DROP COLUMN "stravaLastSyncAt",
DROP COLUMN "stravaRefreshToken",
DROP COLUMN "stravaTokenExpiresAt";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "stravaId";
