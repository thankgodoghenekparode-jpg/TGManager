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
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { DepartmentsService } from './departments.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentDto,
  type UpdateDepartmentDto,
} from './dto/department.dto';

@ApiTags('Departments')
@Controller('departments')
@UseGuards(AccessGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Post()
  @Permissions(PERMISSIONS.DEPARTMENT_CREATE)
  @ApiOperation({
    summary: 'Create a department',
    description: 'Creates a new department for the current tenant.',
  })
  @ApiBody({ schema: schemaRef('CreateDepartmentDto') })
  @ApiCreatedResponse({ description: 'Department created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createDepartmentSchema))
    dto: CreateDepartmentDto,
  ) {
    return this.departments.create(req.tenant.id, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.DEPARTMENT_VIEW)
  @ApiOperation({
    summary: 'List departments',
    description: 'Lists departments the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiOkResponse({ description: 'List of departments.' })
  async list(
    @Req() req: PermissionRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.departments.list(req.tenant.id, req.abilities, branchId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.DEPARTMENT_VIEW)
  @ApiOperation({
    summary: 'Get a department',
    description: 'Returns a single department by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Department ID (UUID)' })
  @ApiOkResponse({ description: 'The requested department.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.departments.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({
    summary: 'Update a department',
    description: 'Partially updates a department by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Department ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateDepartmentDto') })
  @ApiOkResponse({ description: 'Department updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema))
    dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(req.tenant.id, id, dto, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.DEPARTMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a department',
    description: 'Deletes a department by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Department ID (UUID)' })
  @ApiNoContentResponse({ description: 'Department deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.departments.remove(req.tenant.id, id, req.abilities);
  }
}
