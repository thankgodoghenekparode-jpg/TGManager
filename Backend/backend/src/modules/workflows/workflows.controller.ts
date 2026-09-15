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
  createWorkflowTemplateSchema,
  delegateStepSchema,
  listWorkflowInstancesSchema,
  listWorkflowTemplatesSchema,
  startWorkflowInstanceSchema,
  updateWorkflowTemplateSchema,
  workflowActionBodySchema,
  type CreateWorkflowTemplateDto,
  type DelegateStepDto,
  type ListWorkflowInstancesDto,
  type ListWorkflowTemplatesDto,
  type StartWorkflowInstanceDto,
  type UpdateWorkflowTemplateDto,
  type WorkflowActionBodyDto,
} from './dto/workflow.dto';
import { WorkflowsService } from './workflows.service';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(TenantGuard, AbilitiesGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post('templates')
  @Permissions(PERMISSIONS.WORKFLOW_CREATE)
  @ApiOperation({
    summary: 'Create a workflow template',
    description: 'Creates a workflow template with its approval steps.',
  })
  @ApiBody({ schema: schemaRef('CreateWorkflowTemplateDto') })
  @ApiCreatedResponse({ description: 'Workflow template created.' })
  async createTemplate(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createWorkflowTemplateSchema))
    dto: CreateWorkflowTemplateDto,
  ) {
    return this.workflows.createTemplate(
      req.tenant.id,
      req.user.sub,
      dto,
      req.abilities,
    );
  }

  @Get('templates')
  @Permissions(PERMISSIONS.WORKFLOW_VIEW)
  @ApiOperation({
    summary: 'List workflow templates',
    description:
      'Lists workflow templates with branch and active-state filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter by active state',
  })
  @ApiOkResponse({ description: 'List of workflow templates.' })
  async listTemplates(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listWorkflowTemplatesSchema))
    query: ListWorkflowTemplatesDto,
  ) {
    return this.workflows.listTemplates(req.tenant.id, req.abilities, query);
  }

  @Get('templates/:id')
  @Permissions(PERMISSIONS.WORKFLOW_VIEW)
  @ApiOperation({
    summary: 'Get a workflow template',
    description: 'Returns a single workflow template by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Template ID (UUID)' })
  @ApiOkResponse({ description: 'The requested workflow template.' })
  async getTemplate(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.workflows.getTemplate(req.tenant.id, id, req.abilities);
  }

  @Patch('templates/:id')
  @Permissions(PERMISSIONS.WORKFLOW_CREATE)
  @ApiOperation({
    summary: 'Update a workflow template',
    description: 'Partially updates a workflow template by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Template ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateWorkflowTemplateDto') })
  @ApiOkResponse({ description: 'Workflow template updated.' })
  async updateTemplate(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWorkflowTemplateSchema))
    dto: UpdateWorkflowTemplateDto,
  ) {
    return this.workflows.updateTemplate(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Delete('templates/:id')
  @Permissions(PERMISSIONS.WORKFLOW_CREATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a workflow template',
    description: 'Deletes a workflow template by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Template ID (UUID)' })
  @ApiNoContentResponse({ description: 'Workflow template deleted.' })
  async removeTemplate(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.workflows.removeTemplate(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Get('approvals')
  @Permissions(PERMISSIONS.WORKFLOW_APPROVE)
  @ApiOperation({
    summary: 'List my approvals',
    description:
      'Lists workflow instances awaiting action by the current user.',
  })
  @ApiOkResponse({ description: 'List of pending approvals.' })
  async myApprovals(@Req() req: PermissionRequest) {
    return this.workflows.myApprovals(
      req.tenant.id,
      req.user.sub,
      req.abilities,
    );
  }

  @Post('instances')
  @Permissions(PERMISSIONS.WORKFLOW_SUBMIT)
  @ApiOperation({
    summary: 'Start a workflow instance',
    description: 'Starts a new workflow instance from a template.',
  })
  @ApiBody({ schema: schemaRef('StartWorkflowInstanceDto') })
  @ApiCreatedResponse({ description: 'Workflow instance started.' })
  async startInstance(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(startWorkflowInstanceSchema))
    dto: StartWorkflowInstanceDto,
  ) {
    return this.workflows.startInstance(
      req.tenant.id,
      req.user.sub,
      dto,
      req.abilities,
    );
  }

  @Get('instances')
  @Permissions(PERMISSIONS.WORKFLOW_VIEW)
  @ApiOperation({
    summary: 'List workflow instances',
    description:
      'Lists workflow instances with status, template, branch, and ownership filters.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'templateId',
    required: false,
    type: String,
    description: 'Filter by template ID',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'mine',
    required: false,
    enum: ['true'],
    description: 'Filter to instances assigned to the current user',
  })
  @ApiOkResponse({ description: 'List of workflow instances.' })
  async listInstances(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listWorkflowInstancesSchema))
    query: ListWorkflowInstancesDto,
  ) {
    return this.workflows.listInstances(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get('instances/:id')
  @Permissions(PERMISSIONS.WORKFLOW_VIEW)
  @ApiOperation({
    summary: 'Get a workflow instance',
    description: 'Returns a single workflow instance by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiOkResponse({ description: 'The requested workflow instance.' })
  async getInstance(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.workflows.getInstance(
      req.tenant.id,
      id,
      req.user.sub,
      req.abilities,
    );
  }

  @Post('instances/:id/approve')
  @Permissions(PERMISSIONS.WORKFLOW_APPROVE)
  @ApiOperation({
    summary: 'Approve a workflow instance',
    description: 'Approves the current step of a workflow instance.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('WorkflowActionBodyDto') })
  @ApiOkResponse({ description: 'Workflow instance approved.' })
  async approve(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(workflowActionBodySchema))
    dto: WorkflowActionBodyDto,
  ) {
    return this.workflows.approve(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post('instances/:id/reject')
  @Permissions(PERMISSIONS.WORKFLOW_APPROVE)
  @ApiOperation({
    summary: 'Reject a workflow instance',
    description: 'Rejects the current step of a workflow instance.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('WorkflowActionBodyDto') })
  @ApiOkResponse({ description: 'Workflow instance rejected.' })
  async reject(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(workflowActionBodySchema))
    dto: WorkflowActionBodyDto,
  ) {
    return this.workflows.reject(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post('instances/:id/execute')
  @Permissions(PERMISSIONS.WORKFLOW_EXECUTE)
  @ApiOperation({
    summary: 'Execute a workflow instance step',
    description:
      'Executes the current step of a workflow instance. Only IT Manager or Account Assist roles may execute a step.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('WorkflowActionBodyDto') })
  @ApiOkResponse({ description: 'Workflow step executed.' })
  async execute(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(workflowActionBodySchema))
    dto: WorkflowActionBodyDto,
  ) {
    return this.workflows.execute(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post('instances/:id/complete')
  @Permissions(PERMISSIONS.WORKFLOW_VIEW)
  @ApiOperation({
    summary: 'Complete a non-approval step',
    description:
      'Completes a CLOSURE / ACKNOWLEDGE / PROVIDE_INFO / SUBMISSION step as the assigned user. The caller must be the step assignee or a company admin.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('WorkflowActionBodyDto') })
  @ApiOkResponse({ description: 'Workflow step completed.' })
  async complete(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(workflowActionBodySchema))
    dto: WorkflowActionBodyDto,
  ) {
    return this.workflows.complete(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post('instances/:id/cancel')
  @Permissions(PERMISSIONS.WORKFLOW_SUBMIT)
  @ApiOperation({
    summary: 'Cancel a workflow instance',
    description: 'Cancels a workflow instance by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiOkResponse({ description: 'Workflow instance cancelled.' })
  async cancel(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.workflows.cancel(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Post('instances/:id/delegate')
  @Permissions(PERMISSIONS.WORKFLOW_APPROVE)
  @ApiOperation({
    summary: 'Delegate a workflow step',
    description:
      'Delegates the current step to another user. Delegation is final.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('DelegateStepDto') })
  @ApiOkResponse({ description: 'Step delegated.' })
  async delegate(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(delegateStepSchema))
    dto: DelegateStepDto,
  ) {
    return this.workflows.delegate(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }
}
