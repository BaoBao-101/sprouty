ALTER TABLE "Session"
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Session"
SET "expiresAt" = LEAST("expiresAt", CURRENT_TIMESTAMP + INTERVAL '12 hours');

CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");
