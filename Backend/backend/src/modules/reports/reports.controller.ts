import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import {
  attendanceReportSchema,
  inventoryReportSchema,
  staffReportSchema,
  type AttendanceReportDto,
  type InventoryReportDto,
  type StaffReportDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(TenantGuard, AbilitiesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('attendance')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({
    summary: 'Attendance report',
    description:
      'Generates an attendance report within an optional date range.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Start date (inclusive) in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'End date (inclusive) in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'staffRecordId',
    required: false,
    type: String,
    description: 'Filter by staff record ID',
  })
  @ApiOkResponse({ description: 'Attendance report data.' })
  async attendance(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(attendanceReportSchema))
    query: AttendanceReportDto,
  ) {
    return this.reports.attendance(req.tenant.id, req.abilities, query);
  }

  @Get('attendance/export')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="attendance-report.csv"')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Export attendance report',
    description: 'Exports the attendance report as a CSV file download.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Start date (inclusive) in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'End date (inclusive) in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'staffRecordId',
    required: false,
    type: String,
    description: 'Filter by staff record ID',
  })
  @ApiOkResponse({ description: 'CSV file download.' })
  async attendanceCsv(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(attendanceReportSchema))
    query: AttendanceReportDto,
  ) {
    return this.reports.attendanceCsv(req.tenant.id, req.abilities, query);
  }

  @Get('staff')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({
    summary: 'Staff report',
    description:
      'Generates a staff report with optional branch/department filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    type: String,
    description: 'Filter by department ID',
  })
  @ApiOkResponse({ description: 'Staff report data.' })
  async staff(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(staffReportSchema)) query: StaffReportDto,
  ) {
    return this.reports.staff(req.tenant.id, req.abilities, query);
  }

  @Get('staff/export')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="staff-report.csv"')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Export staff report',
    description: 'Exports the staff report as a CSV file download.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    type: String,
    description: 'Filter by department ID',
  })
  @ApiOkResponse({ description: 'CSV file download.' })
  async staffCsv(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(staffReportSchema)) query: StaffReportDto,
  ) {
    return this.reports.staffCsv(req.tenant.id, req.abilities, query);
  }

  @Get('inventory')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({
    summary: 'Inventory report',
    description:
      'Generates an inventory report with optional branch and low-stock filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter to low-stock items only',
  })
  @ApiOkResponse({ description: 'Inventory report data.' })
  async inventory(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(inventoryReportSchema))
    query: InventoryReportDto,
  ) {
    return this.reports.inventory(req.tenant.id, req.abilities, query);
  }

  @Get('inventory/export')
  @Permissions(PERMISSIONS.REPORT_VIEW)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory-report.csv"')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Export inventory report',
    description: 'Exports the inventory report as a CSV file download.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter to low-stock items only',
  })
  @ApiOkResponse({ description: 'CSV file download.' })
  async inventoryCsv(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(inventoryReportSchema))
    query: InventoryReportDto,
  ) {
    return this.reports.inventoryCsv(req.tenant.id, req.abilities, query);
  }
}
