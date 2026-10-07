-- Which plant a kit grows is now an explicit choice the admin makes, not a
-- string match on the product name.
--
-- Species used to be keyed by Product.name, so a kit named "Đậu Hà Lan" instead
-- of "Bean" silently produced a generic plant — right stages, wrong words, wrong
-- colours — and nothing in the admin screens hinted that the name was load
-- bearing. Admins can now name a product whatever sells and pick the species
-- separately.

ALTER TABLE "Product" ADD COLUMN "speciesKey" TEXT;

-- Backfill the kits that predate the column. The name-based fallback in
-- services/plant-sim.js would cover these anyway, but setting the column means
-- renaming one of them later cannot quietly change what it grows.
UPDATE "Product" SET "speciesKey" = 'bean'      WHERE "name" = 'Bean';
UPDATE "Product" SET "speciesKey" = 'carrot'    WHERE "name" = 'Carrot';
UPDATE "Product" SET "speciesKey" = 'corn'      WHERE "name" = 'Corn';
UPDATE "Product" SET "speciesKey" = 'pepper'    WHERE "name" = 'FirePepper';
UPDATE "Product" SET "speciesKey" = 'sunflower' WHERE "name" = 'SunFlower';
UPDATE "Product" SET "speciesKey" = 'tomato'    WHERE "name" = 'Tomato';
