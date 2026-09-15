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
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';
import { PlatformRoles } from '../../common/decorators/platform-roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { PlatformService } from './platform.service';
import {
  platformSettingsSchema,
  type PlatformSettingsDto,
} from './dto/platform-settings.dto';
import {
  createPlanSchema,
  createPlatformUserSchema,
  createTenantSchema,
  listPlatformUsersSchema,
  listTenantsSchema,
  updatePlanSchema,
  updatePlatformUserSchema,
  updateTenantSchema,
  type CreatePlanDto,
  type CreatePlatformUserDto,
  type CreateTenantDto,
  type ListPlatformUsersDto,
  type ListTenantsDto,
  type UpdatePlanDto,
  type UpdatePlatformUserDto,
  type UpdateTenantDto,
} from './dto/platform.dto';

const ADMINS = [UserRole.SUPER_ADMIN, UserRole.PLATFORM_SUPPORT];

@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  // ------------------------------------------------------------ plans

  @Get('plans')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'List all plans',
    description: 'Lists all subscription plans (requires admin access).',
  })
  @ApiOkResponse({ description: 'List of plans.' })
  listPlans() {
    return this.platform.listPlans();
  }

  @Post('plans')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a plan',
    description: 'Creates a new subscription plan (super admin only).',
  })
  @ApiBody({ schema: schemaRef('CreatePlanDto') })
  @ApiCreatedResponse({ description: 'Plan created.' })
  createPlan(
    @Body(new ZodValidationPipe(createPlanSchema)) dto: CreatePlanDto,
  ) {
    return this.platform.createPlan(dto);
  }

  @Patch('plans/:id')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a plan',
    description: 'Partially updates a subscription plan (super admin only).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Plan ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdatePlanDto') })
  @ApiOkResponse({ description: 'Plan updated.' })
  updatePlan(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) dto: UpdatePlanDto,
  ) {
    return this.platform.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a plan',
    description: 'Deactivates a subscription plan (super admin only).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Plan ID (UUID)' })
  @ApiOkResponse({ description: 'Plan deactivated.' })
  async deactivatePlan(@Param('id') id: string) {
    await this.platform.deactivatePlan(id);
    return { ok: true, message: 'Plan deactivated' };
  }

  // ------------------------------------------------------------ tenants

  @Get('tenants')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'List tenants',
    description:
      'Lists tenants with search, status, plan, and pagination filters.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search tenants by name/company',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'SUSPENDED', 'TRIAL_ENDED'],
    description: 'Filter by tenant status',
  })
  @ApiQuery({
    name: 'planId',
    required: false,
    type: String,
    description: 'Filter by plan ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum tenants to return (1-100, default 20)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset (default 0)',
  })
  @ApiOkResponse({ description: 'List of tenants.' })
  listTenants(
    @Query(new ZodValidationPipe(listTenantsSchema)) query: ListTenantsDto,
  ) {
    return this.platform.listTenants(query);
  }

  @Post('tenants')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Create a tenant',
    description:
      'Creates a company (tenant), its admin user, system roles, and a ' +
      'one-time temporary password for the admin. Available to super admins ' +
      'and platform support.',
  })
  @ApiBody({ schema: schemaRef('CreateTenantDto') })
  @ApiCreatedResponse({
    description: 'Tenant and company admin created.',
  })
  async createTenant(
    @Body(new ZodValidationPipe(createTenantSchema)) dto: CreateTenantDto,
  ) {
    return this.platform.createTenant(dto);
  }

  @Delete('tenants/:id')
  @PlatformRoles(...ADMINS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a tenant',
    description:
      'Permanently deletes the tenant and all of its data (cascades). ' +
      'Member users left without any remaining membership are deactivated. ' +
      'Available to super admins and platform support.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiOkResponse({ description: 'Tenant deleted.' })
  async deleteTenant(@Param('id') id: string) {
    return this.platform.deleteTenant(id);
  }

  @Get('tenants/:id')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get a tenant',
    description: 'Returns a single tenant by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiOkResponse({ description: 'The requested tenant.' })
  getTenant(@Param('id') id: string) {
    return this.platform.getTenant(id);
  }

  @Patch('tenants/:id')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Update a tenant',
    description:
      'Partially updates tenant status, plan, timezone, or settings.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateTenantDto') })
  @ApiOkResponse({ description: 'Tenant updated.' })
  updateTenant(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) dto: UpdateTenantDto,
  ) {
    return this.platform.updateTenant(id, dto);
  }

  @Get('tenants/:id/usage')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get tenant usage',
    description: 'Returns usage metrics for a tenant.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiOkResponse({ description: 'Tenant usage metrics.' })
  getTenantUsage(@Param('id') id: string) {
    return this.platform.getTenantUsage(id);
  }

  @Post('tenants/:id/suspend')
  @PlatformRoles(...ADMINS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend a tenant',
    description: 'Suspends a tenant (super admin or platform support).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiOkResponse({ description: 'Tenant suspended.' })
  suspendTenant(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.platform.suspendTenant(id, req.user.sub, req.ip);
  }

  @Post('tenants/:id/activate')
  @PlatformRoles(...ADMINS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate a tenant',
    description:
      'Activates a suspended tenant (super admin or platform support).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID (UUID)' })
  @ApiOkResponse({ description: 'Tenant activated.' })
  activateTenant(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.platform.activateTenant(id, req.user.sub, req.ip);
  }

  // ------------------------------------------------------------ platform settings

  @Get('settings')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get platform settings',
    description: 'Returns global platform configuration.',
  })
  @ApiOkResponse({ description: 'Platform settings.' })
  getPlatformSettings() {
    return this.platform.getPlatformSettings();
  }

  @Patch('settings')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update platform settings',
    description: 'Updates global platform configuration (super admin only).',
  })
  @ApiBody({ schema: schemaRef('PlatformSettingsDto') })
  @ApiOkResponse({ description: 'Platform settings updated.' })
  updatePlatformSettings(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(platformSettingsSchema))
    dto: PlatformSettingsDto,
  ) {
    return this.platform.updatePlatformSettings(dto, req.user.sub, req.ip);
  }

  // ------------------------------------------------------------ platform users

  @Post('users')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a platform user',
    description: 'Creates a super admin or support user (super admin only).',
  })
  @ApiBody({ schema: schemaRef('CreatePlatformUserDto') })
  @ApiCreatedResponse({ description: 'Platform user created.' })
  createPlatformUser(
    @Body(new ZodValidationPipe(createPlatformUserSchema))
    dto: CreatePlatformUserDto,
  ) {
    return this.platform.createPlatformUser(dto);
  }

  @Get('users')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'List platform users',
    description:
      'Lists super admin and support users with search, role, and pagination filters.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search platform users by name or email',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['SUPER_ADMIN', 'PLATFORM_SUPPORT'],
    description: 'Filter by platform role',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum users to return (1-100, default 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset (default 0)',
  })
  @ApiOkResponse({ description: 'List of platform users.' })
  listPlatformUsers(
    @Query(new ZodValidationPipe(listPlatformUsersSchema))
    query: ListPlatformUsersDto,
  ) {
    return this.platform.listPlatformUsers(query);
  }

  @Get('users/:id')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get a platform user',
    description: 'Returns a single platform user by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'User ID (UUID)' })
  @ApiOkResponse({ description: 'The requested platform user.' })
  getPlatformUser(@Param('id') id: string) {
    return this.platform.getPlatformUser(id);
  }

  @Patch('users/:id')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a platform user',
    description:
      'Partially updates a platform user (name, role, active status). Super admin only. The last active super admin cannot be demoted or deactivated.',
  })
  @ApiParam({ name: 'id', type: String, description: 'User ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdatePlatformUserDto') })
  @ApiOkResponse({ description: 'Platform user updated.' })
  updatePlatformUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlatformUserSchema))
    dto: UpdatePlatformUserDto,
  ) {
    return this.platform.updatePlatformUser(id, dto);
  }

  @Delete('users/:id')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a platform user',
    description:
      'Deletes a platform user (super admin only). The last active super admin cannot be deleted.',
  })
  @ApiParam({ name: 'id', type: String, description: 'User ID (UUID)' })
  @ApiOkResponse({ description: 'Platform user deleted.' })
  async removePlatformUser(@Param('id') id: string) {
    await this.platform.removePlatformUser(id);
    return { ok: true, message: 'Platform user deleted' };
  }

  @Post('users/:id/reset-password')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a password reset link to a platform user',
    description:
      'Emails a password reset link to a platform user (super admin only).',
  })
  @ApiParam({ name: 'id', type: String, description: 'User ID (UUID)' })
  @ApiOkResponse({ description: 'Password reset link sent.' })
  resetPlatformUserPassword(@Param('id') id: string) {
    return this.platform.resetPlatformUserPassword(id);
  }
}
