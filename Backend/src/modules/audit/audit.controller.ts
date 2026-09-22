import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { AuditService } from './audit.service';
import { listAuditSchema, type ListAuditDto } from './dto/audit.dto';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(AccessGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  @ApiOperation({
    summary: 'List audit logs',
    description:
      'Lists audit log entries for the current tenant, with filters.',
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    type: String,
    description: 'Filter by audited entity type',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filter by action performed',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'Start timestamp (ISO 8601)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'End timestamp (ISO 8601)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of records to return (1-200)',
  })
  @ApiOkResponse({ description: 'List of audit log entries.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listAuditSchema)) query: ListAuditDto,
  ) {
    return this.audit.list(req.tenant.id, query);
  }
}
