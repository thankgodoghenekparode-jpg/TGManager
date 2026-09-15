-- Add per-section role ownership to FormField and link FormSubmission <-> WorkflowInstance.
-- idempotent so it can be safely re-applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FormField' AND column_name='section') THEN
    ALTER TABLE "FormField" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'General';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FormField' AND column_name='roleKey') THEN
    ALTER TABLE "FormField" ADD COLUMN "roleKey" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='FormSubmission' AND column_name='instanceId') THEN
    ALTER TABLE "FormSubmission" ADD COLUMN "instanceId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='WorkflowInstance' AND column_name='submissionId') THEN
    ALTER TABLE "WorkflowInstance" ADD COLUMN "submissionId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormSubmission_instanceId_key') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_instanceId_key" UNIQUE ("instanceId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='FormSubmission_instanceId_fkey') THEN
    ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_instanceId_fkey"
      FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkflowInstance_submissionId_key') THEN
    ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_submissionId_key" UNIQUE ("submissionId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='WorkflowInstance_submissionId_fkey') THEN
    ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_submissionId_fkey"
      FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "FormField_formId_section_idx" ON "FormField"("formId", "section");
CREATE INDEX IF NOT EXISTS "FormField_formId_roleKey_idx" ON "FormField"("formId", "roleKey");
