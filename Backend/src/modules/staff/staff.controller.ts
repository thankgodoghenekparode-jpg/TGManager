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
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { StaffService } from './staff.service';
import {
  assignRolesSchema,
  createStaffSchema,
  updateStaffSchema,
  type AssignRolesDto,
  type CreateStaffDto,
  type UpdateStaffDto,
} from './dto/staff.dto';

@ApiTags('Staff')
@Controller('staff')
@UseGuards(TenantGuard, AbilitiesGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  @Permissions(PERMISSIONS.STAFF_CREATE)
  @ApiOperation({
    summary: 'Create a staff record',
    description: 'Creates a new staff record and links it to the current user.',
  })
  @ApiBody({ schema: schemaRef('CreateStaffDto') })
  @ApiCreatedResponse({ description: 'Staff record created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createStaffSchema)) dto: CreateStaffDto,
  ) {
    return this.staff.create(req.tenant.id, dto, req.user.sub, req.abilities);
  }

  @Get()
  @Permissions(PERMISSIONS.STAFF_VIEW)
  @ApiOperation({
    summary: 'List staff',
    description: 'Lists staff records the current user can view, with filters.',
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
  @ApiQuery({
    name: 'groupId',
    required: false,
    type: String,
    description: 'Filter by group ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Free-text search across staff fields',
  })
  @ApiOkResponse({ description: 'List of staff records.' })
  async list(
    @Req() req: PermissionRequest,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('groupId') groupId?: string,
    @Query('search') search?: string,
  ) {
    return this.staff.list(req.tenant.id, req.abilities, {
      branchId,
      departmentId,
      groupId,
      search,
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.STAFF_VIEW)
  @ApiOperation({
    summary: 'Get a staff record',
    description: 'Returns a single staff record by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiOkResponse({ description: 'The requested staff record.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.staff.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.STAFF_UPDATE)
  @ApiOperation({
    summary: 'Update a staff record',
    description: 'Partially updates a staff record by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateStaffDto') })
  @ApiOkResponse({ description: 'Staff record updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) dto: UpdateStaffDto,
  ) {
    return this.staff.update(req.tenant.id, id, dto, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.STAFF_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a staff record',
    description: 'Deletes a staff record by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiNoContentResponse({ description: 'Staff record deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.staff.remove(req.tenant.id, id, req.user.sub, req.abilities);
  }

  @Post(':id/reset-password')
  @Permissions(PERMISSIONS.STAFF_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset a staff member password',
    description:
      'Emails the staff member a password reset link. Requires staff update permission.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiOkResponse({ description: 'Password reset link sent.' })
  async resetPassword(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.staff.resetPassword(
      req.tenant.id,
      id,
      req.user.sub,
      req.abilities,
    );
  }

  @Post(':id/roles')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Assign roles to a staff member',
    description: 'Assigns the given roles to a staff record.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiBody({ schema: schemaRef('AssignRolesDto') })
  @ApiOkResponse({ description: 'Roles assigned.' })
  async assignRoles(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignRolesSchema)) dto: AssignRolesDto,
  ) {
    return this.staff.assignRoles(
      req.tenant.id,
      id,
      dto,
      req.user.sub,
      req.abilities,
    );
  }

  @Delete(':id/roles/:assignmentId')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Remove a role assignment',
    description: 'Removes a role assignment from a staff record.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Staff record ID (UUID)' })
  @ApiParam({
    name: 'assignmentId',
    type: String,
    description: 'Role assignment ID (UUID)',
  })
  @ApiOkResponse({ description: 'Role assignment removed.' })
  async removeRole(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.staff.removeRole(
      req.tenant.id,
      id,
      assignmentId,
      req.abilities,
    );
  }
}
