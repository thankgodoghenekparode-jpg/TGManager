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
import { SchoolStaffService } from './staff.service';
import {
  createSchoolStaffSchema,
  querySchoolStaffSchema,
  updateSchoolStaffSchema,
  type CreateSchoolStaffDto,
  type QuerySchoolStaffDto,
  type UpdateSchoolStaffDto,
} from './dto/staff.dto';

@ApiTags('School - Staff & Teachers')
@Controller('school/staff')
@UseGuards(AccessGuard)
export class SchoolStaffController {
  constructor(private readonly staffService: SchoolStaffService) {}

  @Get()
  @Permissions(PERMISSIONS.STUDENT_VIEW)
  @ApiOperation({ summary: 'List school staff and teachers' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(querySchoolStaffSchema)) query: QuerySchoolStaffDto,
  ) {
    return this.staffService.list(req.tenant.id, query);
  }

  @Post()
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Add a school staff member / teacher' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createSchoolStaffSchema)) dto: CreateSchoolStaffDto,
  ) {
    return this.staffService.create(req.tenant.id, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update a school staff member' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSchoolStaffSchema)) dto: UpdateSchoolStaffDto,
  ) {
    return this.staffService.update(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Remove a school staff member' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.staffService.remove(req.tenant.id, id);
  }
}
