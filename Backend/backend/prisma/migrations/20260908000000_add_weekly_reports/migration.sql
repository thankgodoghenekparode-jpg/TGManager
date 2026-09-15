-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'REVIEWED');

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "notes" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReport_tenantId_idx" ON "WeeklyReport"("tenantId");

-- CreateIndex
CREATE INDEX "WeeklyReport_submittedByUserId_idx" ON "WeeklyReport"("submittedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_submittedByUserId_weekStart_key" ON "WeeklyReport"("submittedByUserId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;