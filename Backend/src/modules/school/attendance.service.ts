import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { distanceMeters, localTimeKey } from '../../common/utils/time.util';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  MarkSchoolAttendanceDto,
  QuerySchoolAttendanceDto,
  ScanAttendanceDto,
} from './dto/attendance.dto';

@Injectable()
export class SchoolAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markBulk(tenantId: string, dto: MarkSchoolAttendanceDto) {
    const attendanceDate = new Date(`${dto.date}T00:00:00.000Z`);

    const operations = dto.records.map((r) => {
      return this.prisma.schoolAttendance.upsert({
        where: {
          tenantId_studentId_date: {
            tenantId,
            studentId: r.studentId,
            date: attendanceDate,
          },
        },
        create: {
          tenantId,
          studentId: r.studentId,
          gateId: dto.gateId,
          date: attendanceDate,
          status: r.status,
          method: dto.method,
          checkInTime: r.checkInTime ? new Date(r.checkInTime) : new Date(),
          checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          notes: r.notes,
        },
        update: {
          status: r.status,
          method: dto.method,
          ...(r.checkInTime ? { checkInTime: new Date(r.checkInTime) } : {}),
          ...(r.checkOutTime ? { checkOutTime: new Date(r.checkOutTime) } : {}),
          ...(dto.latitude != null ? { latitude: dto.latitude } : {}),
          ...(dto.longitude != null ? { longitude: dto.longitude } : {}),
          notes: r.notes,
        },
      });
    });

