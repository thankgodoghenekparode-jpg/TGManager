import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { SchoolAnalyticsService } from './analytics.service';

@ApiTags('School - Analytics')
@Controller('school/analytics')
@UseGuards(AccessGuard)
export class SchoolAnalyticsController {
  constructor(
    private readonly schoolAnalyticsService: SchoolAnalyticsService,
  ) {}

  @Get('overview')
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'School dashboard overview (counts, attendance, fees)' })
  async overview(@Req() req: PermissionRequest) {
    return this.schoolAnalyticsService.overview(req.tenant.id);
  }
}