-- Plant Buddy keeps what was said.
--
-- Each ask used to replace the last answer on screen and was sent to the model
-- on its own, so the conversation existed nowhere: a child could not look back
-- at what they had been told, and asking "tại sao?" got an answer to nothing
-- because the model had not been given the question it followed.
--
-- Server-side rather than in the browser, because a garden opened on the family
-- tablet and then on a phone is the same garden.
CREATE TABLE "PlantCoachMessage" (
  "id"        TEXT NOT NULL,
  "plantId"   TEXT NOT NULL,
  -- 'user' or 'assistant', matching the roles the AI providers expect, so the
  -- history can be replayed into a request without translation.
  "role"      TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlantCoachMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlantCoachMessage_plantId_createdAt_idx"
  ON "PlantCoachMessage"("plantId", "createdAt");

ALTER TABLE "PlantCoachMessage" ADD CONSTRAINT "PlantCoachMessage_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