    const results = await this.prisma.$transaction(operations);
    return {
      success: true,
      count: results.length,
      records: results,
    };
  }

  async scan(tenantId: string, dto: ScanAttendanceDto) {
    let raw = (dto.identifier || (dto as any).scanPayload || '').trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        raw = parsed.qrIdentifier || parsed.identifier || parsed.admissionNumber || parsed.cardNumber || parsed.studentId || raw;
      } catch {
        // ignore json parse error
      }
    }
    // Strip common scanner noise: URL query strings / fragments (e.g.
    // https://school/qr/STU-…?t=123) and trailing control characters that
    // some barcode readers append to the payload.
    raw = raw.split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f;]+$/g, '').trim();
    // QR payloads sometimes carry the school domain prefix (https://….edu.ng/qr/STU-…).
    if (/^https?:\/\//i.test(raw) && raw.includes('/')) {
      const parts = raw.split('/');
      raw = parts[parts.length - 1] || raw;
    }
    const trimmed = raw.trim();

    // Locate student by QR identifier, admission number, or id
    let student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        OR: [
          { qrIdentifier: { equals: trimmed, mode: 'insensitive' } },
          { admissionNumber: { equals: trimmed, mode: 'insensitive' } },
          { id: trimmed },
        ],
      },
      include: {
        currentClass: true,
      },
    });

    if (!student) {
      // Check ID Card
      const card = await this.prisma.studentIdCard.findFirst({
        where: {
          tenantId,
          OR: [
            { cardNumber: { equals: trimmed, mode: 'insensitive' } },
            { qrPayload: { equals: trimmed, mode: 'insensitive' } },
          ],
        },
        include: {
          student: {
            include: { currentClass: true },
          },
        },
      });
      if (card) {
        student = card.student;
      }
    }

    if (!student) {
      throw new NotFoundException(`No active student found matching identifier "${trimmed}".`);
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const attendanceDate = new Date(`${todayStr}T00:00:00.000Z`);

    // Enforce the admin-configured campus/gate geofence (when both the fence
    // and a device position are available) before accepting the scan.
    await this.assertGeofence(tenantId, dto.gateId, dto.latitude, dto.longitude);

    // Check school opening and late thresholds
    const profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const lateThreshold = profile?.lateThreshold || '07:45';
    const currentHoursMinutes = localTimeKey(now, tenant?.timezone || 'UTC'); // "HH:MM"
    const isLate = currentHoursMinutes > lateThreshold;

    const existing = await this.prisma.schoolAttendance.findUnique({
      where: {
        tenantId_studentId_date: {
          tenantId,
          studentId: student.id,
          date: attendanceDate,
        },
      },
    });

    let record;
    let actionType: 'CHECK_IN' | 'CHECK_OUT';

    if (!existing) {
      // First scan of the day -> Check In
      actionType = 'CHECK_IN';
      record = await this.prisma.schoolAttendance.create({
        data: {
          tenantId,
          studentId: student.id,
          branchId: dto.branchId,
          gateId: dto.gateId,
          date: attendanceDate,
          checkInTime: now,
          status: isLate ? 'LATE' : 'PRESENT',
          method: dto.method,
          deviceId: dto.deviceId,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    } else {
      // Subsequent scan -> Check Out
      actionType = 'CHECK_OUT';
      record = await this.prisma.schoolAttendance.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
          gateId: dto.gateId ?? existing.gateId,
          deviceId: dto.deviceId ?? existing.deviceId,
        },
      });
    }

    return {
      action: actionType,
      status: record.status,
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        class: student.currentClass?.name ?? 'Unassigned',
        photo: student.passportPhoto,
      },
      attendance: record,
    };
  }

  async query(tenantId: string, query: QuerySchoolAttendanceDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
    };

    if (query.date) {
      where.date = new Date(`${query.date}T00:00:00.000Z`);
    } else if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      if (query.endDate) where.date.lte = new Date(`${query.endDate}T00:00:00.000Z`);
    }

    if (query.classId) {
      where.student = { currentClassId: query.classId };
    }

    const [items, total] = await Promise.all([
      this.prisma.schoolAttendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
              currentClass: { select: { id: true, name: true } },
            },
          },
          gate: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ date: 'desc' }, { checkInTime: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.schoolAttendance.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(tenantId: string, date?: string) {
    const targetDate = date
      ? new Date(`${date}T00:00:00.000Z`)
      : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

    const totalStudents = await this.prisma.student.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const statusCounts = await this.prisma.schoolAttendance.groupBy({
      by: ['status'],
      where: { tenantId, date: targetDate },
      _count: true,
    });

    const counts: Record<string, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    };

    for (const item of statusCounts) {
      counts[item.status] = item._count;
    }

    const markedTotal = Object.values(counts).reduce((a, b) => a + b, 0);
    const unrecorded = Math.max(0, totalStudents - markedTotal);

    return {
      date: targetDate.toISOString().slice(0, 10),
      totalActiveStudents: totalStudents,
      present: counts.PRESENT,
      late: counts.LATE,
      absent: counts.ABSENT + unrecorded,
      excused: counts.EXCUSED,
      halfDay: 0,
      attendanceRatePercent: totalStudents > 0
        ? Math.round(((counts.PRESENT + counts.LATE) / totalStudents) * 100)
        : 0,
    };
  }

  /**
   * Resolves the effective geofence for a gate scan: the gate's own fence when
   * configured, otherwise the campus-wide fence from the school profile.
   * Returns null when no coordinates have been set by the admin, in which case
   * scans are accepted without a location check.
   */
  private async resolveGeofence(
    tenantId: string,
    gateId?: string | null,
  ): Promise<{ latitude: number; longitude: number; radiusMeters: number } | null> {
    if (gateId) {
      const gate = await this.prisma.gate.findFirst({
        where: { id: gateId, tenantId },
      });
      if (
        gate &&
        gate.latitude != null &&
        gate.longitude != null &&
        gate.radiusMeters != null
      ) {
        return {
          latitude: gate.latitude,
          longitude: gate.longitude,
          radiusMeters: gate.radiusMeters,
        };
      }
    }

    const profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    if (
      profile &&
      profile.latitude != null &&
      profile.longitude != null &&
      profile.geofenceRadius != null
    ) {
      return {
        latitude: profile.latitude,
        longitude: profile.longitude,
        radiusMeters: profile.geofenceRadius,
      };
    }
    return null;
  }

  /**
   * Verifies the scanning device is within the configured geofence. When either
   * the fence or the device position is unavailable, the check is skipped so
   * attendance can still be captured (e.g. desktop kiosks without GPS).
   */
  private async assertGeofence(
    tenantId: string,
    gateId: string | null | undefined,
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<void> {
    if (latitude == null || longitude == null) return;
    const fence = await this.resolveGeofence(tenantId, gateId);
    if (!fence) return;
    const distance = distanceMeters(
      fence.latitude,
      fence.longitude,
      latitude,
      longitude,
    );
    if (distance > fence.radiusMeters) {
      throw new ForbiddenException(
        `Outside the school geofence (${Math.round(distance)}m away). Move closer to the gate/campus and try again.`,
      );
    }
  }
}
