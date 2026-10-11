import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DayOfWeek } from '../../generated/prisma/enums';
import type {
  CreateTimetablePeriodDto,
  QueryTimetableDto,
  UpdateTimetablePeriodDto,
} from './dto/timetable.dto';

interface TimeRef {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

/** True when two same-day periods overlap (touching endpoints are allowed). */
export function periodsOverlap(a: TimeRef, b: TimeRef): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryTimetableDto) {
    return this.prisma.timetablePeriod.findMany({
      where: {
        tenantId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.dayOfWeek ? { dayOfWeek: query.dayOfWeek } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: {
          select: { id: true, firstName: true, lastName: true, photo: true },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
        { class: { name: 'asc' } },
      ],
    });
  }

  private async assertRefs(
    tenantId: string,
    classId: string,
    subjectId: string,
    teacherId?: string | null,
  ) {
    const [classroom, subject] = await Promise.all([
      this.prisma.classRoom.findFirst({ where: { id: classId, tenantId } }),
      this.prisma.subject.findFirst({ where: { id: subjectId, tenantId } }),
    ]);
    if (!classroom) throw new NotFoundException('Class not found');
    if (!subject) throw new NotFoundException('Subject not found');
    if (teacherId) {
      const teacher = await this.prisma.schoolStaff.findFirst({
        where: { id: teacherId, tenantId },
      });
      if (!teacher) throw new NotFoundException('Teacher not found');
    }
    return { classroom, subject };
  }

  private async assertNoConflicts(
    tenantId: string,
    period: TimeRef,
    classId: string,
    teacherId: string | null | undefined,
    ignoreId?: string,
  ) {
    const sameDay = await this.prisma.timetablePeriod.findMany({
      where: {
        tenantId,
        dayOfWeek: period.dayOfWeek as DayOfWeek,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        OR: [
          { classId },
          ...(teacherId ? [{ teacherId }] : []),
        ],
      },
      select: {
        id: true,
        classId: true,
        teacherId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    });

    for (const existing of sameDay) {
      if (!periodsOverlap(period, existing)) continue;
      if (existing.classId === classId) {
        throw new ConflictException(
          `This class already has a period from ${existing.startTime} to ${existing.endTime} on ${period.dayOfWeek}`,
        );
      }
      if (teacherId && existing.teacherId === teacherId) {
        throw new ConflictException(
          `This teacher is already booked from ${existing.startTime} to ${existing.endTime} on ${period.dayOfWeek}`,
        );
      }
    }
  }

  async create(tenantId: string, dto: CreateTimetablePeriodDto) {
    await this.assertRefs(tenantId, dto.classId, dto.subjectId, dto.teacherId);
    await this.assertNoConflicts(
      tenantId,
      dto,
      dto.classId,
      dto.teacherId,
    );

    return this.prisma.timetablePeriod.create({
      data: {
        tenantId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        room: dto.room,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTimetablePeriodDto) {
    const existing = await this.prisma.timetablePeriod.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Timetable period not found');

    const classId = dto.classId ?? existing.classId;
    const subjectId = dto.subjectId ?? existing.subjectId;
    const teacherId =
      dto.teacherId !== undefined ? dto.teacherId : existing.teacherId;

    await this.assertRefs(tenantId, classId, subjectId, teacherId);
    await this.assertNoConflicts(
      tenantId,
      {
        dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
        startTime: dto.startTime ?? existing.startTime,
        endTime: dto.endTime ?? existing.endTime,
      },
      classId,
      teacherId,
      id,
    );

    return this.prisma.timetablePeriod.update({
      where: { id },
      data: {
        ...(dto.classId ? { classId: dto.classId } : {}),
        ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
        ...(dto.teacherId !== undefined ? { teacherId: dto.teacherId } : {}),
        ...(dto.room !== undefined ? { room: dto.room } : {}),
        ...(dto.dayOfWeek ? { dayOfWeek: dto.dayOfWeek } : {}),
        ...(dto.startTime ? { startTime: dto.startTime } : {}),
        ...(dto.endTime ? { endTime: dto.endTime } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.timetablePeriod.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Timetable period not found');

    await this.prisma.timetablePeriod.delete({ where: { id } });
    return { success: true };
  }
}
