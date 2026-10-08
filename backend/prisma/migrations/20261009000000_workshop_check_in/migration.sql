-- Attendance, which paying never recorded.
--
-- A booking paid for three weeks ago says nothing about whether the child
-- walked through the door on the day. Staff had nowhere to write that down,
-- and the parent had no ticket to be checked against.
ALTER TABLE "WorkshopRegistration"
  ADD COLUMN "checkedInAt"       TIMESTAMP(3),
  ADD COLUMN "checkedInByUserId" TEXT,
  ADD COLUMN "attendedCount"     INTEGER;

ALTER TABLE "WorkshopRegistration"
  ADD CONSTRAINT "WorkshopRegistration_checkedInByUserId_fkey"
  FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The register for one session, in check-in order.
CREATE INDEX "WorkshopRegistration_workshopId_checkedInAt_idx"
  ON "WorkshopRegistration"("workshopId", "checkedInAt");
