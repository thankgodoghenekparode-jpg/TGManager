-- Reshape CBT categories into the four supported examination tracks:
--   WAEC, NECO, JAMB, MOCK (Mock Examination).
--
-- Postgres cannot drop values from an existing enum in place, so the columns
-- are temporarily widened to text, the legacy values are folded into MOCK,
-- and the enum is recreated. `SCHOOL` and `GENERAL` no longer exist as tracks;
-- school-authored content now lives under the MOCK track.

-- 1. Drop the column defaults so the type can be swapped.
ALTER TABLE "CbtQuestion" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "CbtExam" ALTER COLUMN "category" DROP DEFAULT;

-- 2. Widen to text.
ALTER TABLE "CbtQuestion" ALTER COLUMN "category" TYPE text USING "category"::text;
ALTER TABLE "CbtExam" ALTER COLUMN "category" TYPE text USING "category"::text;

-- 3. Fold the removed values into MOCK.
UPDATE "CbtQuestion" SET "category" = 'MOCK' WHERE "category" IN ('SCHOOL', 'GENERAL');
UPDATE "CbtExam" SET "category" = 'MOCK' WHERE "category" IN ('SCHOOL', 'GENERAL');

-- 4. Recreate the enum with the four tracks.
DROP TYPE "CbtCategory";
CREATE TYPE "CbtCategory" AS ENUM ('WAEC', 'NECO', 'JAMB', 'MOCK');

-- 5. Narrow the columns back to the enum and restore the default.
ALTER TABLE "CbtQuestion" ALTER COLUMN "category" TYPE "CbtCategory" USING "category"::"CbtCategory";
ALTER TABLE "CbtExam" ALTER COLUMN "category" TYPE "CbtCategory" USING "category"::"CbtCategory";

ALTER TABLE "CbtQuestion" ALTER COLUMN "category" SET DEFAULT 'MOCK';
ALTER TABLE "CbtExam" ALTER COLUMN "category" SET DEFAULT 'MOCK';
