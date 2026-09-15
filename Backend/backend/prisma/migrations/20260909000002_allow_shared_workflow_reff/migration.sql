-- Allow bound (child) workflow instances to share the REFF of their parent
-- Customer Ticket, mirroring the FormSubmission behaviour. Multiple instances
-- may legitimately hold the same refNumber (the ticket's REFF) because every
-- child form bundled under one ticket creates its own workflow instance while
-- sharing the ticket number. Clean up any stale unique constraints left behind
-- by earlier migrations so bundled children stop failing with P2002
-- ("Resource already exists"). Idempotent so it can be safely re-applied.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormSubmission_refNumber_key') THEN
    ALTER TABLE "FormSubmission" DROP CONSTRAINT "FormSubmission_refNumber_key";
  END IF;
END $$;

DROP INDEX IF EXISTS "WorkflowInstance_refNumber_key";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkflowInstance_refNumber_key') THEN
    ALTER TABLE "WorkflowInstance" DROP CONSTRAINT "WorkflowInstance_refNumber_key";
  END IF;
END $$;

-- Keep a non-unique lookup index for tenant-scoped refNumber lookups.
CREATE INDEX IF NOT EXISTS "WorkflowInstance_tenantId_refNumber_idx" ON "WorkflowInstance"("tenantId", "refNumber");