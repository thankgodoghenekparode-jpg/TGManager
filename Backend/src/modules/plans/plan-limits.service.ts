import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlanUsage {
  branches: number;
  staff: number;
  documents: number;
  storageBytes: string;
  chatMessages: number;
  departments: number;
  groups: number;
  memos: number;
  forms: number;
  formSubmissions: number;
  workflows: number;
  inventoryItems: number;
  conversations: number;
  auditLogs: number;
}

const RESOURCE_LABELS: Record<string, string> = {
  branches: 'branches',
  staff: 'staff members',
  documents: 'documents',
  chatMessages: 'chat messages',
};

/**
 * Centralized plan-limit enforcement. All resource-limit checks funnel through
 * here so that error responses are consistent and always carry an upgrade hint.
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPlan(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          select: {
            name: true,
            maxBranches: true,
            maxStaff: true,
            maxDocuments: true,
            maxStorageBytes: true,
            maxChatMessages: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }
    return tenant.plan;
  }

  private limitError(
    resource: string,
    max: number,
    planName: string,
  ): ForbiddenException {
    const label = RESOURCE_LABELS[resource] ?? resource;
    return new ForbiddenException(
      `Plan "${planName}" allows up to ${max} ${label}. ` +
        `Upgrade your plan to increase this limit.`,
    );
  }

  async enforceBranchLimit(tenantId: string): Promise<void> {
    const plan = await this.getPlan(tenantId);
    if (plan.maxBranches === null) return;
    const count = await this.prisma.branch.count({ where: { tenantId } });
    if (count >= plan.maxBranches) {
      throw this.limitError('branches', plan.maxBranches, plan.name);
    }
  }

  async enforceStaffLimit(tenantId: string): Promise<void> {
    const plan = await this.getPlan(tenantId);
    if (plan.maxStaff === null) return;
    const count = await this.prisma.staffRecord.count({ where: { tenantId } });
    if (count >= plan.maxStaff) {
      throw this.limitError('staff', plan.maxStaff, plan.name);
    }
  }

  async enforceDocumentLimits(
    tenantId: string,
    newSizeBytes: bigint,
  ): Promise<void> {
    const plan = await this.getPlan(tenantId);

    if (plan.maxDocuments !== null) {
      const count = await this.prisma.document.count({
        where: { tenantId, deletedAt: null },
      });
      if (count >= plan.maxDocuments) {
        throw this.limitError('documents', plan.maxDocuments, plan.name);
      }
    }

    if (plan.maxStorageBytes !== null) {
      await this.enforceStorageLimit(tenantId, newSizeBytes);
    }
  }

  async enforceStorageLimit(
    tenantId: string,
    newSizeBytes: bigint,
  ): Promise<void> {
    const plan = await this.getPlan(tenantId);
    if (plan.maxStorageBytes === null) return;

    const agg = await this.prisma.document.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    const used = agg._sum.sizeBytes ?? BigInt(0);
    if (used + newSizeBytes > plan.maxStorageBytes) {
      throw new ForbiddenException(
        `Plan "${plan.name}" storage limit exceeded. ` +
          `Upgrade your plan to increase your storage quota.`,
      );
    }
  }

  async enforceChatMessagesLimit(tenantId: string): Promise<void> {
    const plan = await this.getPlan(tenantId);
    if (plan.maxChatMessages === null) return;
    const count = await this.prisma.message.count({
      where: { conversation: { tenantId } },
    });
    if (count >= plan.maxChatMessages) {
      throw this.limitError('chatMessages', plan.maxChatMessages, plan.name);
    }
  }

  /**
   * Returns the current resource usage for a tenant, used by the platform
   * administration UI and dashboards.
   */
  async getUsage(tenantId: string): Promise<PlanUsage> {
    const [
      branches,
      staff,
      documents,
      storageAgg,
      chatMessages,
      departments,
      groups,
      memos,
      forms,
      formSubmissions,
      workflows,
      inventoryItems,
      conversations,
      auditLogs,
    ] = await this.prisma.$transaction([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.staffRecord.count({ where: { tenantId } }),
      this.prisma.document.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.document.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
      this.prisma.message.count({
        where: { conversation: { tenantId } },
      }),
      this.prisma.department.count({ where: { tenantId } }),
      this.prisma.group.count({ where: { tenantId } }),
      this.prisma.memo.count({ where: { tenantId } }),
      this.prisma.form.count({ where: { tenantId } }),
      this.prisma.formSubmission.count({ where: { tenantId } }),
      this.prisma.workflowTemplate.count({ where: { tenantId } }),
      this.prisma.inventoryItem.count({ where: { tenantId } }),
      this.prisma.conversation.count({ where: { tenantId } }),
      this.prisma.auditLog.count({ where: { tenantId } }),
    ]);

    return {
      branches,
      staff,
      documents,
      storageBytes: (storageAgg._sum.sizeBytes ?? BigInt(0)).toString(),
      chatMessages,
      departments,
      groups,
      memos,
      forms,
      formSubmissions,
      workflows,
      inventoryItems,
      conversations,
      auditLogs,
    };
  }
}
