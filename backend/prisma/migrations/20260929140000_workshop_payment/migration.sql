-- Workshops can be paid for online now. Paying up front is what secures a seat;
-- an onsite booking is provisional, and both the public page and the admin list
-- say so, so staff know who to keep if a session is oversubscribed.

CREATE TYPE "WorkshopPaymentMethod" AS ENUM ('online', 'onsite');

ALTER TABLE "WorkshopRegistration"
  ADD COLUMN "paymentMethod"      "WorkshopPaymentMethod" NOT NULL DEFAULT 'onsite',
  -- Captured at booking time: a later edit to Workshop.price must not change
  -- what an existing customer was quoted, nor the amount the webhook matches.
  ADD COLUMN "amount"             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAt"             TIMESTAMP(3),
  -- Integer, matching Order."sepayTransactionId": SePay's transaction id is a
  -- number, and the webhook compares both tables against the same value.
  ADD COLUMN "sepayTransactionId" INTEGER;

-- Same guard the Order table uses: the last line of defence against crediting a
-- payment twice when SePay retries a delivery before we acknowledge it.
CREATE UNIQUE INDEX "WorkshopRegistration_sepayTransactionId_key"
  ON "WorkshopRegistration"("sepayTransactionId");

-- Backfill what existing bookings were worth, so the admin list does not show
-- every historic registration as 0đ.
UPDATE "WorkshopRegistration" r
SET "amount" = w."price" * r."childCount"
FROM "Workshop" w
WHERE w."id" = r."workshopId" AND r."amount" = 0;
