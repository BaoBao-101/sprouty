-- Add SePay payment tracking fields to Order
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "sepayTransactionId" INTEGER;

-- Unique index gives us webhook idempotency for free
CREATE UNIQUE INDEX "Order_sepayTransactionId_key" ON "Order"("sepayTransactionId");
