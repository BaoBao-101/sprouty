-- The parcel's journey on an order: sent (when, with whom, tracking code) and
-- received (when, and who confirmed it: customer, staff or auto).
ALTER TABLE "Order" ADD COLUMN "shippedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "carrier" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveredBy" TEXT;
