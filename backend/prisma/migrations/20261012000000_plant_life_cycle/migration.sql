-- A plant can now die, and be planted again.
--
-- Until now health stopped at 5% and a plant neglected for a month was
-- simply "Đang héo". Kept at "héo nặng" (<= 10%) for long enough it now dies,
-- and is replanted from seed on the same kit for free. The stage also asks
-- for its care tasks, counted from when the current planting began.
ALTER TABLE "VirtualPlant"
  ADD COLUMN "wiltHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "diedAt"    TIMESTAMP(3),
  ADD COLUMN "plantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "attempt"   INTEGER NOT NULL DEFAULT 1;

-- Plants already growing began when they were activated, so the care already
-- given in their current stage counts towards its tasks.
UPDATE "VirtualPlant" SET "plantedAt" = "activatedAt";

-- What VIP's gardener does is logged beside the child's care, marked so it
-- neither counts as theirs nor puts their tools on cooldown.
ALTER TABLE "PlantCareLog" ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;

-- The automatic pump is gone: with VIP's gardener keeping a plant alive it
-- only duplicated that. Its rows go; the enum value stays, unused.
DELETE FROM "PlantDevice" WHERE "type" = 'water_pump';
UPDATE "Product"
   SET "includes" = array_replace("includes", 'Mở dần 8 thiết bị IoT ảo', 'Mở dần 7 thiết bị IoT ảo')
 WHERE 'Mở dần 8 thiết bị IoT ảo' = ANY("includes");
