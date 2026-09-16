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
import { GroupsService } from './groups.service';
import {
  createGroupSchema,
  groupMembersSchema,
  updateGroupSchema,
  type CreateGroupDto,
  type GroupMembersDto,
  type UpdateGroupDto,
} from './dto/group.dto';

@ApiTags('Groups')
@Controller('groups')
@UseGuards(TenantGuard, AbilitiesGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @Permissions(PERMISSIONS.GROUP_CREATE)
  @ApiOperation({
    summary: 'Create a group',
    description: 'Creates a new group for the current tenant.',
  })
  @ApiBody({ schema: schemaRef('CreateGroupDto') })
  @ApiCreatedResponse({ description: 'Group created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createGroupSchema)) dto: CreateGroupDto,
  ) {
    return this.groups.create(req.tenant.id, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.GROUP_VIEW)
  @ApiOperation({
    summary: 'List groups',
    description: 'Lists groups the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiOkResponse({ description: 'List of groups.' })
  async list(
    @Req() req: PermissionRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.groups.list(req.tenant.id, req.abilities, branchId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.GROUP_VIEW)
  @ApiOperation({
    summary: 'Get a group',
    description: 'Returns a single group by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Group ID (UUID)' })
  @ApiOkResponse({ description: 'The requested group.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.groups.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.GROUP_UPDATE)
  @ApiOperation({
    summary: 'Update a group',
    description: 'Partially updates a group by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Group ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateGroupDto') })
  @ApiOkResponse({ description: 'Group updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) dto: UpdateGroupDto,
  ) {
    return this.groups.update(req.tenant.id, id, dto, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.GROUP_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a group',
    description: 'Deletes a group by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Group ID (UUID)' })
  @ApiNoContentResponse({ description: 'Group deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.groups.remove(req.tenant.id, id, req.abilities);
  }

  @Post(':id/members')
  @Permissions(PERMISSIONS.GROUP_UPDATE)
  @ApiOperation({
    summary: 'Add group members',
    description: 'Adds staff members to a group.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Group ID (UUID)' })
  @ApiBody({ schema: schemaRef('GroupMembersDto') })
  @ApiCreatedResponse({ description: 'Members added.' })
  async addMembers(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(groupMembersSchema)) dto: GroupMembersDto,
  ) {
    return this.groups.addMembers(req.tenant.id, id, dto, req.abilities);
  }

  @Delete(':id/members/:staffRecordId')
  @Permissions(PERMISSIONS.GROUP_UPDATE)
  @ApiOperation({
    summary: 'Remove a group member',
    description: 'Removes a staff member from a group.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Group ID (UUID)' })
  @ApiParam({
    name: 'staffRecordId',
    type: String,
    description: 'Staff record ID (UUID)',
  })
  @ApiOkResponse({ description: 'Member removed.' })
  async removeMember(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('staffRecordId') staffRecordId: string,
  ) {
    return this.groups.removeMember(
      req.tenant.id,
      id,
      staffRecordId,
      req.abilities,
    );
  }
}
