-- Sprouty no longer ships a physical kit. Buying one now unlocks a simulated
-- plant that lives on the site: activated with the code the order issued, then
-- raised from seed to harvest through care actions on a cooldown, with
-- simulated IoT sensors reporting soil and air.
--
-- No scheduler advances any of this. Every metric below is a function of the
-- time elapsed since "lastTickAt", recomputed on read (services/plant-sim.js).

CREATE TYPE "PlantStage" AS ENUM (
  'seed', 'sprout', 'seedling', 'vegetative', 'budding', 'flowering', 'fruiting', 'mature'
);

CREATE TYPE "PlantCareAction" AS ENUM (
  'water', 'mist', 'fertilize', 'prune', 'pest_check', 'sunlight', 'loosen_soil', 'pollinate', 'harvest'
);

CREATE TYPE "PlantDeviceType" AS ENUM (
  'moisture_sensor', 'thermo_sensor', 'light_sensor', 'nutrient_sensor',
  'water_pump', 'grow_light', 'fan', 'camera'
);

CREATE TABLE "VirtualPlant" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "productId"     INTEGER NOT NULL,
  "nickname"      TEXT NOT NULL,
  "stage"         "PlantStage" NOT NULL DEFAULT 'seed',
  -- Float: a tick adds fractions of a percent, and rounding each one down
  -- would stall growth entirely.
  "stageProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "growthPoints"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "moisture"      DOUBLE PRECISION NOT NULL DEFAULT 45,
  "nutrient"      DOUBLE PRECISION NOT NULL DEFAULT 60,
  "health"        DOUBLE PRECISION NOT NULL DEFAULT 85,
  "pestRisk"      DOUBLE PRECISION NOT NULL DEFAULT 5,
  "careStreak"    INTEGER NOT NULL DEFAULT 0,
  "lastCareDate"  TEXT,
  "lastTickAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "harvestedAt"   TIMESTAMP(3),
  "activatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VirtualPlant_pkey" PRIMARY KEY ("id")
);

-- One plant per kit per account: the activation code is single-use and
-- per-product, so a second row could only come from a double-submit.
CREATE UNIQUE INDEX "VirtualPlant_userId_productId_key" ON "VirtualPlant"("userId", "productId");
CREATE INDEX "VirtualPlant_userId_idx" ON "VirtualPlant"("userId");

CREATE TABLE "PlantDevice" (
  "id"       TEXT NOT NULL,
  "plantId"  TEXT NOT NULL,
  "type"     "PlantDeviceType" NOT NULL,
  "unlocked" BOOLEAN NOT NULL DEFAULT false,
  "autoMode" BOOLEAN NOT NULL DEFAULT false,
  "battery"  DOUBLE PRECISION NOT NULL DEFAULT 100,

  CONSTRAINT "PlantDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlantDevice_plantId_type_key" ON "PlantDevice"("plantId", "type");

CREATE TABLE "PlantCareLog" (
  "id"        TEXT NOT NULL,
  "plantId"   TEXT NOT NULL,
  "action"    "PlantCareAction" NOT NULL,
  "stage"     "PlantStage" NOT NULL,
  "growth"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "detail"    JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlantCareLog_pkey" PRIMARY KEY ("id")
);

-- An action's cooldown is derived from the newest row for it, so there is no
-- per-action timestamp column that could disagree with this log.
CREATE INDEX "PlantCareLog_plantId_action_createdAt_idx" ON "PlantCareLog"("plantId", "action", "createdAt");
CREATE INDEX "PlantCareLog_plantId_createdAt_idx" ON "PlantCareLog"("plantId", "createdAt");

CREATE TABLE "PlantSensorReading" (
  "id"          TEXT NOT NULL,
  "plantId"     TEXT NOT NULL,
  "moisture"    DOUBLE PRECISION NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL,
  "humidity"    DOUBLE PRECISION NOT NULL,
  "light"       DOUBLE PRECISION NOT NULL,
  "nutrient"    DOUBLE PRECISION NOT NULL,
  "health"      DOUBLE PRECISION NOT NULL,
  "recordedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlantSensorReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlantSensorReading_plantId_recordedAt_idx" ON "PlantSensorReading"("plantId", "recordedAt");

-- "Buy 3 planting products, get a workshop of your choice free." Earned
-- rewards are rows, not a computed count: a claimed one has to stay claimed
-- after the customer buys more, and staff need to see which booking a free
-- seat was spent on.

CREATE TYPE "RewardType" AS ENUM ('free_workshop');
CREATE TYPE "RewardStatus" AS ENUM ('available', 'claimed');

CREATE TABLE "Reward" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "type"                  "RewardType" NOT NULL DEFAULT 'free_workshop',
  "status"                "RewardStatus" NOT NULL DEFAULT 'available',
  "milestone"             INTEGER NOT NULL,
  "claimedRegistrationId" TEXT,
  "claimedAt"             TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- What makes earning idempotent: syncing after a payment can only insert the
-- milestones that are missing.
CREATE UNIQUE INDEX "Reward_userId_type_milestone_key" ON "Reward"("userId", "type", "milestone");
CREATE INDEX "Reward_userId_status_idx" ON "Reward"("userId", "status");

ALTER TABLE "VirtualPlant" ADD CONSTRAINT "VirtualPlant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VirtualPlant" ADD CONSTRAINT "VirtualPlant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantDevice" ADD CONSTRAINT "PlantDevice_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantCareLog" ADD CONSTRAINT "PlantCareLog_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantSensorReading" ADD CONSTRAINT "PlantSensorReading_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
