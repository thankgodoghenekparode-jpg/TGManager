import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { SchoolAttendanceService } from './attendance.service';
import {
  markSchoolAttendanceSchema,
  querySchoolAttendanceSchema,
  scanAttendanceSchema,
  type MarkSchoolAttendanceDto,
  type QuerySchoolAttendanceDto,
  type ScanAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('School - Attendance')
@Controller('school/attendance')
@UseGuards(AccessGuard)
export class SchoolAttendanceController {
  constructor(private readonly attendanceService: SchoolAttendanceService) {}

  @Get()
  @Permissions(PERMISSIONS.SCHOOL_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Query school attendance records' })
  async query(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(querySchoolAttendanceSchema)) query: QuerySchoolAttendanceDto,
  ) {
    return this.attendanceService.query(req.tenant.id, query);
  }

  @Get('stats')
  @Permissions(PERMISSIONS.SCHOOL_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get daily attendance statistics' })
  async getStats(@Req() req: PermissionRequest, @Query('date') date?: string) {
    return this.attendanceService.getStats(req.tenant.id, date);
  }

  @Post('mark')
  @Permissions(PERMISSIONS.SCHOOL_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Bulk mark classroom attendance for a date' })
  async markBulk(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(markSchoolAttendanceSchema)) dto: MarkSchoolAttendanceDto,
  ) {
    return this.attendanceService.markBulk(req.tenant.id, dto);
  }

  @Post('scan')
  @Permissions(PERMISSIONS.SCHOOL_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Scan QR code / ID card for automatic check-in / check-out' })
  async scan(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(scanAttendanceSchema)) dto: ScanAttendanceDto,
  ) {
    return this.attendanceService.scan(req.tenant.id, dto);
  }
}
