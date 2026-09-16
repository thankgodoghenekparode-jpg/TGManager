import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
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
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { IntegrationApiKeyGuard } from './guards/integration-api-key.guard';
import {
  createApiKeySchema,
  createWebhookSchema,
  integrationStartWorkflowSchema,
  integrationStepDataSchema,
  listDeliveriesSchema,
  type CreateApiKeyDto,
  type CreateWebhookDto,
  type IntegrationStartWorkflowDto,
  type IntegrationStepDataDto,
  type ListDeliveriesDto,
} from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    tenantId: string;
    permissions: string[];
  };
}

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post('api-keys')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'Create an API key',
    description:
      'Generates a new API key. The plaintext key is returned only once.',
  })
  @ApiBody({ schema: schemaRef('CreateApiKeyDto') })
  @ApiCreatedResponse({
    description: 'API key created (includes plaintext key).',
  })
  async createApiKey(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createApiKeySchema)) dto: CreateApiKeyDto,
  ) {
    return this.integrations.createApiKey(req.tenant.id, req.user.sub, dto);
  }

  @Get('api-keys')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'List API keys',
    description: 'Lists all API keys for the tenant (plaintext not shown).',
  })
  @ApiOkResponse({ description: 'List of API keys.' })
  async listApiKeys(@Req() req: PermissionRequest) {
    return this.integrations.listApiKeys(req.tenant.id);
  }

  @Delete('api-keys/:keyId')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke an API key',
    description: 'Deactivates an API key.',
  })
  @ApiParam({ name: 'keyId', type: String, description: 'API key ID' })
  @ApiNoContentResponse({ description: 'API key revoked.' })
  async revokeApiKey(
    @Req() req: PermissionRequest,
    @Param('keyId') keyId: string,
  ) {
    await this.integrations.revokeApiKey(req.tenant.id, req.user.sub, keyId);
  }

  @Post('webhooks')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'Create a webhook',
    description: 'Registers a webhook URL for receiving integration events.',
  })
  @ApiBody({ schema: schemaRef('CreateWebhookDto') })
  @ApiCreatedResponse({ description: 'Webhook created.' })
  async createWebhook(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createWebhookSchema)) dto: CreateWebhookDto,
  ) {
    return this.integrations.createWebhook(req.tenant.id, req.user.sub, dto);
  }

  @Get('webhooks')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'List webhooks',
    description: 'Lists all webhooks for the tenant.',
  })
  @ApiOkResponse({ description: 'List of webhooks.' })
  async listWebhooks(@Req() req: PermissionRequest) {
    return this.integrations.listWebhooks(req.tenant.id);
  }

  @Delete('webhooks/:webhookId')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a webhook',
    description: 'Deletes a webhook and its delivery history.',
  })
  @ApiParam({ name: 'webhookId', type: String, description: 'Webhook ID' })
  @ApiNoContentResponse({ description: 'Webhook deleted.' })
  async removeWebhook(
    @Req() req: PermissionRequest,
    @Param('webhookId') webhookId: string,
  ) {
    await this.integrations.removeWebhook(
      req.tenant.id,
      req.user.sub,
      webhookId,
    );
  }

  @Get('webhooks/:webhookId/deliveries')
  @UseGuards(TenantGuard, AbilitiesGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'List webhook deliveries',
    description: 'Lists delivery attempts for a webhook.',
  })
  @ApiParam({ name: 'webhookId', type: String, description: 'Webhook ID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'DELIVERED', 'FAILED'],
    description: 'Filter by delivery status',
  })
  @ApiOkResponse({ description: 'List of deliveries.' })
  async listDeliveries(
    @Req() req: PermissionRequest,
    @Param('webhookId') webhookId: string,
    @Query(new ZodValidationPipe(listDeliveriesSchema))
    query: ListDeliveriesDto,
  ) {
    return this.integrations.listDeliveries(
      req.tenant.id,
      webhookId,
      query.status,
    );
  }

  @Post('workflows/start')
  @UseGuards(IntegrationApiKeyGuard)
  @ApiSecurity('X-Api-Key')
  @ApiOperation({
    summary: 'Start a workflow (API key)',
    description: 'Starts a workflow instance using an integration API key.',
  })
  @ApiBody({ schema: schemaRef('IntegrationStartWorkflowDto') })
  @ApiCreatedResponse({ description: 'Workflow instance started.' })
  async startWorkflow(
    @Req() req: ApiKeyRequest,
    @Body(new ZodValidationPipe(integrationStartWorkflowSchema))
    dto: IntegrationStartWorkflowDto,
  ) {
    return this.integrations.startWorkflowFromIntegration(
      req.apiKey!.tenantId,
      req.apiKey!.id,
      dto,
    );
  }

  @Post('workflows/instances/:id/step-data')
  @UseGuards(IntegrationApiKeyGuard)
  @ApiSecurity('X-Api-Key')
  @ApiOperation({
    summary: 'Submit step data (API key)',
    description:
      'Submits structured data for the current workflow step via API key.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiBody({ schema: schemaRef('IntegrationStepDataDto') })
  @ApiOkResponse({ description: 'Step data submitted.' })
  async submitStepData(
    @Req() req: ApiKeyRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(integrationStepDataSchema))
    dto: IntegrationStepDataDto,
  ) {
    return this.integrations.submitStepDataFromIntegration(
      req.apiKey!.tenantId,
      req.apiKey!.id,
      id,
      dto,
    );
  }

  @Get('workflows/instances/:id')
  @UseGuards(IntegrationApiKeyGuard)
  @ApiSecurity('X-Api-Key')
  @ApiOperation({
    summary: 'Get workflow instance status (API key)',
    description: 'Polls the status of a workflow instance via API key.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Instance ID (UUID)' })
  @ApiOkResponse({ description: 'Workflow instance status.' })
  async getInstanceStatus(@Req() req: ApiKeyRequest, @Param('id') id: string) {
    return this.integrations.getInstanceStatus(req.apiKey!.tenantId, id);
  }
}
