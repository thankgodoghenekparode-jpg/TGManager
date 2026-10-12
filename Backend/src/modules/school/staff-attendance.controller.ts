import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { SchoolStaffAttendanceService } from './staff-attendance.service';
import {
  clockSchoolStaffInSchema,
  clockSchoolStaffOutSchema,
  querySchoolStaffAttendanceSchema,
  recordSchoolStaffAttendanceSchema,
  type ClockSchoolStaffInDto,
  type ClockSchoolStaffOutDto,
  type QuerySchoolStaffAttendanceDto,
  type RecordSchoolStaffAttendanceDto,
} from './dto/staff-attendance.dto';

@ApiTags('School - Staff Attendance')
@Controller('school/staff-attendance')
@UseGuards(AccessGuard)
export class SchoolStaffAttendanceController {
  constructor(
    private readonly staffAttendanceService: SchoolStaffAttendanceService,
  ) {}

  @Post('clock-in')
  @Permissions(PERMISSIONS.ATTENDANCE_CLOCK_IN)
  @ApiOperation({ summary: 'Clock in a school staff member (self or, for managers, any staff)' })
  async clockIn(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(clockSchoolStaffInSchema))
    dto: ClockSchoolStaffInDto,
  ) {
    return this.staffAttendanceService.clockIn(
      req.tenant.id,
      req.user.sub,
      dto,
      req.abilities,
    );
  }

  @Post('clock-out')
  @Permissions(PERMISSIONS.ATTENDANCE_CLOCK_OUT)
  @ApiOperation({ summary: 'Clock out a school staff member from their open record' })
  async clockOut(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(clockSchoolStaffOutSchema))
    dto: ClockSchoolStaffOutDto,
  ) {
    return this.staffAttendanceService.clockOut(
      req.tenant.id,
      req.user.sub,
      dto,
      req.abilities,
    );
  }

  @Get()
  @Permissions(PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Paginated school staff attendance history' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(querySchoolStaffAttendanceSchema))
    query: QuerySchoolStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.list(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get('summary')
  @Permissions(PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Attendance status breakdown for a period' })
  async summary(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(querySchoolStaffAttendanceSchema))
    query: QuerySchoolStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.summary(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get('today')
  @Permissions(PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_VIEW)
  @ApiOperation({ summary: "Current staff member's profile and today's clock record" })
  async today(@Req() req: PermissionRequest) {
    return this.staffAttendanceService.myToday(req.tenant.id, req.user.sub);
  }

  @Post('record')
  @Permissions(PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Manually record/correct a staff attendance entry (admin)' })
  async record(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(recordSchoolStaffAttendanceSchema))
    dto: RecordSchoolStaffAttendanceDto,
  ) {
    return this.staffAttendanceService.record(
      req.tenant.id,
      req.user.sub,
      dto,
    );
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHOOL_STAFF_ATTENDANCE_MANAGE)
  @ApiOperation({ summary: 'Delete a staff attendance entry (admin)' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.staffAttendanceService.remove(req.tenant.id, id);
  }
}
