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
import { ParentService } from './parent.service';
import {
  childAttendanceQuerySchema,
  childReportCardQuerySchema,
  childResultsQuerySchema,
  inviteGuardianSchema,
  type ChildAttendanceQueryDto,
  type ChildReportCardQueryDto,
  type ChildResultsQueryDto,
  type InviteGuardianDto,
} from './dto/parent.dto';

@ApiTags('School - Parent Portal')
@Controller('school/parent')
@UseGuards(AccessGuard)
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post('invite')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Grant a guardian portal access (creates a parent account)' })
  async invite(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(inviteGuardianSchema)) dto: InviteGuardianDto,
  ) {
    return this.parentService.inviteGuardian(req.tenant.id, req.user.sub, dto);
  }

  @Get('me')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Get the signed-in guardian profile and their children' })
  async me(@Req() req: PermissionRequest) {
    return this.parentService.getMyProfile(req.tenant.id, req.user.sub);
  }

  @Get('children')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'List the guardian children' })
  async children(@Req() req: PermissionRequest) {
    const profile = await this.parentService.getMyProfile(
      req.tenant.id,
      req.user.sub,
    );
    return profile.children;
  }

  @Get('children/:id')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Get one of the guardian children' })
  async child(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.parentService.getChild(req.tenant.id, req.user.sub, id);
  }

  @Get('children/:id/attendance')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Attendance history for a child' })
  async childAttendance(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(childAttendanceQuerySchema))
    query: ChildAttendanceQueryDto,
  ) {
    return this.parentService.getChildAttendance(
      req.tenant.id,
      req.user.sub,
      id,
      query,
    );
  }

  @Get('children/:id/results')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Published/approved results for a child' })
  async childResults(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(childResultsQuerySchema))
    query: ChildResultsQueryDto,
  ) {
    return this.parentService.getChildResults(
      req.tenant.id,
      req.user.sub,
      id,
      query,
    );
  }

  @Get('children/:id/report-card')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Term report card for a child' })
  async childReportCard(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(childReportCardQuerySchema))
    query: ChildReportCardQueryDto,
  ) {
    return this.parentService.getChildReportCard(
      req.tenant.id,
      req.user.sub,
      id,
      query.sessionId,
      query.termId,
    );
  }

  @Get('children/:id/invoices')
  @Permissions(PERMISSIONS.SCHOOL_PARENT_VIEW)
  @ApiOperation({ summary: 'Fee invoices and payments for a child' })
  async childInvoices(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.parentService.getChildInvoices(req.tenant.id, req.user.sub, id);
  }
}
