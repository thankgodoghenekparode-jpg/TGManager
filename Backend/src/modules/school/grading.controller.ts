import {
  Body,
  Controller,
  Get,
  Param,
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
import { GradingService } from './grading.service';
import {
  approveResultsSchema,
  createAssessmentComponentSchema,
  createGradingScaleSchema,
  queryResultsSchema,
  recordClassResultsSchema,
  type ApproveResultsDto,
  type CreateAssessmentComponentDto,
  type CreateGradingScaleDto,
  type QueryResultsDto,
  type RecordClassResultsDto,
} from './dto/grading.dto';

@ApiTags('School - Grading & Academic Results')
@Controller('school/grading')
@UseGuards(AccessGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Get('scales')
  @Permissions(PERMISSIONS.ACADEMIC_VIEW)
  @ApiOperation({ summary: 'List grading scales' })
  async listScales(@Req() req: PermissionRequest) {
    return this.gradingService.listGradingScales(req.tenant.id);
  }

  @Post('scales')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Create a grading scale' })
  async createScale(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createGradingScaleSchema)) dto: CreateGradingScaleDto,
  ) {
    return this.gradingService.createGradingScale(req.tenant.id, dto);
  }

  @Get('components')
  @Permissions(PERMISSIONS.ACADEMIC_VIEW)
  @ApiOperation({ summary: 'List assessment components' })
  async listComponents(@Req() req: PermissionRequest) {
    return this.gradingService.listComponents(req.tenant.id);
  }

  @Post('components')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Create an assessment component' })
  async createComponent(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createAssessmentComponentSchema)) dto: CreateAssessmentComponentDto,
  ) {
    return this.gradingService.createComponent(req.tenant.id, dto);
  }

  @Get('results')
  @Permissions(PERMISSIONS.ACADEMIC_VIEW)
  @ApiOperation({ summary: 'Query academic results' })
  async queryResults(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryResultsSchema)) query: QueryResultsDto,
  ) {
    return this.gradingService.queryResults(req.tenant.id, query);
  }

  @Post('results')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Record and calculate class subject results' })
  async recordResults(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(recordClassResultsSchema)) dto: RecordClassResultsDto,
  ) {
    return this.gradingService.recordClassResults(req.tenant.id, dto);
  }

  @Post('approve')
  @Permissions(PERMISSIONS.ACADEMIC_MANAGE)
  @ApiOperation({ summary: 'Approve, reject, or publish term results' })
  async approveResults(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(approveResultsSchema)) dto: ApproveResultsDto,
  ) {
    return this.gradingService.approveResults(req.tenant.id, req.user.sub, dto);
  }

  @Get('report-card/:studentId')
  @Permissions(PERMISSIONS.ACADEMIC_VIEW)
  @ApiOperation({ summary: 'Generate comprehensive student term report card' })
  async getReportCard(
    @Req() req: PermissionRequest,
    @Param('studentId') studentId: string,
    @Query('sessionId') sessionId: string,
    @Query('termId') termId: string,
  ) {
    return this.gradingService.getStudentReportCard(
      req.tenant.id,
      studentId,
      sessionId,
      termId,
    );
  }
}
