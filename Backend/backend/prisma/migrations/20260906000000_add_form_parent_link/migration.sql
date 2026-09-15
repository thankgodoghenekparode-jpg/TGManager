-- Add Customer Ticket (parent) and parent-form linking support to Form.
-- idempotent so it can be safely re-applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Form' AND column_name='isCustomerTicket') THEN
    ALTER TABLE "Form" ADD COLUMN "isCustomerTicket" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Form' AND column_name='parentFormId') THEN
    ALTER TABLE "Form" ADD COLUMN "parentFormId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Form_parentFormId_fkey') THEN
    ALTER TABLE "Form" ADD CONSTRAINT "Form_parentFormId_fkey"
      FOREIGN KEY ("parentFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Form_parentFormId_idx" ON "Form"("parentFormId");
