-- Allow bound (child) forms to share the same REFF as their parent Customer Ticket.
-- Multiple submission rows may now hold the same refNumber: the ticket row and every
-- form bound to it carry the identical REFF. Uniqueness is enforced only at the
-- ticket level (a ticket submission) rather than per bound submission row.
-- idempotent so it can be safely re-applied.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormSubmission_refNumber_key') THEN
    ALTER TABLE "FormSubmission" DROP CONSTRAINT "FormSubmission_refNumber_key";
  END IF;
END $$;

-- Keep the lookup index for tenant-scoped refNumber lookups.
CREATE INDEX IF NOT EXISTS "FormSubmission_tenantId_refNumber_idx" ON "FormSubmission"("tenantId", "refNumber");
