-- Drop the leftover unique index on FormSubmission.refNumber created by the
-- pre-migration REFF work. Bound (child) submissions share their parent
-- Customer Ticket's REFF, so the index must not be unique. Idempotent.

DROP INDEX IF EXISTS "FormSubmission_refNumber_key";