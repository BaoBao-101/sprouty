-- A finished plant is no longer simulated (plants.js advance), but the ones
-- harvested before that kept ticking: their soil dried out and they read as
-- "héo nặng" on the shelf. They rest as harvested: watered, fed and well.
UPDATE "VirtualPlant"
SET "moisture" = 60,
    "nutrient" = 60,
    "health" = GREATEST("health", 90),
    "pestRisk" = 5,
    "wiltHours" = 0
WHERE "harvestedAt" IS NOT NULL;
