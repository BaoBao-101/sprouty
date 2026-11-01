-- The real IoT devices a kit's Smart variant ships with, listed for the buyer.
ALTER TABLE "Product" ADD COLUMN "smartIncludes" TEXT[] DEFAULT ARRAY[]::TEXT[];
