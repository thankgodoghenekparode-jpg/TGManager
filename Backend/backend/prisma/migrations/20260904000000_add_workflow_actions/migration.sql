-- Add SUBMISSION, EXECUTION and CLOSURE to the WorkflowAction enum.
-- Postgres requires each new enum value in its own ALTER TYPE statement
-- (they cannot be combined in a single ADD VALUE list).
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'SUBMISSION';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'EXECUTION';
ALTER TYPE "WorkflowAction" ADD VALUE IF NOT EXISTS 'CLOSURE';
