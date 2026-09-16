import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { AttendanceService } from './attendance.service';
import {
  clockInSchema,
  clockOutSchema,
  listAttendanceSchema,
  updateAttendanceSchema,
  type ClockInDto,
  type ClockOutDto,
  type ListAttendanceDto,
  type UpdateAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(TenantGuard, AbilitiesGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('clock-in')
  @Permissions(PERMISSIONS.ATTENDANCE_CLOCK_IN)
  @ApiOperation({
    summary: 'Clock in',
    description: 'Records a clock-in for the current user with geolocation.',
  })
  @ApiBody({ schema: schemaRef('ClockInDto') })
  @ApiCreatedResponse({ description: 'Clock-in recorded.' })
  async clockIn(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(clockInSchema)) dto: ClockInDto,
  ) {
    return this.attendance.clockIn(req.tenant.id, req.user.sub, dto);
  }

  @Post('clock-out')
  @Permissions(PERMISSIONS.ATTENDANCE_CLOCK_OUT)
  @ApiOperation({
    summary: 'Clock out',
    description: 'Records a clock-out for the current user with geolocation.',
  })
  @ApiBody({ schema: schemaRef('ClockOutDto') })
  @ApiCreatedResponse({ description: 'Clock-out recorded.' })
  async clockOut(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(clockOutSchema)) dto: ClockOutDto,
  ) {
    return this.attendance.clockOut(req.tenant.id, req.user.sub, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({
    summary: 'List attendance',
    description: 'Lists attendance records for the current user, with filters.',
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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'ON_TIME',
      'LATE',
      'EARLY_LEAVE',
      'OVERTIME',
      'MISSED_CLOCK_IN',
      'NO_CLOCK_OUT',
      'ABSENT',
    ],
    description: 'Filter by attendance status',
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
  @ApiOkResponse({ description: 'List of attendance records.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listAttendanceSchema))
    query: ListAttendanceDto,
  ) {
    return this.attendance.list(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get('summary')
  @Permissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({
    summary: 'Attendance summary',
    description:
      'Returns aggregated attendance summary for the current user, with the same filters as the list.',
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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'ON_TIME',
      'LATE',
      'EARLY_LEAVE',
      'OVERTIME',
      'MISSED_CLOCK_IN',
      'NO_CLOCK_OUT',
      'ABSENT',
    ],
    description: 'Filter by attendance status',
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
  @ApiOkResponse({ description: 'Attendance summary.' })
  async summary(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listAttendanceSchema))
    query: ListAttendanceDto,
  ) {
    return this.attendance.summary(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ATTENDANCE_VIEW)
  @ApiOperation({
    summary: 'Get an attendance record',
    description: 'Returns a single attendance record by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Attendance record ID (UUID)',
  })
  @ApiOkResponse({ description: 'The requested attendance record.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.attendance.getOne(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ATTENDANCE_MANAGE)
  @ApiOperation({
    summary: 'Update an attendance record',
    description:
      'Partially updates an attendance record (clock times, status, note).',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Attendance record ID (UUID)',
  })
  @ApiBody({ schema: schemaRef('UpdateAttendanceDto') })
  @ApiOkResponse({ description: 'Attendance record updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAttendanceSchema))
    dto: UpdateAttendanceDto,
  ) {
    return this.attendance.update(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
      req.ip,
    );
  }
}
