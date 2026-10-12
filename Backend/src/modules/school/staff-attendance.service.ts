import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  distanceMeters,
  localDateKey,
  zonedDateTime,
} from '../../common/utils/time.util';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type {
  ClockSchoolStaffInDto,
  ClockSchoolStaffOutDto,
  QuerySchoolStaffAttendanceDto,
  RecordSchoolStaffAttendanceDto,
} from './dto/staff-attendance.dto';

const STAFF_SELECT = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  category: true,
  designation: true,
  department: true,
  photo: true,
  userId: true,
} as const;

@Injectable()
export class SchoolStaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Clock in for the current staff member (or a colleague, for managers). */
  async clockIn(
    tenantId: string,
    userId: string,
    dto: ClockSchoolStaffInDto,
    abilities: AbilitiesContext,
  ) {
    const canManage = !this.requiresSelfScope(abilities);
    const staff = await this.resolveTargetStaff(
      tenantId,
      userId,
      dto.schoolStaffId,
      canManage,
    );

    const now = new Date();
    const timezone = await this.resolveTimezone(tenantId);
    const todayKey = localDateKey(now, timezone);
    const date = new Date(`${todayKey}T00:00:00.000Z`);

    await this.assertGeofence(tenantId, dto.latitude, dto.longitude);

    const existing = await this.prisma.schoolStaffAttendance.findUnique({
      where: {
        tenantId_schoolStaffId_date: {
          tenantId,
          schoolStaffId: staff.id,
          date,
        },
      },
    });
    if (existing?.clockInAt) {
      throw new ConflictException('Already clocked in today');
    }

    const profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
    let lateMinutes: number | null = null;
    if (profile?.lateThreshold) {
      const lateAt = zonedDateTime(todayKey, profile.lateThreshold, timezone);
      if (now > lateAt) {
        status = 'LATE';
        lateMinutes = Math.max(
          1,
          Math.floor((now.getTime() - lateAt.getTime()) / 60_000),
        );
      }
    }

    return this.prisma.schoolStaffAttendance.upsert({
      where: {
        tenantId_schoolStaffId_date: {
          tenantId,
          schoolStaffId: staff.id,
          date,
        },
      },
      create: {
        tenantId,
        schoolStaffId: staff.id,
        branchId: null,
        date,
        clockInAt: now,
        clockInLat: dto.latitude ?? null,
        clockInLng: dto.longitude ?? null,
        status,
        lateMinutes,
        method: canManage && dto.schoolStaffId ? 'ADMIN' : 'WEB',
        note: dto.note ?? null,
        recordedByUserId: userId,
      },
      update: {
        clockInAt: now,
        clockInLat: dto.latitude ?? null,
        clockInLng: dto.longitude ?? null,
        status,
        lateMinutes,
        note: dto.note ?? null,
      },
      include: { schoolStaff: { select: STAFF_SELECT } },
    });
  }

  /** Clock out of the current open record for a staff member. */
  async clockOut(
    tenantId: string,
    userId: string,
    dto: ClockSchoolStaffOutDto,
    abilities: AbilitiesContext,
  ) {
    const canManage = !this.requiresSelfScope(abilities);
    const staff = await this.resolveTargetStaff(
      tenantId,
      userId,
      dto.schoolStaffId,
      canManage,
    );

    const record = await this.prisma.schoolStaffAttendance.findFirst({
      where: {
        tenantId,
        schoolStaffId: staff.id,
        clockInAt: { not: null },
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });
    if (!record) {
      throw new NotFoundException('No open clock-in found to clock out');
    }

    await this.assertGeofence(tenantId, dto.latitude, dto.longitude);

    return this.prisma.schoolStaffAttendance.update({
      where: { id: record.id },
      data: {
        clockOutAt: new Date(),
        clockOutLat: dto.latitude ?? null,
        clockOutLng: dto.longitude ?? null,
        note: dto.note ?? record.note,
      },
      include: { schoolStaff: { select: STAFF_SELECT } },
    });
  }

  /** Paginated attendance history, self-scoped unless the caller can manage. */
  async list(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: QuerySchoolStaffAttendanceDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(tenantId, userId, abilities, query);

    const [items, total] = await Promise.all([
      this.prisma.schoolStaffAttendance.findMany({
        where,
        include: {
          schoolStaff: { select: STAFF_SELECT },
          recordedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ date: 'desc' }, { clockInAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.schoolStaffAttendance.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async summary(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: QuerySchoolStaffAttendanceDto,
  ) {
    const where = this.buildWhere(tenantId, userId, abilities, query);
    const grouped = await this.prisma.schoolStaffAttendance.groupBy({
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

  /** Manual entry / correction by an admin or manager. */
  async record(
    tenantId: string,
    recordedByUserId: string,
    dto: RecordSchoolStaffAttendanceDto,
  ) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { id: dto.schoolStaffId, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const date = new Date(`${dto.date}T00:00:00.000Z`);
    const clockInAt = dto.clockInAt ? new Date(dto.clockInAt) : null;
    const clockOutAt = dto.clockOutAt ? new Date(dto.clockOutAt) : null;
    const status = dto.status ?? (clockInAt ? 'ON_TIME' : 'ABSENT');

    return this.prisma.schoolStaffAttendance.upsert({
      where: {
        tenantId_schoolStaffId_date: {
          tenantId,
          schoolStaffId: staff.id,
          date,
        },
      },
      create: {
        tenantId,
        schoolStaffId: staff.id,
        date,
        clockInAt,
        clockOutAt,
        clockInLat: dto.latitude ?? null,
        clockInLng: dto.longitude ?? null,
        status,
        method: 'ADMIN',
        note: dto.note ?? null,
        recordedByUserId,
      },
      update: {
        clockInAt: clockInAt ?? undefined,
        clockOutAt: clockOutAt ?? undefined,
        status,
        note: dto.note ?? null,
        recordedByUserId,
      },
      include: { schoolStaff: { select: STAFF_SELECT } },
    });
  }

  /** Current staff member's profile and today's clock record (for the buttons). */
  async myToday(tenantId: string, userId: string) {
    const staff = await this.prisma.schoolStaff.findFirst({
      where: { tenantId, userId },
      select: STAFF_SELECT,
    });
    if (!staff) return { staff: null, record: null };

    const timezone = await this.resolveTimezone(tenantId);
    const todayKey = localDateKey(new Date(), timezone);
    const date = new Date(`${todayKey}T00:00:00.000Z`);
    const record = await this.prisma.schoolStaffAttendance.findUnique({
      where: {
        tenantId_schoolStaffId_date: {
          tenantId,
          schoolStaffId: staff.id,
          date,
        },
      },
    });
    return { staff, record, date: todayKey };
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.schoolStaffAttendance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Attendance record not found');
    await this.prisma.schoolStaffAttendance.delete({ where: { id } });
    return { success: true };
  }

  // ================= Helpers =================

  private requiresSelfScope(abilities: AbilitiesContext): boolean {
    return (
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes(
        PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_MANAGE,
      )
    );
  }

  private buildWhere(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: QuerySchoolStaffAttendanceDto,
  ) {
    const where: any = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.schoolStaffId ? { schoolStaffId: query.schoolStaffId } : {}),
    };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
      };
    }

    const staffFilter: any = {};
    if (query.search) {
      staffFilter.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { employeeNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (this.requiresSelfScope(abilities)) {
      staffFilter.userId = userId;
    }
    if (Object.keys(staffFilter).length > 0) {
      where.schoolStaff = staffFilter;
    }
    return where;
  }

  private async resolveTargetStaff(
    tenantId: string,
    userId: string,
    requestedStaffId: string | null | undefined,
    canManage: boolean,
  ) {
    if (requestedStaffId) {
      const staff = await this.prisma.schoolStaff.findFirst({
        where: { id: requestedStaffId, tenantId },
      });
      if (!staff) throw new NotFoundException('Staff member not found');
      if (!canManage && staff.userId !== userId) {
        throw new ForbiddenException(
          'You can only clock in/out for yourself',
        );
      }
      return staff;
    }

    const staff = await this.prisma.schoolStaff.findFirst({
      where: { tenantId, userId },
    });
    if (!staff) {
      throw new BadRequestException(
        'No staff profile is linked to your account. Ask an administrator to link your login.',
      );
    }
    return staff;
  }

  private async resolveTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return tenant?.timezone || 'UTC';
  }

  private async assertGeofence(
    tenantId: string,
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<void> {
    // Only enforce when the admin has configured a campus origin and the
    // device reported a position. Otherwise clock-ins are still captured.
    if (latitude == null || longitude == null) return;
    const profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    if (
      !profile ||
      profile.latitude == null ||
      profile.longitude == null ||
      profile.geofenceRadius == null
    ) {
      return;
    }
    const distance = distanceMeters(
      profile.latitude,
      profile.longitude,
      latitude,
      longitude,
    );
    if (distance > profile.geofenceRadius) {
      throw new ForbiddenException(
        `Outside the school geofence (${Math.round(distance)}m away). Move closer to the campus and try again.`,
      );
    }
  }
}
