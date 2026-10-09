-- VIP Garden gets a length.
--
-- Until now an account was VIP if it had ever paid for a membership product,
-- forever: "VIP Garden Monthly" never ran out. And the only way to switch it
-- on after paying was to type in a redeem code, which granted nothing VIP
-- actually checks. The membership now lasts a number of days per unit, and the
-- account carries the date it runs until.
ALTER TABLE "Product" ADD COLUMN "membershipDays" INTEGER;
ALTER TABLE "User"    ADD COLUMN "vipUntil"       TIMESTAMP(3);

-- The two plans that exist. Matched on the name because that is all that tells
-- them apart; anything else in the category gets a month until an admin says
-- otherwise.
UPDATE "Product"
   SET "membershipDays" = CASE WHEN "name" ~* '(annual|năm)' THEN 365 ELSE 30 END
 WHERE "category" = 'membership' AND "membershipDays" IS NULL;

-- Everyone who has already paid keeps what they paid for, counted from the day
-- they paid. Same rule as services/membership.js: each purchase starts when
-- the previous one ends, or when it was paid if that is later.
--
-- That recurrence comes out as: the latest of, for each purchase, its payment
-- date plus the days of it and of every purchase after it.
WITH purchases AS (
  SELECT o."userId",
         o."paidAt",
         SUM(oi."qty" * COALESCE(p."membershipDays", 30))::int AS days
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o."id"
    JOIN "Product"   p  ON p."id" = oi."productId"
   WHERE p."category" = 'membership'
     AND o."paidAt" IS NOT NULL
     AND o."status" <> 'cancelled'
   GROUP BY o."id", o."userId", o."paidAt"
),
runs AS (
  SELECT "userId",
         "paidAt" + make_interval(days => SUM(days) OVER (
           PARTITION BY "userId" ORDER BY "paidAt" DESC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         )::int) AS ends
    FROM purchases
)
UPDATE "User" u
   SET "vipUntil" = r.ends
  FROM (SELECT "userId", MAX(ends) AS ends FROM runs GROUP BY "userId") r
 WHERE r."userId" = u."id";
