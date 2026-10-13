-- Who runs a workshop session: employees an admin puts on it.
CREATE TABLE "WorkshopStaff" (
    "workshopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopStaff_pkey" PRIMARY KEY ("workshopId","userId")
);

CREATE INDEX "WorkshopStaff_userId_idx" ON "WorkshopStaff"("userId");

ALTER TABLE "WorkshopStaff" ADD CONSTRAINT "WorkshopStaff_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkshopStaff" ADD CONSTRAINT "WorkshopStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
