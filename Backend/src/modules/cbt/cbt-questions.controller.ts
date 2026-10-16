import {
  Body,
  Controller,
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
import { CbtQuestionsService } from './cbt-questions.service';
import {
  createQuestionSchema,
  importQuestionsSchema,
  queryQuestionsSchema,
  updateQuestionSchema,
  type CreateQuestionDto,
  type ImportQuestionsDto,
  type QueryQuestionsDto,
  type UpdateQuestionDto,
} from './dto/cbt.dto';

@ApiTags('School - CBT Question Bank')
@Controller('school/cbt/questions')
@UseGuards(AccessGuard)
export class CbtQuestionsController {
  constructor(private readonly questions: CbtQuestionsService) {}

  @Get()
  @Permissions(PERMISSIONS.CBT_QUESTION_VIEW)
  @ApiOperation({ summary: 'List CBT questions for this school' })
  list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryQuestionsSchema)) query: QueryQuestionsDto,
  ) {
    return this.questions.list(req.tenant.id, query);
  }

  @Get('summary')
  @Permissions(PERMISSIONS.CBT_QUESTION_VIEW)
  @ApiOperation({ summary: 'Question bank counts by status, difficulty and subject' })
  summary(@Req() req: PermissionRequest) {
    return this.questions.summary(req.tenant.id);
  }

  @Get('template')
  @Permissions(PERMISSIONS.CBT_QUESTION_VIEW)
  @ApiOperation({ summary: 'Downloadable CSV import template' })
  template() {
    return this.questions.template();
  }

  @Post('import/preview')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Validate a CSV import without saving' })
  preview(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(importQuestionsSchema)) dto: ImportQuestionsDto,
  ) {
    return this.questions.importCsv(req.tenant.id, req.user.sub, {
      ...dto,
      dryRun: true,
    });
  }

  @Post('import')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Import validated CSV questions' })
  import(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(importQuestionsSchema)) dto: ImportQuestionsDto,
  ) {
    return this.questions.importCsv(req.tenant.id, req.user.sub, dto);
  }

  @Post('seed-defaults')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({
    summary: 'Load TGManager default practice banks for any missing category',
  })
  seedDefaults(@Req() req: PermissionRequest) {
    return this.questions.seedDefaults(req.tenant.id, req.user.sub);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CBT_QUESTION_VIEW)
  @ApiOperation({ summary: 'Get one question (includes correct answer)' })
  get(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.questions.get(req.tenant.id, id);
  }

  @Post()
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Create a CBT question' })
  create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createQuestionSchema)) dto: CreateQuestionDto,
  ) {
    return this.questions.create(req.tenant.id, req.user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Update a CBT question' })
  update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) dto: UpdateQuestionDto,
  ) {
    return this.questions.update(req.tenant.id, id, dto);
  }

  @Post(':id/archive')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Archive a question (keeps past attempt history intact)' })
  archive(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.questions.archive(req.tenant.id, id);
  }

  @Post(':id/restore')
  @Permissions(PERMISSIONS.CBT_QUESTION_MANAGE)
  @ApiOperation({ summary: 'Restore an archived question' })
  restore(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.questions.restore(req.tenant.id, id);
  }
}
