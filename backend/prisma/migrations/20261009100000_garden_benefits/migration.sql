CREATE TABLE "AiDailyUsage" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "day" TEXT NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("userId", "day")
);
CREATE TABLE "GardenPreference" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "scene" TEXT NOT NULL DEFAULT 'natural',
  "decoration" TEXT NOT NULL DEFAULT 'plain'
);
