import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { CompanyRolesService } from './company-roles.service';
import {
  assignRoleSchema,
  createCompanyRoleSchema,
  updateCompanyRoleSchema,
  type AssignRoleDto,
  type CreateCompanyRoleDto,
  type UpdateCompanyRoleDto,
} from './dto/company-role.dto';

@ApiTags('Company Roles')
@Controller('company-roles')
@UseGuards(AccessGuard)
export class CompanyRolesController {
  constructor(private readonly companyRoles: CompanyRolesService) {}

  @Get()
  @Permissions(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({
    summary: 'List company roles',
    description: 'Lists roles defined for the current company.',
  })
  @ApiOkResponse({ description: 'List of company roles.' })
  async list(@Req() req: PermissionRequest) {
    return this.companyRoles.list(req.tenant.id);
  }

  @Post()
  @Permissions(PERMISSIONS.ROLE_CREATE)
  @ApiOperation({
    summary: 'Create a company role',
    description: 'Creates a new role for the current company.',
  })
  @ApiBody({ schema: schemaRef('CreateCompanyRoleDto') })
  @ApiCreatedResponse({ description: 'Role created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createCompanyRoleSchema))
    dto: CreateCompanyRoleDto,
  ) {
    return this.companyRoles.create(req.tenant.id, dto, req.user.sub);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({
    summary: 'Get a company role',
    description: 'Returns a single company role by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Role ID (UUID)' })
  @ApiOkResponse({ description: 'The requested company role.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.companyRoles.getOne(req.tenant.id, id);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({
    summary: 'Update a company role',
    description: 'Partially updates a company role by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Role ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateCompanyRoleDto') })
  @ApiOkResponse({ description: 'Role updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompanyRoleSchema))
    dto: UpdateCompanyRoleDto,
  ) {
    return this.companyRoles.update(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.ROLE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a company role',
    description: 'Deletes a company role by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Role ID (UUID)' })
  @ApiNoContentResponse({ description: 'Role deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.companyRoles.remove(req.tenant.id, id);
  }

  @Post(':id/assign')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Assign a role',
    description: 'Assigns a role to a user within the company.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Role ID (UUID)' })
  @ApiBody({ schema: schemaRef('AssignCompanyRoleDto') })
  @ApiOkResponse({ description: 'Role assigned.' })
  async assign(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignRoleSchema)) dto: AssignRoleDto,
  ) {
    return this.companyRoles.assign(
      req.tenant.id,
      id,
      dto,
      req.user.sub,
      req.abilities,
    );
  }

  @Delete(':id/assignments/:assignmentId')
  @Permissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({
    summary: 'Unassign a role',
    description: 'Removes a role assignment from a user.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Role ID (UUID)' })
  @ApiParam({
    name: 'assignmentId',
    type: String,
    description: 'Role assignment ID (UUID)',
  })
  @ApiOkResponse({ description: 'Role unassigned.' })
  async unassign(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.companyRoles.unassign(
      req.tenant.id,
      id,
      assignmentId,
      req.user.sub,
    );
  }
}
