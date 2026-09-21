-- CreateTable
CREATE TABLE "DistributedLock" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributedLock_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "DistributedLock_expiresAt_idx" ON "DistributedLock"("expiresAt");