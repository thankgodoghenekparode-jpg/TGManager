import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import {
  distanceMeters,
  localDateKey,
  weekdayFromDateKey,
  zonedDateTime,
} from '../../common/utils/time.util';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AttendanceStatus,
  StaffRecord,
} from '../../generated/prisma/client';
import type {
  ClockInDto,
  ClockOutDto,
  ListAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';

const EARLY_GRACE_MINUTES = 30;

/**
 * The schedule rules actually applied when evaluating attendance. Either comes
 * from a real `Schedule` record (`isDefault: false`) or from the tenant-level
 * working-hours defaults when no schedule exists (`isDefault: true`).
 */
type ScheduleRules = {
  resumptionTime: string;
  closingTime: string;
  latePeriodMinutes: number;
  workingDays: number[];
  timezone: string;
  isDefault: boolean;
};

const ATTENDANCE_ACTION = 'ATTENDANCE_CORRECTED';
const ATTENDANCE_ENTITY = 'attendance';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async clockIn(tenantId: string, userId: string, dto: ClockInDto) {
    const staffRecord = await this.resolveStaffRecord(
      tenantId,
      userId,
      dto.staffRecordId,
    );
    const branch = staffRecord.branch;

    const schedule = await this.resolveApplicableSchedule(
      tenantId,
      staffRecord,
      branch.timezone,
    );
    const effectiveTz = schedule?.timezone ?? branch.timezone;
    const now = new Date();
    const todayKey = localDateKey(now, effectiveTz);

    this.assertGeofence(
      await this.resolveGeofence(tenantId, branch),
      dto.latitude,
      dto.longitude,
    );

    let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
    let lateMinutes: number | null = null;
    if (schedule) {
      const todayWeekday = weekdayFromDateKey(todayKey);
      if (!schedule.isDefault && !schedule.workingDays.includes(todayWeekday)) {
        throw new ForbiddenException('Today is not a scheduled work day');
      }
      const evaluation = this.evaluateClockIn(schedule, todayKey, now);
      status = evaluation.status;
      lateMinutes = evaluation.lateMinutes;
    }

    const date = new Date(`${todayKey}T00:00:00.000Z`);
    const existing = await this.prisma.attendance.findUnique({
      where: {
        tenantId_userId_date: { tenantId, userId, date },
      },
    });
    if (existing?.clockInAt) {
      throw new ConflictException('Already clocked in today');
    }

    return this.prisma.attendance.upsert({
      where: {
        tenantId_userId_date: { tenantId, userId, date },
      },
      update: {
        branchId: branch.id,
        staffRecordId: staffRecord.id,
        clockInAt: now,
        clockInLat: dto.latitude,
        clockInLng: dto.longitude,
        status,
        lateMinutes,
        note: dto.note,
      },
      create: {
        tenantId,
        userId,
        branchId: branch.id,
        staffRecordId: staffRecord.id,
        date,
        clockInAt: now,
        clockInLat: dto.latitude,
        clockInLng: dto.longitude,
        status,
        lateMinutes,
        note: dto.note,
      },
    });
  }

  async clockOut(tenantId: string, userId: string, dto: ClockOutDto) {
    const staffRecord = await this.resolveStaffRecord(tenantId, userId);
    const branch = staffRecord.branch;

    const record = await this.prisma.attendance.findFirst({
      where: {
        tenantId,
        userId,
        staffRecordId: staffRecord.id,
        clockInAt: { not: null },
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });
    if (!record) {
      throw new NotFoundException('No open attendance record to clock out');
    }

    this.assertGeofence(
      await this.resolveGeofence(tenantId, branch),
      dto.latitude,
      dto.longitude,
    );

    const schedule = await this.resolveApplicableSchedule(
      tenantId,
      staffRecord,
      branch.timezone,
    );
    const effectiveTz = schedule?.timezone ?? branch.timezone;
    const todayKey = localDateKey(new Date(), effectiveTz);
    const clockOutAt = new Date();

    let status = record.status;
    let earlyLeaveMinutes: number | null = null;
    let overtimeMinutes: number | null = null;
    if (schedule) {
      const end = zonedDateTime(todayKey, schedule.closingTime, effectiveTz);
      if (clockOutAt < end) {
        status = 'EARLY_LEAVE';
        earlyLeaveMinutes = Math.ceil(
          (end.getTime() - clockOutAt.getTime()) / 60_000,
        );
      } else if (clockOutAt > end) {
        status = 'OVERTIME';
        overtimeMinutes = Math.floor(
          (clockOutAt.getTime() - end.getTime()) / 60_000,
        );
      }
    }

    return this.prisma.attendance.update({
      where: { id: record.id },
      data: {
        clockOutAt,
        clockOutLat: dto.latitude,
        clockOutLng: dto.longitude,
        status,
        earlyLeaveMinutes,
        overtimeMinutes,
        note: dto.note ?? record.note,
      },
    });
  }

  async list(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: ListAttendanceDto,
  ) {
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
      staffRecordId?: string;
      status?: AttendanceStatus;
      date?: { gte?: Date; lte?: Date };
      userId?: string;
    } = { tenantId };
    if (query.branchId) where.branchId = query.branchId;
    if (query.staffRecordId) where.staffRecordId = query.staffRecordId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }
    if (this.requiresSelfScope(abilities)) {
      where.userId = userId;
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { clockInAt: 'desc' }],
      include: {
        branch: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async summary(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: ListAttendanceDto,
  ) {
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
      staffRecordId?: string;
      date?: { gte?: Date; lte?: Date };
      userId?: string;
    } = { tenantId };
    if (query.branchId) where.branchId = query.branchId;
    if (query.staffRecordId) where.staffRecordId = query.staffRecordId;
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }
    if (this.requiresSelfScope(abilities)) {
      where.userId = userId;
    }

    const grouped = await this.prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    let present = 0;
    const presentStatuses = new Set([
      'ON_TIME',
      'LATE',
      'EARLY_LEAVE',
      'OVERTIME',
    ]);
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
      if (presentStatuses.has(row.status)) present += row._count._all;
    }

    return { total, present, byStatus };
  }

  async getOne(
    tenantId: string,
    userId: string,
    attendanceId: string,
    abilities: AbilitiesContext,
  ) {
    const record = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        staffRecord: {
          select: {
            id: true,
            jobTitle: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }
    this.assertRecordAccess(record, userId, abilities);
    return record;
  }

  async update(
    tenantId: string,
    userId: string,
    attendanceId: string,
    dto: UpdateAttendanceDto,
    abilities: AbilitiesContext,
    ip?: string,
  ) {
    const existing = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }
    this.assertRecordAccess(existing, userId, abilities);

    const updated = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        clockInAt: dto.clockInAt ? new Date(dto.clockInAt) : undefined,
        clockOutAt: dto.clockOutAt ? new Date(dto.clockOutAt) : undefined,
        status: dto.status,
        note: dto.note,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: ATTENDANCE_ACTION,
        entityType: ATTENDANCE_ENTITY,
        entityId: attendanceId,
        metadata: {
          before: {
            clockInAt: existing.clockInAt,
            clockOutAt: existing.clockOutAt,
            status: existing.status,
            note: existing.note,
          },
          after: {
            clockInAt: updated.clockInAt,
            clockOutAt: updated.clockOutAt,
            status: updated.status,
            note: updated.note,
          },
        },
        ip: ip ?? null,
      },
    });

    return updated;
  }

  /**
   * Restricts list/summary to the caller's own records unless they hold the
   * attendance.manage permission (admins/managers).
   */
  private requiresSelfScope(abilities: AbilitiesContext): boolean {
    return (
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes('attendance.manage')
    );
  }

  private assertRecordAccess(
    record: { userId: string; branchId: string },
    userId: string,
    abilities: AbilitiesContext,
  ): void {
    if (abilities.accessibleBranchIds !== null) {
      if (!abilities.accessibleBranchIds.includes(record.branchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }
    }
    if (this.requiresSelfScope(abilities) && record.userId !== userId) {
      throw new ForbiddenException('You can only access your own records');
    }
  }

  private async resolveStaffRecord(
    tenantId: string,
    userId: string,
    staffRecordId?: string,
  ): Promise<
    StaffRecord & {
      branch: {
        id: string;
        timezone: string;
        latitude: number;
        longitude: number;
        radiusMeters: number | null;
      };
    }
  > {
    if (staffRecordId) {
      const record = await this.prisma.staffRecord.findFirst({
        where: { id: staffRecordId, tenantId, userId },
        include: { branch: true },
      });
      if (!record) {
        throw new BadRequestException('Staff record not found for this user');
      }
      return record;
    }
    const record = await this.prisma.staffRecord.findFirst({
      where: { tenantId, userId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { branch: true },
    });
    if (!record) {
      throw new BadRequestException('No active staff record for this user');
    }
    return record;
  }

  /**
   * Resolves the most specific schedule applicable to a staff member:
   * STAFF > DEPARTMENT > BRANCH. When none exists, falls back to the
   * tenant-level working-hours defaults (marked `isDefault`) so lateness is
   * still evaluated. Returns null when there is neither a schedule nor
   * complete defaults (clock-ins are then recorded without enforcement).
   */
  private async resolveApplicableSchedule(
    tenantId: string,
    staffRecord: StaffRecord,
    branchTimezone: string | null,
  ): Promise<ScheduleRules | null> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        tenantId,
        OR: [
          { scope: 'STAFF', staffRecordId: staffRecord.id },
          {
            scope: 'DEPARTMENT',
            departmentId: staffRecord.departmentId ?? undefined,
          },
          { scope: 'BRANCH', branchId: staffRecord.branchId },
        ],
      },
    });

    schedules.sort((a, b) => {
      const rank: Record<string, number> = {
        STAFF: 0,
        DEPARTMENT: 1,
        BRANCH: 2,
      };
      return rank[a.scope] - rank[b.scope];
    });

    const best = schedules[0];
    if (best) {
      return {
        resumptionTime: best.resumptionTime,
        closingTime: best.closingTime,
        latePeriodMinutes: best.latePeriodMinutes,
        workingDays: best.workingDays,
        timezone: best.timezone,
        isDefault: false,
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return this.scheduleDefaultsFromSettings(tenant?.settings, branchTimezone);
  }

  /**
   * Builds schedule rules from the tenant-level working-hours settings. These
   * are used as a permissive fallback: lateness is evaluated, but the strict
   * window (early/no-clock-in and past-closing) gating is left to real
   * schedules so default-only tenants keep accepting clock-ins as before.
   */
  private scheduleDefaultsFromSettings(
    raw: unknown,
    fallbackTimezone: string | null,
  ): ScheduleRules | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return null;
    }
    const s = raw as Record<string, unknown>;
    if (
      typeof s.defaultResumptionTime === 'string' &&
      s.defaultResumptionTime !== '' &&
      typeof s.defaultClosingTime === 'string' &&
      s.defaultClosingTime !== '' &&
      typeof s.defaultLatePeriodMinutes === 'number' &&
      Number.isInteger(s.defaultLatePeriodMinutes) &&
      Array.isArray(s.defaultWorkingDays) &&
      s.defaultWorkingDays.every(
        (d) => typeof d === 'number' && Number.isInteger(d),
      )
    ) {
      const timezone =
        typeof s.timezone === 'string' && s.timezone !== ''
          ? s.timezone
          : fallbackTimezone;
      if (!timezone) return null;
      return {
        resumptionTime: s.defaultResumptionTime,
        closingTime: s.defaultClosingTime,
        latePeriodMinutes: s.defaultLatePeriodMinutes,
        workingDays: s.defaultWorkingDays as number[],
        timezone,
        isDefault: true,
      };
    }
    return null;
  }

  private async resolveGeofence(
    tenantId: string,
    branch: {
      latitude: number;
      longitude: number;
      radiusMeters: number | null;
    },
  ): Promise<{
    latitude: number;
    longitude: number;
    radiusMeters: number | null;
  }> {
    // Respect a branch's own geofence, unless it still has the placeholder
    // 0,0 coordinates (never configured) — in that case fall through to the
    // tenant-level geolocation defaults.
    if (
      branch.radiusMeters != null &&
      (branch.latitude !== 0 || branch.longitude !== 0)
    ) {
      return branch;
    }

    // Fall back to tenant-level geolocation defaults when the branch has no
    // geofence configured (or only placeholder coordinates).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const raw = tenant?.settings;
    if (
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      typeof (raw as Record<string, unknown>).defaultLatitude === 'number' &&
      typeof (raw as Record<string, unknown>).defaultLongitude === 'number' &&
      typeof (raw as Record<string, unknown>).defaultRadiusMeters === 'number'
    ) {
      const s = raw as Record<string, number>;
      return {
        latitude: s.defaultLatitude,
        longitude: s.defaultLongitude,
        radiusMeters: s.defaultRadiusMeters,
      };
    }

    return branch;
  }

  private assertGeofence(
    geofence: {
      latitude: number;
      longitude: number;
      radiusMeters: number | null;
    },
    latitude: number,
    longitude: number,
  ): void {
    if (geofence.radiusMeters == null) return;
    const distance = distanceMeters(
      geofence.latitude,
      geofence.longitude,
      latitude,
      longitude,
    );
    if (distance > geofence.radiusMeters) {
      throw new ForbiddenException(
        `Outside the branch geofence (${Math.round(distance)}m away)`,
      );
    }
  }

  /**
   * Evaluates a clock-in against the schedule window. `latePeriodMinutes` acts
   * as a grace period: clocking in within it is still ON_TIME. Anything past it
   * is recorded as LATE with the minutes past the grace period (e.g. grace of 15
   * min at an 08:00 start means 08:20 clock-in is 5 minutes late), and the
   * clock-in is still accepted so lateness can be reported.
   */
  private evaluateClockIn(
    schedule: ScheduleRules,
    todayKey: string,
    now: Date,
  ): { status: 'ON_TIME' | 'LATE'; lateMinutes: number | null } {
    const start = zonedDateTime(
      todayKey,
      schedule.resumptionTime,
      schedule.timezone,
    );
    const end = zonedDateTime(
      todayKey,
      schedule.closingTime,
      schedule.timezone,
    );

    if (!schedule.isDefault) {
      if (now < new Date(start.getTime() - EARLY_GRACE_MINUTES * 60_000)) {
        throw new ForbiddenException('Clock-in is not allowed yet');
      }
      if (now > end) {
        throw new ForbiddenException('Clock-in window has passed for today');
      }
    }

    const graceMs = schedule.latePeriodMinutes * 60_000;
    if (now.getTime() > start.getTime() + graceMs) {
      const lateMinutes = Math.floor(
        (now.getTime() - (start.getTime() + graceMs)) / 60_000,
      );
      if (lateMinutes > 0) {
        return { status: 'LATE', lateMinutes };
      }
    }
    return { status: 'ON_TIME', lateMinutes: null };
  }
}
