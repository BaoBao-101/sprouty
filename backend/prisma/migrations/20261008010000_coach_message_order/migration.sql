-- Give the coach thread a total order.
--
-- A question and its answer are written together and land on the same
-- millisecond, so ordering by createdAt put the answer before the question
-- about half the time. The thread read backwards on screen, and replayed into
-- the model it became two user turns in a row starting from an assistant
-- message — which the provider answered with nothing at all.
ALTER TABLE "PlantCoachMessage" ADD COLUMN "seq" SERIAL;

DROP INDEX IF EXISTS "PlantCoachMessage_plantId_createdAt_idx";
CREATE INDEX "PlantCoachMessage_plantId_seq_idx" ON "PlantCoachMessage"("plantId", "seq");
