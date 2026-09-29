-- The public workshop page rendered a hardcoded list carrying a description,
-- photo, age range and price. None of it existed on Workshop, so a session
-- created in the admin could never look like the ones shown to customers.
-- These columns close that gap, and the registration form's age / headcount /
-- note fields — collected and then thrown away — finally have somewhere to go.

CREATE TYPE "WorkshopStatus" AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE "WorkshopRegistrationStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

ALTER TABLE "Workshop"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "emoji"       TEXT,
  ADD COLUMN "imageUrl"    TEXT,
  ADD COLUMN "endTime"     TIMESTAMP(3),
  ADD COLUMN "ageRange"    TEXT,
  ADD COLUMN "price"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status"      "WorkshopStatus" NOT NULL DEFAULT 'published',
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WorkshopRegistration"
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "childAge"   TEXT,
  ADD COLUMN "childCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "note"       TEXT,
  ADD COLUMN "status"     "WorkshopRegistrationStatus" NOT NULL DEFAULT 'pending';

-- Deleting a workshop should take its registrations with it; the route refuses
-- to delete one that still has any, so this only fires for empty sessions.
ALTER TABLE "WorkshopRegistration" DROP CONSTRAINT "WorkshopRegistration_workshopId_fkey";
ALTER TABLE "WorkshopRegistration"
  ADD CONSTRAINT "WorkshopRegistration_workshopId_fkey"
  FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Workshop_status_dateTime_idx" ON "Workshop"("status", "dateTime");
CREATE INDEX "WorkshopRegistration_workshopId_status_idx" ON "WorkshopRegistration"("workshopId", "status");
