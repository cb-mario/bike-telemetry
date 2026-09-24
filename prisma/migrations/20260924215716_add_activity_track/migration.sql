-- CreateTable
CREATE TABLE "ActivityTrack" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "activityId" INTEGER NOT NULL,
    "points" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "pointCount" INTEGER NOT NULL,
    "minLat" REAL NOT NULL,
    "maxLat" REAL NOT NULL,
    "minLon" REAL NOT NULL,
    "maxLon" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityTrack_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "distanceKm" REAL NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "elevationGain" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("avgHr", "createdAt", "date", "distanceKm", "durationMin", "elevationGain", "id", "maxHr", "notes", "title", "userId") SELECT "avgHr", "createdAt", "date", "distanceKm", "durationMin", "elevationGain", "id", "maxHr", "notes", "title", "userId" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_userId_date_idx" ON "Activity"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTrack_activityId_key" ON "ActivityTrack"("activityId");
