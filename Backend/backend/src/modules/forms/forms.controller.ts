import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  Query,
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
  createFormSchema,
  listFormsSchema,
  submitFormSchema,
  updateFormSchema,
  type CreateFormDto,
  type ListFormsDto,
  type SubmitFormDto,
  type UpdateFormDto,
} from './dto/form.dto';
import { FormsService } from './forms.service';

@ApiTags('Forms')
@Controller('forms')
@UseGuards(TenantGuard, AbilitiesGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Post()
  @Permissions(PERMISSIONS.FORM_CREATE)
  @ApiOperation({
    summary: 'Create a form',
    description: 'Creates a new form with its fields.',
  })
  @ApiBody({ schema: schemaRef('CreateFormDto') })
  @ApiCreatedResponse({ description: 'Form created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createFormSchema)) dto: CreateFormDto,
  ) {
    return this.forms.create(req.tenant.id, req.user.sub, dto, req.abilities);
  }

  @Get()
  @Permissions(PERMISSIONS.FORM_VIEW)
  @ApiOperation({
    summary: 'List forms',
    description: 'Lists forms the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'published',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter by published state',
  })
  @ApiOkResponse({ description: 'List of forms.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listFormsSchema)) query: ListFormsDto,
  ) {
    return this.forms.list(req.tenant.id, req.abilities, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.FORM_VIEW)
  @ApiOperation({
    summary: 'Get a form',
    description: 'Returns a single form by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiOkResponse({ description: 'The requested form.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.forms.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.FORM_MANAGE)
  @ApiOperation({
    summary: 'Update a form',
    description: 'Partially updates a form and its fields by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateFormDto') })
  @ApiOkResponse({ description: 'Form updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFormSchema)) dto: UpdateFormDto,
  ) {
    return this.forms.update(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post(':id/publish')
  @Permissions(PERMISSIONS.FORM_MANAGE)
  @ApiOperation({
    summary: 'Publish a form',
    description: 'Marks a form as published so it can be submitted.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiOkResponse({ description: 'Form published.' })
  async publish(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.forms.publish(req.tenant.id, req.user.sub, id, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.FORM_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a form',
    description: 'Deletes a form by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiNoContentResponse({ description: 'Form deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.forms.remove(req.tenant.id, req.user.sub, id, req.abilities);
  }

  @Post(':id/submissions')
  @Permissions(PERMISSIONS.FORM_SUBMIT)
  @ApiOperation({
    summary: 'Submit a form',
    description: 'Submits a payload for a published form.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiBody({ schema: schemaRef('SubmitFormDto') })
  @ApiCreatedResponse({ description: 'Submission recorded.' })
  async submit(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitFormSchema)) dto: SubmitFormDto,
  ) {
    return this.forms.submit(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Get(':id/submissions')
  @Permissions(PERMISSIONS.FORM_VIEW)
  @ApiOperation({
    summary: 'List form submissions',
    description: 'Lists submissions for a form.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiOkResponse({ description: 'List of submissions.' })
  async listSubmissions(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
  ) {
    return this.forms.listSubmissions(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Get(':id/submissions/:submissionId')
  @Permissions(PERMISSIONS.FORM_VIEW)
  @ApiOperation({
    summary: 'Get a form submission',
    description: 'Returns a single submission for a form.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Form ID (UUID)' })
  @ApiParam({
    name: 'submissionId',
    type: String,
    description: 'Submission ID (UUID)',
  })
  @ApiOkResponse({ description: 'The requested submission.' })
  async getSubmission(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.forms.getSubmission(
      req.tenant.id,
      req.user.sub,
      id,
      submissionId,
      req.abilities,
    );
  }
}
