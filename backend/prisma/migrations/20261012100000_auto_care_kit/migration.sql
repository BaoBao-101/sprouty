-- VIP's automatic care kit, a device on the IoT board. A plant gets its row
-- the next time it is read (services/plants.js ensureDevices), so nothing is
-- inserted here — a new enum value cannot be used in the transaction that
-- adds it.
ALTER TYPE "PlantDeviceType" ADD VALUE IF NOT EXISTS 'auto_care';
