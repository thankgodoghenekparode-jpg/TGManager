import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { CbtAnalyticsService, type CbtReportActor } from './cbt-analytics.service';
import {
  attemptHistoryQuerySchema,
  examReportQuerySchema,
  performanceQuerySchema,
  type AttemptHistoryQueryDto,
  type ExamReportQueryDto,
  type PerformanceQueryDto,
} from './dto/cbt.dto';

@ApiTags('School - CBT Reports & Analytics')
@Controller('school/cbt/reports')
@UseGuards(AccessGuard)
export class CbtReportsController {
  constructor(private readonly analytics: CbtAnalyticsService) {}

  /**
   * `school.manage` (and company/platform admins) see the whole tenant; teachers
   * are limited to their subjects, classes and exams.
   */
  private actor(req: PermissionRequest): CbtReportActor {
    const permissions: string[] = req.abilities?.permissions ?? [];
    return {
      userId: req.user.sub,
      isSchoolAdmin:
        req.abilities?.isCompanyAdmin === true ||
        permissions.includes(PERMISSIONS.SCHOOL_MANAGE),
    };
  }

  @Get('dashboard')
  @Permissions(PERMISSIONS.CBT_VIEW)
  @ApiOperation({ summary: 'Role-aware CBT dashboard data' })
  dashboard(@Req() req: PermissionRequest) {
    return this.analytics.dashboard(req.tenant.id, this.actor(req));
  }

  @Get('my-attempts')
  @Permissions(PERMISSIONS.CBT_RESULT_VIEW)
  @ApiOperation({ summary: 'The signed-in student’s attempt history' })
  myAttempts(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(attemptHistoryQuerySchema))
    query: AttemptHistoryQueryDto,
  ) {
    return this.analytics.myAttempts(req.tenant.id, req.user.sub, query);
  }

  @Get('exam')
  @Permissions(PERMISSIONS.CBT_RESULT_VIEW)
  @ApiOperation({ summary: 'Results for one examination (teacher/admin scoped)' })
  examReport(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(examReportQuerySchema)) query: ExamReportQueryDto,
  ) {
    return this.analytics.examReport(req.tenant.id, this.actor(req), query);
  }

  @Get('performance')
  @Permissions(PERMISSIONS.CBT_RESULT_VIEW)
  @ApiOperation({ summary: 'Per-student CBT performance across examinations' })
  performance(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(performanceQuerySchema)) query: PerformanceQueryDto,
  ) {
    return this.analytics.classPerformance(req.tenant.id, this.actor(req), query);
  }
}
