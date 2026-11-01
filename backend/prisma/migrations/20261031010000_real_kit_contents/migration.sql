-- The six starter kits are real boxes (see their photos): what is in the box,
-- and the one IoT device the Smart · IoT variant adds. Only where the old
-- simulated-kit lines are still there, so an admin's own edit is never replaced.
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống đậu', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 1 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống cà rốt', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 2 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống bắp ngô', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 7 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống ớt', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 8 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống hướng dương', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 9 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");
UPDATE "Product" SET "includes" = ARRAY['Gói hạt giống cà chua', 'Chậu gốm in hình nhân vật ngộ nghĩnh', 'Viên đất nén (nở ra khi ngâm nước)', 'Thẻ hướng dẫn & cột mốc chăm cây (ngày 1 · 7 · 14 · 21)', 'Thẻ bạn đồng hành Buddy của cây', 'Bộ màu nước & cọ để bé trang trí chậu', 'Cốc đong nước', 'Dây buộc cây', 'Mã kích hoạt cây 3D trên web và app', 'Plant Buddy AI hướng dẫn từng bước']
  WHERE id = 10 AND 'Mở dần 7 thiết bị IoT ảo' = ANY("includes");

UPDATE "Product" SET "smartIncludes" = ARRAY['Cảm biến thông minh cắm chậu, màn hình hiện nhiệt độ & độ ẩm đất']
  WHERE id IN (1, 2, 7, 8, 9, 10) AND "smartPriceDelta" IS NOT NULL AND cardinality(COALESCE("smartIncludes", ARRAY[]::TEXT[])) = 0;
