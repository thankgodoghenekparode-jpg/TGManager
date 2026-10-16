import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { CbtAttemptsService } from './cbt-attempts.service';
import {
  saveAnswersSchema,
  startAttemptSchema,
  submitAttemptSchema,
  type SaveAnswersDto,
  type StartAttemptDto,
  type SubmitAttemptDto,
} from './dto/cbt.dto';

@ApiTags('School - CBT Attempts (student)')
@Controller('school/cbt/attempts')
@UseGuards(AccessGuard)
export class CbtAttemptsController {
  constructor(private readonly attempts: CbtAttemptsService) {}

  @Post('start')
  @Permissions(PERMISSIONS.CBT_TAKE)
  @ApiOperation({ summary: 'Start or resume an examination attempt' })
  start(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(startAttemptSchema)) dto: StartAttemptDto,
  ) {
    return this.attempts.start(req.tenant.id, req.user.sub, dto);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CBT_TAKE)
  @ApiOperation({ summary: 'Restore an in-progress attempt, or fetch its result' })
  getAttempt(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.attempts.getAttempt(req.tenant.id, req.user.sub, id);
  }

  @Post(':id/answers')
  @Permissions(PERMISSIONS.CBT_TAKE)
  @ApiOperation({ summary: 'Persist answers and review markers' })
  saveAnswers(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveAnswersSchema)) dto: SaveAnswersDto,
  ) {
    return this.attempts.saveAnswers(req.tenant.id, req.user.sub, id, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.CBT_TAKE)
  @ApiOperation({ summary: 'Submit an attempt — scored on the backend' })
  submit(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitAttemptSchema)) dto: SubmitAttemptDto,
  ) {
    return this.attempts.submit(req.tenant.id, req.user.sub, id, dto);
  }
}
