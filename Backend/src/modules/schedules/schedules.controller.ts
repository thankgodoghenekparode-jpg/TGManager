import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import {
  createScheduleSchema,
  listSchedulesSchema,
  type CreateScheduleDto,
  type ListSchedulesDto,
  type UpdateScheduleDto,
  updateScheduleSchema,
} from './dto/schedule.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(AccessGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Post()
  @Permissions(PERMISSIONS.SCHEDULE_MANAGE)
  @ApiOperation({
    summary: 'Create a schedule',
    description: 'Creates a work schedule for a branch, department, or staff.',
  })
  @ApiBody({ schema: schemaRef('CreateScheduleDto') })
  @ApiCreatedResponse({ description: 'Schedule created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createScheduleSchema)) dto: CreateScheduleDto,
  ) {
    return this.schedules.create(req.tenant.id, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.SCHEDULE_MANAGE)
  @ApiOperation({
    summary: 'List schedules',
    description: 'Lists schedules for the current tenant, with filters.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['BRANCH', 'DEPARTMENT', 'STAFF'],
    description: 'Schedule scope',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Branch ID (required for BRANCH scope)',
  })
  @ApiQuery({
    name: 'departmentId',
    required: false,
    type: String,
    description: 'Department ID (required for DEPARTMENT scope)',
  })
  @ApiQuery({
    name: 'staffRecordId',
    required: false,
    type: String,
    description: 'Staff record ID (required for STAFF scope)',
  })
  @ApiQuery({
    name: 'resumptionTime',
    required: false,
    type: String,
    description: 'Daily resumption time (HH:MM)',
  })
  @ApiQuery({
    name: 'closingTime',
    required: false,
    type: String,
    description: 'Daily closing time (HH:MM)',
  })
  @ApiQuery({
    name: 'latePeriodMinutes',
    required: false,
    type: Number,
    description: 'Grace period in minutes before clock-in is late',
  })
  @ApiQuery({
    name: 'workingDays',
    required: false,
    type: Array,
    description: 'Working days as day-of-week indices (0=Sunday .. 6=Saturday)',
  })
  @ApiQuery({
    name: 'timezone',
    required: false,
    type: String,
    description: 'IANA timezone for the schedule',
  })
  @ApiOkResponse({ description: 'List of schedules.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listSchedulesSchema))
    query: ListSchedulesDto,
  ) {
    return this.schedules.list(req.tenant.id, req.abilities, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.SCHEDULE_MANAGE)
  @ApiOperation({
    summary: 'Get a schedule',
    description: 'Returns a single schedule by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Schedule ID (UUID)' })
  @ApiOkResponse({ description: 'The requested schedule.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.schedules.getOne(req.tenant.id, id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SCHEDULE_MANAGE)
  @ApiOperation({
    summary: 'Update a schedule',
    description: 'Partially updates a schedule by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Schedule ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateScheduleDto') })
  @ApiOkResponse({ description: 'Schedule updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateScheduleSchema)) dto: UpdateScheduleDto,
  ) {
    return this.schedules.update(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHEDULE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a schedule',
    description: 'Deletes a schedule by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Schedule ID (UUID)' })
  @ApiNoContentResponse({ description: 'Schedule deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.schedules.remove(req.tenant.id, id);
  }
}
