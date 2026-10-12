-- Admin-set campus geofence origin for the school profile.
ALTER TABLE "SchoolProfile"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

-- Optional per-gate coordinates so each checkpoint can have its own geofence.
ALTER TABLE "Gate"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "radiusMeters" DOUBLE PRECISION;

-- Dedicated school-staff attendance (clock in/out) with captured coordinates.
CREATE TABLE "SchoolStaffAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "schoolStaffId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clockInAt" TIMESTAMP(3),
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "clockOutAt" TIMESTAMP(3),
    "clockOutLat" DOUBLE PRECISION,
    "clockOutLng" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "lateMinutes" INTEGER,
    "earlyLeaveMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "method" TEXT NOT NULL DEFAULT 'WEB',
    "note" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolStaffAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolStaffAttendance_tenantId_schoolStaffId_date_key" ON "SchoolStaffAttendance"("tenantId", "schoolStaffId", "date");
CREATE INDEX "SchoolStaffAttendance_tenantId_date_idx" ON "SchoolStaffAttendance"("tenantId", "date");
CREATE INDEX "SchoolStaffAttendance_schoolStaffId_idx" ON "SchoolStaffAttendance"("schoolStaffId");

ALTER TABLE "SchoolStaffAttendance" ADD CONSTRAINT "SchoolStaffAttendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolStaffAttendance" ADD CONSTRAINT "SchoolStaffAttendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolStaffAttendance" ADD CONSTRAINT "SchoolStaffAttendance_schoolStaffId_fkey" FOREIGN KEY ("schoolStaffId") REFERENCES "SchoolStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolStaffAttendance" ADD CONSTRAINT "SchoolStaffAttendance_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
