-- Re-link each existing plant to the activation that actually grew it: the
-- last redemption of a code for that kit by that account made before the
-- plant was planted (give or take a minute). The previous step took the
-- earliest one, which for an account that had redeemed the kit before (and
-- lost or replaced that plant) pointed at the wrong code — and left the code
-- that really grew it looking unused.
CREATE TEMP TABLE plant_link AS
SELECT
  p.id AS plant_id,
  p."redemptionId" AS old_rid,
  (
    SELECT r.id
    FROM "RedeemCodeRedemption" r
    JOIN "RedeemCode" c ON c.id = r."redeemCodeId"
    WHERE r."userId" = p."userId"
      AND c."productId" = p."productId"
      AND r."redeemedAt" <= p."activatedAt" + interval '1 minute'
    ORDER BY r."redeemedAt" DESC
    LIMIT 1
  ) AS rid
FROM "VirtualPlant" p
WHERE p."redemptionId" IS NOT NULL;

-- Cleared first, then set, so swapping two plants' links never collides on
-- the unique index. Where no better match exists the old link stays.
UPDATE "VirtualPlant" SET "redemptionId" = NULL WHERE id IN (SELECT plant_id FROM plant_link);
UPDATE "VirtualPlant" p
SET "redemptionId" = COALESCE(l.rid, l.old_rid)
FROM plant_link l
WHERE p.id = l.plant_id;

DROP TABLE plant_link;
