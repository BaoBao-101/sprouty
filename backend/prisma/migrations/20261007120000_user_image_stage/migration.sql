-- The memory album is a record of the plant's journey, not a loose pile of
-- photos: each one is tagged with the growth stage it was taken at, so the
-- album groups into "Hạt giống", "Mầm", "Phình củ" and so on — and because
-- stage names differ per species, a carrot's album reads differently from a
-- tomato's without any extra data.
--
-- Nullable: rows that predate this, and photos saved against a product whose
-- owner never activated a plant, have no stage to record.
ALTER TABLE "UserProductImage" ADD COLUMN "stage" "PlantStage";

-- Backfill what can be known. A photo taken before its plant existed cannot be
-- placed, so only rows uploaded after activation are given the plant's current
-- stage — an approximation, but a better one than nothing for an album that is
-- about to be grouped by it.
UPDATE "UserProductImage" i
SET "stage" = p."stage"
FROM "VirtualPlant" p
WHERE p."userId" = i."userId"
  AND p."productId" = i."productId"
  AND i."createdAt" >= p."activatedAt";
