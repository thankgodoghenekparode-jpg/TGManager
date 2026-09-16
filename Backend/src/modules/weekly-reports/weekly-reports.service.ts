import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReportStatus } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type {
  ReviewWeeklyReportDto,
  SubmitWeeklyReportDto,
  UpdateWeeklyReportDto,
} from './dto/weekly-report.dto';

const PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
} as const;

const REPORT_INCLUDES = {
  submittedBy: { select: PERSON_SELECT },
  reviewedBy: { select: PERSON_SELECT },
} as const;

export type ReportWithPeople = Prisma.WeeklyReportGetPayload<{
  include: typeof REPORT_INCLUDES;
}>;

export interface ReportWithAttachments extends ReportWithPeople {
  attachments: Array<{
    id: string;
    title: string;
    mimeType: string | null;
    sizeBytes: bigint | null;
  }>;
}

@Injectable()
export class WeeklyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(tenantId: string, userId: string, dto: SubmitWeeklyReportDto) {
    const weekStart = this.parseDate(dto.weekStart);
    if (!weekStart) throw new BadRequestException('Invalid weekStart date');

    const attachmentIds = await this.resolveAttachments(
      tenantId,
      dto.attachmentIds ?? [],
    );

    const existing = await this.prisma.weeklyReport.findUnique({
      where: {
        submittedByUserId_weekStart: {
          submittedByUserId: userId,
          weekStart,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A report for this week already exists');
    }

    const weekEnd = this.addDays(weekStart, 6);
    const report = await this.prisma.weeklyReport.create({
      data: {
        tenantId,
        submittedByUserId: userId,
        weekStart,
        weekEnd,
        notes: dto.notes?.trim() ? dto.notes.trim() : null,
        attachmentIds,
      },
      include: REPORT_INCLUDES,
    });

    await this.notifyManagers(tenantId, userId, report);
    return report;
  }

  async myReports(tenantId: string, userId: string) {
    const reports = await this.prisma.weeklyReport.findMany({
      where: { tenantId, submittedByUserId: userId },
      orderBy: { weekStart: 'desc' },
      include: REPORT_INCLUDES,
    });
    return this.decorateAttachments(tenantId, reports);
  }

  async allReports(tenantId: string) {
    const reports = await this.prisma.weeklyReport.findMany({
      where: { tenantId },
      orderBy: { weekStart: 'desc' },
      include: REPORT_INCLUDES,
    });
    return this.decorateAttachments(tenantId, reports);
  }

  async get(
    tenantId: string,
    userId: string,
    id: string,
    abilities: AbilitiesContext,
  ) {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, tenantId },
      include: REPORT_INCLUDES,
    });
    if (!report) throw new NotFoundException('Report not found');

    const canManage =
      abilities.isCompanyAdmin ||
      abilities.permissions.includes(PERMISSIONS.REPORT_MANAGE);
    if (report.submittedByUserId !== userId && !canManage) {
      throw new ForbiddenException('You cannot view this report');
    }

