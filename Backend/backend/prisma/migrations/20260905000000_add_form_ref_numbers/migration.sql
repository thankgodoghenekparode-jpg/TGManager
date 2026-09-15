-- Add unique REFF number support to form submissions and workflow instances.
-- Also add a per-tenant, per-year counter table for sequential REFF generation.
-- NOTE: written to be idempotent so it can be safely re-applied.

-- FormSubmission: refNumber (unique) + parentRefNumber (for child forms bundled under a Customer Ticket)
-- refNumber is intentionally left nullable at the DB level so a previously-deployed backend keeps working
-- during the deploy window; the new backend always populates it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FormSubmission' AND column_name='refNumber') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "refNumber" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FormSubmission' AND column_name='parentRefNumber') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "parentRefNumber" TEXT;
  END IF;
END $$;

-- Backfill existing rows with a guaranteed-unique REFF built from the full (unique) id.
UPDATE "FormSubmission" SET "refNumber" = 'ZV-' || EXTRACT(YEAR FROM "createdAt")::int || '-' || "id"
WHERE "refNumber" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormSubmission_refNumber_key') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_refNumber_key" UNIQUE ("refNumber");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "FormSubmission_tenantId_parentRefNumber_idx" ON "FormSubmission"("tenantId", "parentRefNumber");

-- WorkflowInstance: refNumber + parentRefNumber for bundle tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='WorkflowInstance' AND column_name='refNumber') THEN
    ALTER TABLE "WorkflowInstance" ADD COLUMN "refNumber" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='WorkflowInstance' AND column_name='parentRefNumber') THEN
    ALTER TABLE "WorkflowInstance" ADD COLUMN "parentRefNumber" TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowInstance_refNumber_key" ON "WorkflowInstance"("refNumber");

-- Per-tenant, per-year REFF counter
CREATE TABLE IF NOT EXISTS "FormRefCounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FormRefCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FormRefCounter_tenantId_year_key" ON "FormRefCounter"("tenantId", "year");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormRefCounter_tenantId_fkey') THEN
    ALTER TABLE "FormRefCounter" ADD CONSTRAINT "FormRefCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
