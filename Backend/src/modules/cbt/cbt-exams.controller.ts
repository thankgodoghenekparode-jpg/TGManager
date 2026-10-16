import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CbtExamsService } from './cbt-exams.service';
import { requireStudentRecord } from './cbt-access';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assignExamSchema,
  createExamSchema,
  queryExamsSchema,
  updateExamSchema,
  type AssignExamDto,
  type CreateExamDto,
  type QueryExamsDto,
  type UpdateExamDto,
} from './dto/cbt.dto';

@ApiTags('School - CBT Examinations')
@Controller('school/cbt/exams')
@UseGuards(AccessGuard)
export class CbtExamsController {
  constructor(
    private readonly exams: CbtExamsService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Student-facing -------------------------------------------------------

  @Get('available')
  @Permissions(PERMISSIONS.CBT_VIEW)
  @ApiOperation({ summary: 'Published examinations the signed-in student may take' })
  async available(@Req() req: PermissionRequest) {
    const student = await requireStudentRecord(this.prisma, req.tenant.id, req.user.sub);
    return this.exams.listForStudent(
      req.tenant.id,
      student.id,
      student.currentClassId,
    );
  }

  @Get(':id/brief')
  @Permissions(PERMISSIONS.CBT_TAKE)
  @ApiOperation({ summary: 'Pre-flight exam details for the student (no answers)' })
  async brief(@Req() req: PermissionRequest, @Param('id') id: string) {
    const student = await requireStudentRecord(this.prisma, req.tenant.id, req.user.sub);
    return this.exams.getForStudent(req.tenant.id, student.id, id);
  }

  // --- Staff-facing ---------------------------------------------------------

  @Get()
  @Permissions(PERMISSIONS.CBT_EXAM_VIEW)
  @ApiOperation({ summary: 'List CBT examinations for this school' })
  list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryExamsSchema)) query: QueryExamsDto,
  ) {
    return this.exams.list(req.tenant.id, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CBT_EXAM_VIEW)
  @ApiOperation({ summary: 'Get an examination with its questions and assignments' })
  get(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.exams.get(req.tenant.id, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CBT_EXAM_MANAGE)
  @ApiOperation({ summary: 'Create a CBT examination' })
  create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createExamSchema)) dto: CreateExamDto,
  ) {
    return this.exams.create(req.tenant.id, req.user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CBT_EXAM_MANAGE)
  @ApiOperation({ summary: 'Update a CBT examination' })
  update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExamSchema)) dto: UpdateExamDto,
  ) {
    return this.exams.update(req.tenant.id, id, dto);
  }

  @Post(':id/assign')
  @Permissions(PERMISSIONS.CBT_EXAM_MANAGE)
  @ApiOperation({ summary: 'Assign an examination to a class and/or students' })
  assign(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignExamSchema)) dto: AssignExamDto,
  ) {
    return this.exams.assign(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.CBT_EXAM_MANAGE)
  @ApiOperation({ summary: 'Delete an unattempted exam, otherwise archive it' })
  remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.exams.remove(req.tenant.id, id);
  }
}
