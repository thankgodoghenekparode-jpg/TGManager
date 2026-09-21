-- AlterTable (add composite indexes to support cursor pagination on createdAt)

-- CreateIndex
CREATE INDEX "Document_tenantId_createdAt_idx" ON "Document"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_createdAt_idx" ON "WorkflowInstance"("tenantId", "createdAt");