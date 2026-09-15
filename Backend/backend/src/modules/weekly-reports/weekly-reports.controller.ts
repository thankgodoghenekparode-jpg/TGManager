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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import {
  reviewWeeklyReportSchema,
  submitWeeklyReportSchema,
  updateWeeklyReportSchema,
  type ReviewWeeklyReportDto,
  type SubmitWeeklyReportDto,
  type UpdateWeeklyReportDto,
} from './dto/weekly-report.dto';
import { WeeklyReportsService } from './weekly-reports.service';

@ApiTags('Weekly Reports')
@Controller('weekly-reports')
@UseGuards(TenantGuard, AbilitiesGuard)
export class WeeklyReportsController {
  constructor(private readonly weeklyReports: WeeklyReportsService) {}

  @Post()
  @Permissions(PERMISSIONS.REPORT_SUBMIT)
  @ApiOperation({
    summary: 'Submit a weekly report',
    description:
      'Submits a weekly report for the given week start date. At most one report per user per week.',
  })
  @ApiBody({ schema: schemaRef('SubmitWeeklyReportDto') })
  @ApiCreatedResponse({ description: 'Weekly report created.' })
  async submit(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(submitWeeklyReportSchema))
    dto: SubmitWeeklyReportDto,
  ) {
    return this.weeklyReports.submit(req.tenant.id, req.user.sub, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.REPORT_SUBMIT)
  @ApiOperation({
    summary: 'List my weekly reports',
    description: 'Lists weekly reports submitted by the current user.',
  })
  @ApiOkResponse({ description: 'List of weekly reports.' })
  async myReports(@Req() req: PermissionRequest) {
    return this.weeklyReports.myReports(req.tenant.id, req.user.sub);
  }

  @Get('all')
  @Permissions(PERMISSIONS.REPORT_MANAGE)
  @ApiOperation({
    summary: 'List all weekly reports',
    description: 'Lists weekly reports across the company (for managers).',
  })
  @ApiOkResponse({ description: 'List of weekly reports.' })
  async allReports(@Req() req: PermissionRequest) {
    return this.weeklyReports.allReports(req.tenant.id);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.REPORT_SUBMIT)
  @ApiOperation({
    summary: 'Get a weekly report',
    description: 'Returns a single weekly report by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Weekly report ID' })
  @ApiOkResponse({ description: 'The requested weekly report.' })
  async get(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.weeklyReports.get(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.REPORT_SUBMIT)
  @ApiOperation({
    summary: 'Update a weekly report',
    description: "Updates the submitter's own weekly report.",
  })
  @ApiParam({ name: 'id', type: String, description: 'Weekly report ID' })
  @ApiBody({ schema: schemaRef('UpdateWeeklyReportDto') })
  @ApiOkResponse({ description: 'Weekly report updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWeeklyReportSchema))
    dto: UpdateWeeklyReportDto,
  ) {
    return this.weeklyReports.update(req.tenant.id, req.user.sub, id, dto);
  }

  @Patch(':id/status')
  @Permissions(PERMISSIONS.REPORT_MANAGE)
  @ApiOperation({
    summary: 'Review a weekly report',
    description: 'Marks a weekly report as reviewed or back to submitted.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Weekly report ID' })
  @ApiBody({ schema: schemaRef('ReviewWeeklyReportDto') })
  @ApiOkResponse({ description: 'Weekly report status updated.' })
  async review(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewWeeklyReportSchema))
    dto: ReviewWeeklyReportDto,
  ) {
    return this.weeklyReports.review(req.tenant.id, req.user.sub, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.REPORT_SUBMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a weekly report',
    description: "Deletes the submitter's own weekly report.",
  })
  @ApiParam({ name: 'id', type: String, description: 'Weekly report ID' })
  @ApiNoContentResponse({ description: 'Weekly report deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.weeklyReports.remove(req.tenant.id, req.user.sub, id);
  }
}
