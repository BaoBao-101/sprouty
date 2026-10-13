-- One plant per activation, not one per kit per account: buying the same kit
-- again grows a second plant. Each plant keeps its own album.

-- The activation behind each plant.
ALTER TABLE "VirtualPlant" ADD COLUMN "redemptionId" TEXT;

-- Existing plants: the earliest redemption by that account of a code for that
-- kit is the one that grew it (until now there could only be one plant).
UPDATE "VirtualPlant" p
SET "redemptionId" = s.id
FROM (
  SELECT DISTINCT ON (r."userId", c."productId") r.id, r."userId", c."productId"
  FROM "RedeemCodeRedemption" r
  JOIN "RedeemCode" c ON c.id = r."redeemCodeId"
  WHERE c."productId" IS NOT NULL
  ORDER BY r."userId", c."productId", r."redeemedAt" ASC
) s
WHERE p."userId" = s."userId" AND p."productId" = s."productId";

CREATE UNIQUE INDEX "VirtualPlant_redemptionId_key" ON "VirtualPlant"("redemptionId");
DROP INDEX "VirtualPlant_userId_productId_key";
CREATE INDEX "VirtualPlant_userId_productId_idx" ON "VirtualPlant"("userId", "productId");

-- Albums belong to a plant. Every existing photo goes to the one plant its
-- owner had for that kit.
ALTER TABLE "UserProductImage" ADD COLUMN "plantId" TEXT;
UPDATE "UserProductImage" i
SET "plantId" = p.id
FROM "VirtualPlant" p
WHERE p."userId" = i."userId" AND p."productId" = i."productId";
CREATE INDEX "UserProductImage_plantId_status_idx" ON "UserProductImage"("plantId", "status");
ALTER TABLE "UserProductImage"
  ADD CONSTRAINT "UserProductImage_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "VirtualPlant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
