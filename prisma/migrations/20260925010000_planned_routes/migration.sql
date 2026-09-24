-- CreateTable
CREATE TABLE "PlannedRoute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "routing" TEXT NOT NULL,
    "waypoints" TEXT NOT NULL,
    "geometry" TEXT NOT NULL,
    "distanceKm" REAL NOT NULL,
    "elevationGain" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannedRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlannedRoute_userId_updatedAt_idx" ON "PlannedRoute"("userId", "updatedAt");

