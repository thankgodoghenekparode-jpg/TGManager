-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "lateMinutes" INTEGER,
ADD COLUMN "earlyLeaveMinutes" INTEGER,
ADD COLUMN "overtimeMinutes" INTEGER;