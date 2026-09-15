import {
  ApiBody,
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
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums';
import { PlatformRoles } from '../../common/decorators/platform-roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AccountRequestsService } from './account-requests.service';
import {
  listRequestsSchema,
  rejectRequestSchema,
  type ListRequestsDto,
  type RejectRequestDto,
} from './dto/account-request.dto';

// Both platform admins can view requests; only a super admin can approve or
// reject them (and process password resets).
const ADMINS = [UserRole.SUPER_ADMIN, UserRole.PLATFORM_SUPPORT];

@ApiTags('Admin Account Requests')
@Controller('admin/account-requests')
export class AdminAccountRequestsController {
  constructor(private readonly requests: AccountRequestsService) {}

  @Get('summary')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Pending account request summary',
    description: 'Counts of pending email change and password reset requests.',
  })
  @ApiOkResponse({ description: 'Pending request summary.' })
  summary() {
    return this.requests.pendingSummary();
  }

  // ------------------------------------------------------------ email change

  @Get('email-change')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'List email change requests',
    description: 'Lists email change requests with optional status filter.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    description: 'Filter by request status',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum requests to return (1-200, default 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset (default 0)',
  })
  @ApiOkResponse({ description: 'List of email change requests.' })
  listEmailChanges(
    @Query(new ZodValidationPipe(listRequestsSchema)) query: ListRequestsDto,
  ) {
    return this.requests.listEmailChanges(query);
  }

  @Get('email-change/:id')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get an email change request',
    description: 'Returns a single email change request by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiOkResponse({ description: 'The requested email change request.' })
  getEmailChange(@Param('id') id: string) {
    return this.requests.getEmailChange(id);
  }

  @Post('email-change/:id/approve')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve an email change request',
    description:
      'Verifies the request is still pending and the requested email is still ' +
      'available, then updates the customer’s email and marks the request ' +
      'COMPLETED. Super admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiOkResponse({ description: 'Email change approved and applied.' })
  approveEmailChange(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.requests.approveEmailChange(id, req.user.sub);
  }

  @Post('email-change/:id/reject')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an email change request',
    description:
      'Rejects a pending email change request, saving the admin reason. ' +
      'Super admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiBody({ schema: schemaRef('RejectRequestDto') })
  @ApiOkResponse({ description: 'Email change request rejected.' })
  rejectEmailChange(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectRequestSchema)) dto: RejectRequestDto,
  ) {
    return this.requests.rejectEmailChange(id, req.user.sub, dto);
  }

  // ------------------------------------------------------------ password reset

  @Get('password-reset')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'List password reset requests',
    description: 'Lists password reset requests with optional status filter.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    description: 'Filter by request status',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum requests to return (1-200, default 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset (default 0)',
  })
  @ApiOkResponse({ description: 'List of password reset requests.' })
  listPasswordResets(
    @Query(new ZodValidationPipe(listRequestsSchema)) query: ListRequestsDto,
  ) {
    return this.requests.listPasswordResets(query);
  }

  @Get('password-reset/:id')
  @PlatformRoles(...ADMINS)
  @ApiOperation({
    summary: 'Get a password reset request',
    description: 'Returns a single password reset request by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiOkResponse({ description: 'The requested password reset request.' })
  getPasswordReset(@Param('id') id: string) {
    return this.requests.getPasswordReset(id);
  }

  @Post('password-reset/:id/approve')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a password reset request',
    description:
      'Generates a secure temporary password, stores only its hash, revokes ' +
      'existing sessions, and returns the temporary password ONCE to the ' +
      'admin to relay to the customer. Super admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiOkResponse({
    description: 'Password reset completed with a one-time temporary password.',
  })
  approvePasswordReset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.requests.approvePasswordReset(id, req.user.sub);
  }

  @Post('password-reset/:id/reject')
  @PlatformRoles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a password reset request',
    description:
      'Rejects a pending password reset request, saving the admin reason. ' +
      'The customer’s password is unchanged. Super admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Request ID' })
  @ApiBody({ schema: schemaRef('RejectRequestDto') })
  @ApiOkResponse({ description: 'Password reset request rejected.' })
  rejectPasswordReset(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectRequestSchema)) dto: RejectRequestDto,
  ) {
    return this.requests.rejectPasswordReset(id, req.user.sub, dto);
  }
}
