import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluate() {
    try {
      const pendingSteps = await this.prisma.workflowStepInstance.findMany({
        where: {
          status: 'PENDING',
          instance: { status: 'PENDING' },
        },
        include: {
          step: {
            include: { escalationRules: { orderBy: { priority: 'asc' } } },
          },
          instance: {
            select: { id: true, tenantId: true, title: true, createdAt: true },
          },
        },
      });

      for (const stepInstance of pendingSteps) {
        if (stepInstance.step.escalationRules.length === 0) continue;

        for (const rule of stepInstance.step.escalationRules) {
          const shouldEscalate = await this.checkTrigger(stepInstance, rule);
          if (shouldEscalate) {
            await this.workflows.escalateStep(
              stepInstance.instance.tenantId,
              stepInstance.instance.id,
              stepInstance.id,
              {
                type: rule.type,
                action: rule.action,
                targetUserId: rule.targetUserId,
              },
            );
            break;
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Escalation evaluation failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async checkTrigger(
    stepInstance: {
      assignedToUserId: string | null;
      instance: { createdAt: Date };
      step: {
        isRequired: boolean;
        dueInMinutes: number | null;
      };
    },
    rule: {
      trigger: string;
      timeoutMinutes: number;
    },
  ): Promise<boolean> {
    const now = new Date();

    if (rule.trigger === 'NO_RESPONSE') {
      const elapsed = now.getTime() - stepInstance.instance.createdAt.getTime();
      const timeoutMs = rule.timeoutMinutes * 60 * 1000;
      return elapsed >= timeoutMs;
    }

    if (rule.trigger === 'ABSENT' && stepInstance.assignedToUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: stepInstance.assignedToUserId },
        select: { isActive: true },
      });
      return user?.isActive === false;
    }

    if (rule.trigger === 'TIMEOUT') {
      const referenceTime = stepInstance.step.dueInMinutes
        ? new Date(
            stepInstance.instance.createdAt.getTime() +
              stepInstance.step.dueInMinutes * 60 * 1000,
          )
        : new Date(
            stepInstance.instance.createdAt.getTime() +
              rule.timeoutMinutes * 60 * 1000,
          );
      return now >= referenceTime;
    }

    return false;
  }
}
