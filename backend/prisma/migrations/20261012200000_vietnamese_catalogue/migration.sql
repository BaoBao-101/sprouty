-- The catalogue in Vietnamese, as the rest of the site is.
--
-- Only rows still carrying the English name are renamed, so a product an
-- admin has already renamed keeps its name. The seed carries the same names
-- (it rewrites products 1–10 on every start).
UPDATE "Product" SET "name" = 'Đậu Leo Xanh' WHERE "name" = 'Bean';
UPDATE "Product" SET "name" = 'Cà Rốt Cam' WHERE "name" = 'Carrot';
UPDATE "Product" SET "name" = 'Bắp Ngô Vàng' WHERE "name" = 'Corn';
UPDATE "Product" SET "name" = 'Ớt Lửa' WHERE "name" = 'FirePepper';
UPDATE "Product" SET "name" = 'Hướng Dương' WHERE "name" = 'SunFlower';
UPDATE "Product" SET "name" = 'Cà Chua Đỏ' WHERE "name" = 'Tomato';
UPDATE "Product" SET "name" = 'Gói VIP 1 tháng' WHERE "name" = 'VIP Garden Monthly';
UPDATE "Product" SET "name" = 'Gói VIP 1 năm' WHERE "name" = 'VIP Garden Annual';
UPDATE "Product" SET "collection" = 'Bộ khởi đầu' WHERE "collection" = 'Sprouty Starter';
UPDATE "Product" SET "collection" = 'Vườn Vàng' WHERE "collection" = 'Golden Garden';
UPDATE "Product" SET "collection" = 'Sách Sprouty' WHERE "collection" = 'Sprouty Books';
UPDATE "Product" SET "collection" = 'Bản demo' WHERE "collection" = 'Sprouty Demo';
UPDATE "Product" SET "name" = replace("name", '(fruiting)', '(kết trái)') WHERE "name" LIKE '%(fruiting)%';
