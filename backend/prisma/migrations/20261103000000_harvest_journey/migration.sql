-- After the harvest: plants that crop again, the certificate of each picking,
-- seeds kept for a new season, and a free workshop seat for the collection.

-- A free seat for harvesting every species the shop sells.
ALTER TYPE "RewardType" ADD VALUE 'species_collection';

ALTER TABLE "VirtualPlant"
  ADD COLUMN "harvestCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "season" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "seedsSownAt" TIMESTAMP(3);

CREATE TABLE "PlantHarvest" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "avgHealth" DOUBLE PRECISION NOT NULL,
    "careCount" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "speciesKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantHarvest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlantHarvest_plantId_number_key" ON "PlantHarvest"("plantId", "number");
CREATE INDEX "PlantHarvest_userId_idx" ON "PlantHarvest"("userId");

ALTER TABLE "PlantHarvest" ADD CONSTRAINT "PlantHarvest_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantHarvest" ADD CONSTRAINT "PlantHarvest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plants harvested before this existed: one picking each, so they keep their
-- certificate and count towards the collection. Their stars come from the
-- health they were harvested at, the one figure still on record.
UPDATE "VirtualPlant" SET "harvestCount" = 1 WHERE "harvestedAt" IS NOT NULL;

INSERT INTO "PlantHarvest" ("id", "plantId", "userId", "number", "stars", "avgHealth", "careCount", "streak", "days", "speciesKey", "createdAt")
SELECT
  'h' || md5(p."id" || '-1'),
  p."id",
  p."userId",
  1,
  CASE WHEN p."health" >= 80 THEN 3 WHEN p."health" >= 60 THEN 2 ELSE 1 END,
  p."health",
  (SELECT COUNT(*) FROM "PlantCareLog" l WHERE l."plantId" = p."id" AND l."auto" = false),
  p."careStreak",
  GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p."harvestedAt" - p."activatedAt")) / 86400))::INTEGER,
  -- As plant-sim's speciesFor: the chosen species, else the old product names.
  COALESCE(pr."speciesKey", CASE pr."name"
    WHEN 'Bean' THEN 'bean' WHEN 'Đậu Leo Xanh' THEN 'bean'
    WHEN 'Carrot' THEN 'carrot' WHEN 'Cà Rốt Cam' THEN 'carrot'
    WHEN 'Corn' THEN 'corn' WHEN 'Bắp Ngô Vàng' THEN 'corn'
    WHEN 'FirePepper' THEN 'pepper' WHEN 'Ớt Lửa' THEN 'pepper'
    WHEN 'SunFlower' THEN 'sunflower' WHEN 'Hướng Dương' THEN 'sunflower'
    WHEN 'Tomato' THEN 'tomato' WHEN 'Cà Chua Đỏ' THEN 'tomato'
    ELSE 'generic' END),
  p."harvestedAt"
FROM "VirtualPlant" p
JOIN "Product" pr ON pr."id" = p."productId"
WHERE p."harvestedAt" IS NOT NULL;
