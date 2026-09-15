import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { isValidTimeZone } from '../../common/utils/time.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { ScheduleScope } from '../../generated/prisma/client';
import type {
  CreateScheduleDto,
  ListSchedulesDto,
  UpdateScheduleDto,
} from './dto/schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateScheduleDto) {
    const target = await this.resolveScopeTarget(tenantId, dto);

    const branch = await this.prisma.branch.findFirst({
      where: { id: target.branchId, tenantId },
      select: { timezone: true },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found in this tenant');
    }

    const tenantSettings = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const raw = tenantSettings?.settings as Record<string, unknown> | null;
    const defaults = raw ?? {};

    const resumptionTime =
      dto.resumptionTime ??
      (typeof defaults.defaultResumptionTime === 'string'
        ? defaults.defaultResumptionTime
        : '08:00');
    const closingTime =
      dto.closingTime ??
      (typeof defaults.defaultClosingTime === 'string'
        ? defaults.defaultClosingTime
        : '17:00');
    const latePeriodMinutes =
      dto.latePeriodMinutes ??
      (typeof defaults.defaultLatePeriodMinutes === 'number'
        ? defaults.defaultLatePeriodMinutes
        : 120);
    const workingDays =
      dto.workingDays ??
      (Array.isArray(defaults.defaultWorkingDays) &&
      defaults.defaultWorkingDays.length > 0
        ? (defaults.defaultWorkingDays as number[])
        : [1, 2, 3, 4, 5]);

    if (closingTime <= resumptionTime) {
      throw new BadRequestException(
        'closingTime must be later than resumptionTime',
      );
    }

    const timezone = dto.timezone ?? branch.timezone;
    if (!isValidTimeZone(timezone)) {
      throw new BadRequestException('Invalid timezone');
    }

    const data = {
      tenantId,
      scope: dto.scope,
      branchId: target.branchId,
      departmentId: target.departmentId,
      staffRecordId: target.staffRecordId,
      resumptionTime,
      closingTime,
      latePeriodMinutes,
      workingDays,
      timezone,
    };

    await this.assertNoOverlap(tenantId, data);

    return this.prisma.schedule.create({ data });
  }

  async list(
    tenantId: string,
    abilities: AbilitiesContext,
    query: ListSchedulesDto,
  ) {
    if (query.branchId) {
      await this.assertBranchAccess(tenantId, query.branchId, abilities);
    }
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
      scope?: ScheduleScope;
      departmentId?: string;
      staffRecordId?: string;
    } = { tenantId };
    if (query.scope) where.scope = query.scope;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.staffRecordId) where.staffRecordId = query.staffRecordId;
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    } else if (query.branchId) {
      where.branchId = query.branchId;
    }
    return this.prisma.schedule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
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
  }

  async getOne(tenantId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
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
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }
    return schedule;
  }

  async update(tenantId: string, scheduleId: string, dto: UpdateScheduleDto) {
    const existing = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    const merged = { ...existing, ...dto };
    if (merged.closingTime <= merged.resumptionTime) {
      throw new BadRequestException(
        'closingTime must be later than resumptionTime',
      );
    }

    let target: Awaited<ReturnType<typeof this.resolveScopeTarget>>;
    if (dto.scope || dto.branchId || dto.departmentId || dto.staffRecordId) {
      target = await this.resolveScopeTarget(tenantId, {
        scope: merged.scope,
        branchId: merged.branchId ?? undefined,
        departmentId: merged.departmentId ?? undefined,
        staffRecordId: merged.staffRecordId ?? undefined,
      } as CreateScheduleDto);
    } else {
      target = {
        branchId: existing.branchId as string,
        departmentId: existing.departmentId,
        staffRecordId: existing.staffRecordId,
      };
    }

    const timezone = dto.timezone ?? existing.timezone;
    if (!isValidTimeZone(timezone)) {
      throw new BadRequestException('Invalid timezone');
    }

    const data = {
      scope: merged.scope,
      branchId: target.branchId,
      departmentId: target.departmentId,
      staffRecordId: target.staffRecordId,
      resumptionTime: merged.resumptionTime,
      closingTime: merged.closingTime,
      latePeriodMinutes: merged.latePeriodMinutes,
      workingDays: merged.workingDays,
      timezone,
    };

    await this.assertNoOverlap(tenantId, data, scheduleId);

    return this.prisma.schedule.update({
      where: { id: scheduleId },
      data,
    });
  }

  async remove(tenantId: string, scheduleId: string) {
    const existing = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }
    await this.prisma.schedule.delete({ where: { id: scheduleId } });
  }

  private async resolveScopeTarget(
    tenantId: string,
    dto: CreateScheduleDto,
  ): Promise<{
    branchId: string;
    departmentId: string | null;
    staffRecordId: string | null;
  }> {
    switch (dto.scope) {
      case 'BRANCH': {
        if (!dto.branchId) {
          throw new BadRequestException(
            'branchId is required for BRANCH scope',
          );
        }
        await this.assertBranchExists(tenantId, dto.branchId);
        return {
          branchId: dto.branchId,
          departmentId: null,
          staffRecordId: null,
        };
      }
      case 'DEPARTMENT': {
        if (!dto.branchId || !dto.departmentId) {
          throw new BadRequestException(
            'branchId and departmentId are required for DEPARTMENT scope',
          );
        }
        await this.assertBranchExists(tenantId, dto.branchId);
        const department = await this.prisma.department.findFirst({
          where: { id: dto.departmentId, tenantId, branchId: dto.branchId },
          select: { id: true },
        });
        if (!department) {
          throw new BadRequestException(
            'Department not found in this tenant/branch',
          );
        }
        return {
          branchId: dto.branchId,
          departmentId: dto.departmentId,
          staffRecordId: null,
        };
      }
      case 'STAFF': {
        if (!dto.staffRecordId) {
          throw new BadRequestException(
            'staffRecordId is required for STAFF scope',
          );
        }
        const staff = await this.prisma.staffRecord.findFirst({
          where: { id: dto.staffRecordId, tenantId },
          select: { branchId: true, departmentId: true },
        });
        if (!staff) {
          throw new BadRequestException(
            'Staff member not found in this tenant',
          );
        }
        return {
          branchId: staff.branchId,
          departmentId: staff.departmentId,
          staffRecordId: dto.staffRecordId,
        };
      }
    }
  }

  private async assertBranchExists(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException('Branch not found in this tenant');
    }
  }

  /**
   * Rejects schedules whose working days overlap another schedule of the same
   * scope target during the same time range.
   */
  private async assertNoOverlap(
    tenantId: string,
    data: {
      scope: string;
      branchId: string;
      departmentId: string | null;
      staffRecordId: string | null;
      resumptionTime: string;
      closingTime: string;
      workingDays: number[];
    },
    excludeId?: string,
  ): Promise<void> {
    const targetWhere: Record<string, string> = { tenantId, scope: data.scope };
    if (data.staffRecordId) targetWhere.staffRecordId = data.staffRecordId;
    else if (data.departmentId) targetWhere.departmentId = data.departmentId;
    else targetWhere.branchId = data.branchId;

    const existing = await this.prisma.schedule.findMany({
      where: targetWhere,
    });

    const incomingDays = new Set(data.workingDays);
    for (const s of existing) {
      if (excludeId && s.id === excludeId) continue;
      const overlapsDay = s.workingDays.some((d) => incomingDays.has(d));
      if (!overlapsDay) continue;
      const overlapsTime =
        s.resumptionTime < data.closingTime &&
        s.closingTime > data.resumptionTime;
      if (overlapsTime) {
        throw new BadRequestException(
          'Schedule conflicts with an existing schedule on overlapping working days',
        );
      }
    }
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (abilities.accessibleBranchIds !== null) {
      if (!abilities.accessibleBranchIds.includes(branchId)) {
        throw new BadRequestException('You do not have access to this branch');
      }
    }
    await this.assertBranchExists(tenantId, branchId);
  }
}
