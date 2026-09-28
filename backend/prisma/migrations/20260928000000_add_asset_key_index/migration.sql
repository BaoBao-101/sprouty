-- The /uploads/* guard (finding F-02) looks an Asset up by its object key on
-- every file request, so that lookup needs an index.
CREATE INDEX "Asset_key_idx" ON "Asset"("key");
