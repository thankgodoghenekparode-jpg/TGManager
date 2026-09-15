import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AttendanceReportDto,
  InventoryReportDto,
  StaffReportDto,
} from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async attendance(
    tenantId: string,
    abilities: AbilitiesContext,
    query: AttendanceReportDto,
  ) {
    const where = this.scopedWhere<Prisma.AttendanceWhereInput>(
      tenantId,
      abilities,
      { branchId: query.branchId },
    );
    if (query.from || query.to) {
      where.date = {};
      if (query.from) {
        where.date.gte = new Date(`${query.from}T00:00:00.000Z`);
      }
      if (query.to) {
        where.date.lte = new Date(`${query.to}T23:59:59.999Z`);
      }
    }
    if (query.staffRecordId) where.staffRecordId = query.staffRecordId;

    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        branch: { select: { id: true, name: true } },
        staffRecord: {
          select: {
            id: true,
            jobTitle: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const byStatus: Record<string, number> = {};
    let totalWorkSeconds = 0;
    for (const r of records) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.clockInAt && r.clockOutAt) {
        totalWorkSeconds += Math.max(
          0,
          (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 1000,
        );
      }
    }

    return {
      summary: {
        totalRecords: records.length,
        byStatus,
        totalWorkHours: Math.round((totalWorkSeconds / 3600) * 100) / 100,
        presentDays:
          (byStatus.ON_TIME ?? 0) +
          (byStatus.LATE ?? 0) +
          (byStatus.EARLY_LEAVE ?? 0) +
          (byStatus.OVERTIME ?? 0),
        absentDays: byStatus.ABSENT ?? 0,
      },
      records: records.map((r) => ({
        id: r.id,
        date: r.date,
        status: r.status,
        clockInAt: r.clockInAt,
        clockOutAt: r.clockOutAt,
        branchId: r.branchId,
        branchName: r.branch.name,
        staffName: r.staffRecord
          ? `${r.staffRecord.user.firstName} ${r.staffRecord.user.lastName}`
          : null,
        jobTitle: r.staffRecord?.jobTitle ?? null,
      })),
    };
  }

  async attendanceCsv(
    tenantId: string,
    abilities: AbilitiesContext,
    query: AttendanceReportDto,
  ): Promise<string> {
    const report = await this.attendance(tenantId, abilities, query);
    return this.toCsv(
      [
        'date',
        'staffName',
        'jobTitle',
        'branch',
        'status',
        'clockIn',
        'clockOut',
      ],
      report.records.map((r) => [
        this.formatDate(r.date),
        r.staffName ?? '',
        r.jobTitle ?? '',
        r.branchName,
        r.status,
        this.formatDate(r.clockInAt),
        this.formatDate(r.clockOutAt),
      ]),
    );
  }

  async staff(
    tenantId: string,
    abilities: AbilitiesContext,
    query: StaffReportDto,
  ) {
    const where = this.scopedWhere<Prisma.StaffRecordWhereInput>(
      tenantId,
      abilities,
      { branchId: query.branchId },
    );
    if (query.departmentId) where.departmentId = query.departmentId;

    const records = await this.prisma.staffRecord.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const byBranch: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    let active = 0;
    for (const r of records) {
      byBranch[r.branch.name] = (byBranch[r.branch.name] ?? 0) + 1;
      if (r.department) {
        byDepartment[r.department.name] =
          (byDepartment[r.department.name] ?? 0) + 1;
      }
      if (r.isActive) active += 1;
    }

    return {
      summary: {
        totalStaff: records.length,
        active,
        inactive: records.length - active,
        byBranch,
        byDepartment,
      },
      records: records.map((r) => ({
        id: r.id,
        name: `${r.user.firstName} ${r.user.lastName}`,
        email: r.user.email,
        branchName: r.branch.name,
        department: r.department?.name ?? null,
        jobTitle: r.jobTitle,
        employeeCode: r.employeeCode,
        isActive: r.isActive,
        joinedAt: r.joinedAt,
      })),
    };
  }

  async staffCsv(
    tenantId: string,
    abilities: AbilitiesContext,
    query: StaffReportDto,
  ): Promise<string> {
    const report = await this.staff(tenantId, abilities, query);
    return this.toCsv(
      [
        'name',
        'email',
        'branch',
        'department',
        'jobTitle',
        'employeeCode',
        'status',
      ],
      report.records.map((r) => [
        r.name,
        r.email,
        r.branchName,
        r.department ?? '',
        r.jobTitle ?? '',
        r.employeeCode ?? '',
        r.isActive ? 'ACTIVE' : 'INACTIVE',
      ]),
    );
  }

  async inventory(
    tenantId: string,
    abilities: AbilitiesContext,
    query: InventoryReportDto,
  ) {
    const where = this.scopedWhere<Prisma.InventoryItemWhereInput>(
      tenantId,
      abilities,
      { branchId: query.branchId },
    );

    const items = await this.prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { branch: { select: { id: true, name: true } } },
    });

    const rows = items.map((i) => ({
      ...i,
      isLowStock: i.quantity <= i.minQuantity,
    }));
    const lowStock = rows.filter((r) => r.isLowStock);

    const byBranch: Record<string, number> = {};
    for (const r of rows) {
      byBranch[r.branch.name] = (byBranch[r.branch.name] ?? 0) + 1;
    }

    const filtered = query.lowStock === 'true' ? lowStock : rows;

    return {
      summary: {
        totalItems: rows.length,
        lowStockItems: lowStock.length,
        byBranch,
      },
      items: filtered.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        branchName: i.branch.name,
        quantity: i.quantity,
        unit: i.unit,
        minQuantity: i.minQuantity,
        location: i.location,
        isLowStock: i.isLowStock,
      })),
    };
  }

  async inventoryCsv(
    tenantId: string,
    abilities: AbilitiesContext,
    query: InventoryReportDto,
  ): Promise<string> {
    const report = await this.inventory(tenantId, abilities, query);
    return this.toCsv(
      [
        'name',
        'sku',
        'branch',
        'quantity',
        'unit',
        'minQuantity',
        'location',
        'status',
      ],
      report.items.map((i) => [
        i.name,
        i.sku ?? '',
        i.branchName,
        String(i.quantity),
        i.unit ?? '',
        String(i.minQuantity),
        i.location ?? '',
        i.isLowStock ? 'LOW' : 'OK',
      ]),
    );
  }

  private scopedWhere<T extends object>(
    tenantId: string,
    abilities: AbilitiesContext,
    query: { branchId?: string },
  ): T {
    const where: Record<string, unknown> = { tenantId };
    if (query.branchId) {
      if (
        abilities.accessibleBranchIds !== null &&
        !abilities.accessibleBranchIds.includes(query.branchId)
      ) {
        throw new ForbiddenException('You do not have access to this branch');
      }
      where.branchId = query.branchId;
    } else if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }
    return where as T;
  }

  private formatDate(value: Date | string | null): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    return d.toISOString().slice(0, 10);
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const esc = (v: string): string =>
      /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [headers.map(esc).join(',')];
    for (const row of rows) {
      lines.push(row.map(esc).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
  }
}
