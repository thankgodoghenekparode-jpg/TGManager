import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateApiKeyDto,
  CreateWebhookDto,
  IntegrationStartWorkflowDto,
  IntegrationStepDataDto,
} from './dto/integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async createApiKey(tenantId: string, userId: string, dto: CreateApiKeyDto) {
    const rawKey = `zrx_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const key = await this.prisma.integrationApiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyPrefix,
        keyHash,
        permissions: dto.permissions ?? [],
      },
    });

    this.audit.record(tenantId, {
      userId,
      action: 'INTEGRATION_API_KEY_CREATE',
      entityType: 'IntegrationApiKey',
      entityId: key.id,
      metadata: { name: dto.name },
    });

    return { ...key, key: rawKey };
  }

  async listApiKeys(tenantId: string) {
    return this.prisma.integrationApiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(tenantId: string, userId: string, keyId: string) {
    const key = await this.prisma.integrationApiKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.isActive) {
      throw new BadRequestException('API key is already revoked');
    }

    await this.prisma.integrationApiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    this.audit.record(tenantId, {
      userId,
      action: 'INTEGRATION_API_KEY_REVOKE',
      entityType: 'IntegrationApiKey',
      entityId: keyId,
    });

    return { deleted: true };
  }

  async createWebhook(tenantId: string, userId: string, dto: CreateWebhookDto) {
    const webhook = await this.prisma.integrationWebhook.create({
      data: {
        tenantId,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
      },
    });

    this.audit.record(tenantId, {
      userId,
      action: 'INTEGRATION_WEBHOOK_CREATE',
      entityType: 'IntegrationWebhook',
      entityId: webhook.id,
      metadata: { url: dto.url },
    });

    return webhook;
  }

  async listWebhooks(tenantId: string) {
    return this.prisma.integrationWebhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    });
  }

  async removeWebhook(tenantId: string, userId: string, webhookId: string) {
    const webhook = await this.prisma.integrationWebhook.findFirst({
      where: { id: webhookId, tenantId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    await this.prisma.integrationWebhook.delete({
      where: { id: webhookId },
    });

    this.audit.record(tenantId, {
      userId,
      action: 'INTEGRATION_WEBHOOK_DELETE',
      entityType: 'IntegrationWebhook',
      entityId: webhookId,
    });

    return { deleted: true };
  }

  async listDeliveries(tenantId: string, webhookId: string, status?: string) {
    const webhook = await this.prisma.integrationWebhook.findFirst({
      where: { id: webhookId, tenantId },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.prisma.integrationDelivery.findMany({
      where: {
        webhookId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async startWorkflowFromIntegration(
    tenantId: string,
    apiKeyId: string,
    dto: IntegrationStartWorkflowDto,
  ) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: dto.templateId, tenantId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Active workflow template not found');
    }

    const branchId = dto.branchId ?? template.branchId ?? null;

    const instance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workflowInstance.create({
        data: {
          tenantId,
          templateId: template.id,
          branchId,
          title: dto.title,
          initiatedByUserId: 'integration',
          payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        },
      });

      for (const step of template.steps) {
        const assigneeUserId = await this.resolveAssignee(
          tx,
          tenantId,
          branchId,
          step,
        );
        if (assigneeUserId) {
          await tx.workflowStepInstance.create({
            data: {
              instanceId: created.id,
              stepId: step.id,
              assignedToUserId: assigneeUserId,
            },
          });
        }
      }

      return tx.workflowInstance.findFirst({
        where: { id: created.id },
        include: {
          stepInstances: {
            orderBy: { step: { order: 'asc' } },
            include: { step: true },
          },
        },
      });
    });

    this.audit.record(tenantId, {
      action: 'INTEGRATION_WORKFLOW_START',
      entityType: 'WorkflowInstance',
      entityId: instance?.id,
      metadata: {
        templateId: dto.templateId,
        apiKeyId,
        title: dto.title,
      },
    });

    await this.enqueueWebhookEvent(tenantId, 'workflow.instance.started', {
      instanceId: instance?.id,
      templateId: dto.templateId,
      title: dto.title,
      branchId,
    });

    return instance;
  }

  async submitStepDataFromIntegration(
    tenantId: string,
    apiKeyId: string,
    instanceId: string,
    dto: IntegrationStepDataDto,
  ) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId, status: 'PENDING' },
      include: {
        stepInstances: {
          orderBy: { step: { order: 'asc' } },
          include: { step: true },
        },
      },
    });
    if (!instance) throw new NotFoundException('Pending instance not found');

    const current = instance.stepInstances.find((s) => s.status === 'PENDING');
    if (!current) throw new BadRequestException('No pending step');

    const remaining = instance.stepInstances.filter(
      (s) => s.id !== current.id && s.status === 'PENDING',
    );
    const stepDone = remaining.length === 0;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.workflowStepInstance.update({
        where: { id: current.id },
        data: {
          status: 'COMPLETED',
          actionedAt: new Date(),
          data: dto.formData as Prisma.InputJsonValue,
          note: dto.note ?? null,
        },
      });

      const nextId = remaining[0]?.id ?? null;

      return tx.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: stepDone ? 'APPROVED' : 'PENDING',
          currentStepId: nextId,
        },
        include: {
          stepInstances: {
            orderBy: { step: { order: 'asc' } },
            include: { step: true },
          },
        },
      });
    });

    this.audit.record(tenantId, {
      action: 'INTEGRATION_WORKFLOW_STEP_COMPLETE',
      entityType: 'WorkflowStepInstance',
      entityId: current.id,
      metadata: { instanceId, apiKeyId },
    });

    await this.enqueueWebhookEvent(
      tenantId,
      stepDone ? 'workflow.instance.approved' : 'workflow.step.completed',
      {
        instanceId,
        stepId: current.stepId,
        status: result.status,
      },
    );

    return result;
  }

  async getInstanceStatus(tenantId: string, instanceId: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
      include: {
        stepInstances: {
          orderBy: { step: { order: 'asc' } },
          include: { step: true },
        },
      },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return instance;
  }

  async enqueueWebhookEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const webhooks = await this.prisma.integrationWebhook.findMany({
      where: { tenantId, isActive: true, events: { has: eventType } },
    });

    for (const webhook of webhooks) {
      await this.prisma.integrationDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType,
          payload: payload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });
    }
  }

  async processPendingDeliveries() {
    const deliveries = await this.prisma.integrationDelivery.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      include: { webhook: true },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const delivery of deliveries) {
      await this.deliver(delivery);
    }
  }

  private async deliver(delivery: {
    id: string;
    webhook: { url: string; secret: string };
    eventType: string;
    payload: unknown;
    attempts: number;
  }) {
    const body = JSON.stringify({
      event: delivery.eventType,
      payload: delivery.payload,
      timestamp: new Date().toISOString(),
    });

    const signature = createHmac('sha256', delivery.webhook.secret)
      .update(body)
      .digest('hex');

    try {
      const response = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        await this.prisma.integrationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'DELIVERED',
            attempts: delivery.attempts + 1,
            deliveredAt: new Date(),
          },
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const attempts = delivery.attempts + 1;
      await this.prisma.integrationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: attempts >= 3 ? 'FAILED' : 'PENDING',
          attempts,
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async resolveAssignee(
    tx: Prisma.TransactionClient,
    tenantId: string,
    branchId: string | null,
    step: {
      assigneeRuleType: string;
      assigneeUserId?: string | null;
      assigneeCompanyRoleId?: string | null;
    },
  ): Promise<string | null> {
    if (step.assigneeRuleType === 'USER') {
      return step.assigneeUserId ?? null;
    }
    if (
      step.assigneeRuleType === 'COMPANY_ROLE' &&
      step.assigneeCompanyRoleId
    ) {
      const assignment = await tx.roleAssignment.findFirst({
        where: {
          tenantId,
          companyRoleId: step.assigneeCompanyRoleId,
          OR: [{ branchId: null }, { branchId: branchId ?? undefined }],
        },
      });
      return assignment?.userId ?? null;
    }
    return null;
  }
}
