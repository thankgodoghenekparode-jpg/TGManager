import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
          notes: r.notes,
        },
        update: {
          status: r.status,
          method: dto.method,
          ...(r.checkInTime ? { checkInTime: new Date(r.checkInTime) } : {}),
          ...(r.checkOutTime ? { checkOutTime: new Date(r.checkOutTime) } : {}),
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
    if (raw.includes('/') && (raw.startsWith('http://') || raw.startsWith('https://'))) {
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

    // Check school opening and late thresholds
    const profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    const lateThreshold = profile?.lateThreshold || '07:45';
    const currentHoursMinutes = now.toTimeString().slice(0, 5); // "HH:MM"
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
}