    const [decorated] = await this.decorateAttachments(tenantId, [report]);
    return decorated;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateWeeklyReportDto,
  ) {
    const report = await this.findOwned(tenantId, userId, id);

    const data: Prisma.WeeklyReportUpdateInput = {};
    if (dto.weekStart) {
      const weekStart = this.parseDate(dto.weekStart);
      if (!weekStart) throw new BadRequestException('Invalid weekStart date');
      const duplicate = await this.prisma.weeklyReport.findFirst({
        where: {
          tenantId,
          submittedByUserId: userId,
          weekStart,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('A report for this week already exists');
      }
      data.weekStart = weekStart;
      data.weekEnd = this.addDays(weekStart, 6);
    }
    if ('notes' in dto) {
      data.notes = dto.notes?.trim() ? dto.notes.trim() : null;
    }
    if (dto.attachmentIds) {
      data.attachmentIds = await this.resolveAttachments(
        tenantId,
        dto.attachmentIds,
      );
    }

    if (Object.keys(data).length === 0) return report;

    return this.prisma.weeklyReport.update({
      where: { id },
      data,
      include: REPORT_INCLUDES,
    });
  }

  async review(
    tenantId: string,
    userId: string,
    id: string,
    dto: ReviewWeeklyReportDto,
  ) {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, tenantId },
      include: REPORT_INCLUDES,
    });
    if (!report) throw new NotFoundException('Report not found');

    const reviewed = dto.status === ReportStatus.REVIEWED;
    const updated = await this.prisma.weeklyReport.update({
      where: { id },
      data: {
        status: reviewed ? ReportStatus.REVIEWED : ReportStatus.SUBMITTED,
        reviewedAt: reviewed ? new Date() : null,
        reviewedByUserId: reviewed ? userId : null,
      },
      include: REPORT_INCLUDES,
    });

    if (reviewed && report.submittedByUserId !== userId) {
      await this.notifications.create(tenantId, {
        userId: report.submittedByUserId,
        type: 'WEEKLY_REPORT_REVIEWED',
        title: 'Weekly report reviewed',
        body: `Your weekly report for ${this.formatDate(
          updated.weekStart,
        )} has been reviewed.`,
        data: {
          reportId: updated.id,
          weekStart: this.formatDate(updated.weekStart),
        },
      });
    }

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findOwned(tenantId, userId, id);
    await this.prisma.weeklyReport.delete({ where: { id } });
  }

  private async findOwned(tenantId: string, userId: string, id: string) {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, tenantId },
      include: REPORT_INCLUDES,
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.submittedByUserId !== userId) {
      throw new ForbiddenException('You can only manage your own reports');
    }
    return report;
  }

  private async resolveAttachments(tenantId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const docs = await this.prisma.document.findMany({
      where: { id: { in: unique }, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (docs.length !== unique.length) {
      throw new BadRequestException('One or more attachments are invalid');
    }
    return unique;
  }

  private async decorateAttachments(
    tenantId: string,
    reports: ReportWithPeople[],
  ): Promise<ReportWithAttachments[]> {
    const allIds = [...new Set(reports.flatMap((r) => r.attachmentIds ?? []))];
    const docs = allIds.length
      ? await this.prisma.document.findMany({
          where: { id: { in: allIds }, tenantId, deletedAt: null },
          select: { id: true, title: true, mimeType: true, sizeBytes: true },
        })
      : [];
    const map = new Map(docs.map((d) => [d.id, d]));
    return reports.map((r) => ({
      ...r,
      attachments: (r.attachmentIds ?? [])
        .map((id) => map.get(id))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined),
    }));
  }

  private async notifyManagers(
    tenantId: string,
    excludedUserId: string,
    report: ReportWithPeople,
  ) {
    const roles = await this.prisma.companyRole.findMany({
      where: { tenantId, permissions: { has: PERMISSIONS.REPORT_MANAGE } },
      select: { id: true },
    });
    if (roles.length === 0) return;

    const assignments = await this.prisma.roleAssignment.findMany({
      where: { tenantId, companyRoleId: { in: roles.map((r) => r.id) } },
      select: { userId: true },
    });
    const userIds = [...new Set(assignments.map((a) => a.userId))].filter(
      (uid) => uid !== excludedUserId,
    );
    if (userIds.length === 0) return;

    const submitterName = report.submittedBy
      ? `${report.submittedBy.firstName} ${report.submittedBy.lastName}`.trim()
      : 'A staff member';

    await this.notifications.createMany(
      tenantId,
      userIds.map((userId) => ({
        userId,
        type: 'WEEKLY_REPORT_SUBMITTED',
        title: `New weekly report from ${submitterName}`,
        body: `A weekly report for ${this.formatDate(
          report.weekStart,
        )} has been submitted for review.`,
        data: {
          reportId: report.id,
          weekStart: this.formatDate(report.weekStart),
        },
      })),
    );
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
