import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { TimetableService } from './timetable.service';
import {
  createTimetablePeriodSchema,
  queryTimetableSchema,
  updateTimetablePeriodSchema,
  type CreateTimetablePeriodDto,
  type QueryTimetableDto,
  type UpdateTimetablePeriodDto,
} from './dto/timetable.dto';

@ApiTags('School - Timetable')
@Controller('school/timetable')
@UseGuards(AccessGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions(PERMISSIONS.ACADEMIC_VIEW)
  @ApiOperation({ summary: 'List timetable periods by class, teacher or day' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryTimetableSchema)) query: QueryTimetableDto,
  ) {
    return this.timetableService.list(req.tenant.id, query);
  }

  @Post()
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Create a timetable period' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createTimetablePeriodSchema))
    dto: CreateTimetablePeriodDto,
  ) {
    return this.timetableService.create(req.tenant.id, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Update a timetable period' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTimetablePeriodSchema))
    dto: UpdateTimetablePeriodDto,
  ) {
    return this.timetableService.update(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Delete a timetable period' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.timetableService.remove(req.tenant.id, id);
  }
}
