-- Reviews of workshop sessions, by parents whose child was checked in.
CREATE TABLE "WorkshopReview" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registrationId" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'published',
    "hiddenReason" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopReview_pkey" PRIMARY KEY ("id"),
    -- Prisma has no way to say this; the API checks it too.
    CONSTRAINT "WorkshopReview_rating_range" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "WorkshopReview_registrationId_key" ON "WorkshopReview"("registrationId");
CREATE UNIQUE INDEX "WorkshopReview_userId_workshopId_key" ON "WorkshopReview"("userId", "workshopId");
CREATE INDEX "WorkshopReview_workshopId_status_createdAt_idx" ON "WorkshopReview"("workshopId", "status", "createdAt");
CREATE INDEX "WorkshopReview_status_createdAt_idx" ON "WorkshopReview"("status", "createdAt");

ALTER TABLE "WorkshopReview" ADD CONSTRAINT "WorkshopReview_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopReview" ADD CONSTRAINT "WorkshopReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopReview" ADD CONSTRAINT "WorkshopReview_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "WorkshopRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
