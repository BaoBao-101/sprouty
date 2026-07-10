-- Enums
CREATE TYPE "AssetKind" AS ENUM ('product_image', 'instruction_video', 'instruction_video_thumb', 'user_image', 'blog_cover', 'blog_inline');
CREATE TYPE "AssetStorageProvider" AS ENUM ('local', 's3');
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "UserImageStatus" AS ENUM ('active', 'hidden', 'deleted');
CREATE TYPE "RedeemFeature" AS ENUM ('ai_assistant', 'instruction_videos', 'image_uploads');
CREATE TYPE "RedeemCodeStatus" AS ENUM ('active', 'disabled', 'expired');
CREATE TYPE "EntitlementSource" AS ENUM ('purchase', 'redeem_code', 'admin_grant');
CREATE TYPE "BlogPostStatus" AS ENUM ('draft', 'published', 'archived');

-- Backward-compatible product videos payload for legacy callers.
ALTER TABLE "Product" ADD COLUMN "videos" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "productId" INTEGER,
  "kind" "AssetKind" NOT NULL,
  "storageProvider" "AssetStorageProvider" NOT NULL,
  "key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "originalName" TEXT,
  "checksum" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructionVideo" (
  "id" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "assetId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "durationSec" INTEGER,
  "thumbnailAssetId" TEXT,
  "externalUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "ContentStatus" NOT NULL DEFAULT 'draft',
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstructionVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserVideoProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "progressSec" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserVideoProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProductImage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "assetId" TEXT NOT NULL,
  "title" TEXT,
  "note" TEXT,
  "status" "UserImageStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedeemCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "features" "RedeemFeature"[] NOT NULL,
  "productId" INTEGER,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "perUserLimit" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "RedeemCodeStatus" NOT NULL DEFAULT 'active',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RedeemCodeRedemption" (
  "id" TEXT NOT NULL,
  "redeemCodeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RedeemCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" "RedeemFeature" NOT NULL,
  "productId" INTEGER,
  "source" "EntitlementSource" NOT NULL,
  "sourceId" TEXT,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "coverAssetId" TEXT,
  "status" "BlogPostStatus" NOT NULL DEFAULT 'draft',
  "authorUserId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Asset_ownerUserId_idx" ON "Asset"("ownerUserId");
CREATE INDEX "Asset_productId_idx" ON "Asset"("productId");
CREATE INDEX "Asset_kind_idx" ON "Asset"("kind");
CREATE INDEX "InstructionVideo_productId_status_sortOrder_idx" ON "InstructionVideo"("productId", "status", "sortOrder");
CREATE UNIQUE INDEX "UserVideoProgress_userId_videoId_key" ON "UserVideoProgress"("userId", "videoId");
CREATE INDEX "UserProductImage_userId_productId_status_idx" ON "UserProductImage"("userId", "productId", "status");
CREATE INDEX "UserProductImage_productId_status_idx" ON "UserProductImage"("productId", "status");
CREATE UNIQUE INDEX "RedeemCode_codeHash_key" ON "RedeemCode"("codeHash");
CREATE INDEX "RedeemCode_productId_idx" ON "RedeemCode"("productId");
CREATE INDEX "RedeemCode_status_idx" ON "RedeemCode"("status");
CREATE INDEX "RedeemCodeRedemption_redeemCodeId_userId_idx" ON "RedeemCodeRedemption"("redeemCodeId", "userId");
CREATE INDEX "UserEntitlement_userId_feature_productId_idx" ON "UserEntitlement"("userId", "feature", "productId");
CREATE INDEX "UserEntitlement_source_sourceId_idx" ON "UserEntitlement"("source", "sourceId");
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructionVideo" ADD CONSTRAINT "InstructionVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructionVideo" ADD CONSTRAINT "InstructionVideo_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructionVideo" ADD CONSTRAINT "InstructionVideo_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructionVideo" ADD CONSTRAINT "InstructionVideo_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstructionVideo" ADD CONSTRAINT "InstructionVideo_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserVideoProgress" ADD CONSTRAINT "UserVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserVideoProgress" ADD CONSTRAINT "UserVideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "InstructionVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductImage" ADD CONSTRAINT "UserProductImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductImage" ADD CONSTRAINT "UserProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProductImage" ADD CONSTRAINT "UserProductImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedeemCode" ADD CONSTRAINT "RedeemCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RedeemCode" ADD CONSTRAINT "RedeemCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RedeemCodeRedemption" ADD CONSTRAINT "RedeemCodeRedemption_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "RedeemCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedeemCodeRedemption" ADD CONSTRAINT "RedeemCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
