-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "passwordHash" TEXT,
    "maxHr" INTEGER,
    "name" TEXT,
    "birthDate" DATETIME,
    "sex" TEXT,
    "heightCm" INTEGER,
    "weightKg" REAL,
    "restingHr" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stravaAthleteId" TEXT,
    "stravaAccessToken" TEXT,
    "stravaRefreshToken" TEXT,
    "stravaTokenExpiresAt" DATETIME,
    "stravaLastSyncAt" DATETIME
);
INSERT INTO "new_User" ("birthDate", "createdAt", "email", "heightCm", "id", "maxHr", "name", "passwordHash", "restingHr", "sex", "stravaAccessToken", "stravaAthleteId", "stravaLastSyncAt", "stravaRefreshToken", "stravaTokenExpiresAt", "weightKg") SELECT "birthDate", "createdAt", "email", "heightCm", "id", "maxHr", "name", "passwordHash", "restingHr", "sex", "stravaAccessToken", "stravaAthleteId", "stravaLastSyncAt", "stravaRefreshToken", "stravaTokenExpiresAt", "weightKg" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stravaAthleteId_key" ON "User"("stravaAthleteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
