-- Add a storage key for the tenant's uploaded brand logo (null = use default brand).
ALTER TABLE "Tenant" ADD COLUMN     "logoKey" TEXT;