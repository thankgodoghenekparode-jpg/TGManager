import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import {
  decodeCursor,
  paginate,
} from '../../common/pagination/pagination.util';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateWorkflowTemplateDto,
  DelegateStepDto,
  ListWorkflowInstancesDto,
  ListWorkflowTemplatesDto,
  StartWorkflowInstanceDto,
  UpdateWorkflowTemplateDto,
  WorkflowActionBodyDto,
} from './dto/workflow.dto';

type StepInput = {
  name: string;
  order: number;
  action: string;
  assigneeRuleType: string;
  assigneeCompanyRoleId?: string | null;
  assigneeUserId?: string | null;
  isFinal: boolean;
  isRequired?: boolean;
  dueInMinutes?: number | null;
  escalationRules?: {
    type: string;
    trigger: string;
    timeoutMinutes: number;
    action: string;
    targetUserId?: string | null;
    priority?: number;
  }[];
};

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async canStartWorkflow(
    tenantId: string,
    userId: string,
  ): Promise<boolean> {
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: {
        tenantId,
        userId,
        companyRole: {
          OR: [
            { name: { contains: 'Secretary', mode: 'insensitive' } },
            {
              AND: [
                { name: { contains: 'Account', mode: 'insensitive' } },
                { name: { contains: 'assist', mode: 'insensitive' } },
              ],
            },
          ],
        },
      },
      select: { id: true },
    });
    return !!assignment;
  }

  async createTemplate(
    tenantId: string,
    userId: string,
    dto: CreateWorkflowTemplateDto,
    abilities: AbilitiesContext,
  ) {
    if (dto.branchId) {
      await this.assertBranchAccess(tenantId, dto.branchId, abilities);
    }
    if (dto.formId) {
      await this.assertFormExists(tenantId, dto.formId);
    }
    this.validateSteps(dto.steps);

    return this.prisma.workflowTemplate.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        createdByUserId: userId,
        name: dto.name,
        description: dto.description ?? null,
        formId: dto.formId ?? null,
        steps: {
          create: dto.steps.map((s) => this.stepData(s)),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { escalationRules: true },
        },
        form: { select: { id: true, name: true } },
      },
    });
  }

  async listTemplates(
    tenantId: string,
    abilities: AbilitiesContext,
    query: ListWorkflowTemplatesDto,
  ) {
    const where: Prisma.WorkflowTemplateWhereInput = { tenantId };
    if (query.branchId) where.branchId = query.branchId;
    if (query.active === 'true') where.isActive = true;
    if (query.active === 'false') where.isActive = false;
    if (abilities.accessibleBranchIds !== null) {
      where.OR = [
        { branchId: null },
        { branchId: { in: abilities.accessibleBranchIds } },
      ];
    }

    return this.prisma.workflowTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { escalationRules: true },
        },
        form: { select: { id: true, name: true } },
        _count: { select: { instances: true } },
      },
    });
  }

  async getTemplate(
    tenantId: string,
    templateId: string,
    abilities: AbilitiesContext,
  ) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { escalationRules: true },
        },
        form: { select: { id: true, name: true, fields: true } },
        _count: { select: { instances: true } },
      },
    });
    if (!template) throw new NotFoundException('Workflow template not found');
    this.assertRecordBranchAccess(template.branchId, abilities);
    return template;
  }

  async updateTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
    dto: UpdateWorkflowTemplateDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { steps: true },
    });
    if (!existing) throw new NotFoundException('Workflow template not found');
    this.assertManage(existing, userId, abilities);
    if (dto.steps) this.validateSteps(dto.steps);
    if (dto.formId) {
      await this.assertFormExists(tenantId, dto.formId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.steps) {
        await tx.workflowEscalation.deleteMany({
          where: { step: { templateId } },
        });
        await tx.workflowStep.deleteMany({ where: { templateId } });
      }
      return tx.workflowTemplate.update({
        where: { id: templateId },
        data: {
          name: dto.name,
          description: dto.description === null ? null : dto.description,
          isActive: dto.isActive,
          formId: dto.formId === null ? null : dto.formId,
          steps: dto.steps
            ? {
                create: dto.steps.map((s) => ({
                  ...this.stepData(s),
                  escalationRules: s.escalationRules
                    ? {
                        create: s.escalationRules.map((e) => ({
                          type: e.type,
                          trigger: e.trigger,
                          timeoutMinutes: e.timeoutMinutes,
                          action: e.action,
                          targetUserId: e.targetUserId ?? null,
                          priority: e.priority ?? 0,
                        })),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: { escalationRules: true },
          },
        },
      });
    });
  }

  async removeTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!existing) throw new NotFoundException('Workflow template not found');
    this.assertManage(existing, userId, abilities);
    await this.prisma.workflowTemplate.delete({ where: { id: templateId } });
  }

  async startInstance(
    tenantId: string,
    userId: string,
    dto: StartWorkflowInstanceDto,
    abilities: AbilitiesContext,
  ) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: dto.templateId, tenantId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Active workflow template not found');
    }
    this.assertRecordBranchAccess(template.branchId, abilities);

    if (dto.submissionId) {
      const submission = await this.prisma.formSubmission.findFirst({
        where: { id: dto.submissionId, tenantId },
        select: { id: true, formId: true },
      });
      if (!submission) {
        throw new BadRequestException('Linked form submission not found');
      }
      if (template.formId && submission.formId !== template.formId) {
        throw new BadRequestException(
          'The linked submission does not belong to this template form',
        );
      }
    }

    const canStart = await this.canStartWorkflow(tenantId, userId);
    if (!canStart) {
      throw new ForbiddenException(
        'Only a Secretary or Account Assist can start a workflow flow.',
      );
    }

    const branchId = dto.branchId ?? template.branchId ?? null;
    if (branchId) {
      await this.assertBranchAccess(tenantId, branchId, abilities);
    }

    const instance = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workflowInstance.create({
        data: {
          tenantId,
          templateId: template.id,
          branchId,
          title: dto.title,
          refNumber: dto.refNumber ?? null,
          parentRefNumber: dto.parentRefNumber ?? null,
          submissionId: dto.submissionId ?? null,
          initiatedByUserId: userId,
          payload: {
            ...(dto.payload ?? {}),
            refNumber: dto.refNumber ?? null,
            parentRefNumber: dto.parentRefNumber ?? null,
          },
        },
      });

      const stepInstances = [];
      for (const step of template.steps) {
        const assignedToUserId = await this.resolveAssignee(
          tx,
          tenantId,
          userId,
          branchId,
          step,
        );
        if (!assignedToUserId) {
          throw new BadRequestException(
            `Step "${step.name}" has no resolvable assignee`,
          );
        }
        const si = await tx.workflowStepInstance.create({
          data: {
            instanceId: created.id,
            stepId: step.id,
            assignedToUserId,
          },
        });
        stepInstances.push(si);
      }

      // Starting the flow IS the secretary's submission: the form is already
      // stored, so Submission steps are complete by definition. Auto-complete
      // them and advance straight to the first pending approver/executor step.
      const submissionStepIds = new Set<string>();
      for (const si of stepInstances) {
        const stepOf = template.steps.find((s) => s.id === si.stepId);
        if (stepOf?.action === 'SUBMISSION') {
          await tx.workflowStepInstance.update({
            where: { id: si.id },
            data: {
              status: 'COMPLETED',
              actionedById: userId,
              actionedAt: new Date(),
            },
          });
          submissionStepIds.add(si.id);
        }
      }
      const firstPending =
        stepInstances.find((si) => !submissionStepIds.has(si.id))?.id ?? null;

      return tx.workflowInstance.update({
        where: { id: created.id },
        data: {
          currentStepId: firstPending,
          status: firstPending ? 'PENDING' : 'APPROVED',
        },
        include: {
          stepInstances: {
            orderBy: { step: { order: 'asc' } },
            include: {
              step: { include: { escalationRules: true } },
              assignedToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          initiatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    const firstAssignee = instance.stepInstances.find(
      (s) => s.status === 'PENDING',
    )?.assignedToUserId;
    const done = instance.stepInstances.every((s) => s.status !== 'PENDING');
    if (firstAssignee && !done) {
      await this.notifications.create(tenantId, {
        userId: firstAssignee,
        type: 'WORKFLOW_PENDING',
        title: 'Workflow awaiting your approval',
        body: instance.title,
        data: { instanceId: instance.id, templateId: template.id },
      });
    }
    this.audit.record(tenantId, {
      userId,
      action: 'WORKFLOW_INSTANCE_START',
      entityType: 'WorkflowInstance',
      entityId: instance.id,
      metadata: { templateId: template.id, title: instance.title },
    });

    return instance;
  }

  async listInstances(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: ListWorkflowInstancesDto,
  ) {
    const where: Prisma.WorkflowInstanceWhereInput = { tenantId };
    if (query.status) where.status = query.status;
    if (query.templateId) where.templateId = query.templateId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.mine === 'true') where.initiatedByUserId = userId;
    if (abilities.accessibleBranchIds !== null) {
      where.OR = [
        { branchId: null },
        { branchId: { in: abilities.accessibleBranchIds } },
      ];
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const cursor = decodeCursor(query.cursor);

    const rows = await this.prisma.workflowInstance.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        stepInstances: {
          orderBy: { step: { order: 'asc' } },
          include: {
            step: { include: { escalationRules: true } },
            assignedToUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return paginate(rows, limit);
  }

  async getInstance(
    tenantId: string,
    instanceId: string,
    userId: string,
    abilities: AbilitiesContext,
  ) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
      include: {
        stepInstances: {
          orderBy: { step: { order: 'asc' } },
          include: {
            step: { include: { escalationRules: true } },
            assignedToUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            actionedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        template: {
          select: {
            id: true,
            name: true,
            form: { select: { id: true, name: true, fields: true } },
          },
        },
        submission: {
          select: {
            id: true,
            refNumber: true,
            parentRefNumber: true,
            formId: true,
            data: true,
          },
        },
      },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    this.assertRecordBranchAccess(instance.branchId, abilities);

    // Expose the current step so the frontend can render the approver's own
    // role-gated form section for inline fill and the correct action button.
    // Prefer the step referenced by currentStepId; fall back to the first
    // pending step for legacy instances with a stale pointer.
    const currentStep =
      instance.stepInstances.find((s) => s.id === instance.currentStepId) ??
      instance.stepInstances.find((s) => s.status === 'PENDING');
    if (currentStep?.step?.assigneeCompanyRoleId) {
      const role = await this.prisma.companyRole.findUnique({
        where: { id: currentStep.step.assigneeCompanyRoleId },
        select: { name: true },
      });
      (instance as unknown as { stepRoleKey?: string | null }).stepRoleKey =
        role ? this.mapRoleNameToKey(role.name) : null;
    } else {
      (instance as unknown as { stepRoleKey?: string | null }).stepRoleKey =
        null;
    }
    const extra = instance as unknown as {
      currentStepAction?: string | null;
      currentStepName?: string | null;
      canAct?: boolean;
    };
    extra.currentStepAction = currentStep?.step?.action ?? null;
    extra.currentStepName = currentStep?.step?.name ?? null;
    extra.canAct =
      instance.status === 'PENDING'
        ? currentStep?.assignedToUserId === userId ||
          currentStep?.delegatedToUserId === userId ||
          abilities.isCompanyAdmin ||
          (currentStep?.step?.assigneeCompanyRoleId
            ? await this.userHoldsStepRole(
                tenantId,
                instance.branchId,
                userId,
                currentStep.step.assigneeCompanyRoleId,
              )
            : false)
        : false;

    return instance;
  }

  async myApprovals(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
  ) {
    const roleAssignments = await this.prisma.roleAssignment.findMany({
      where: { tenantId, userId },
      select: { companyRoleId: true },
    });
    const roleIds = [...new Set(roleAssignments.map((r) => r.companyRoleId))];
    const stepInstances = await this.prisma.workflowStepInstance.findMany({
      where: {
        OR: [
          { assignedToUserId: userId },
          { delegatedToUserId: userId },
          ...(roleIds.length > 0
            ? [{ step: { assigneeCompanyRoleId: { in: roleIds } } }]
            : []),
        ],
        status: 'PENDING',
        instance: {
          tenantId,
          status: 'PENDING',
          ...(abilities.accessibleBranchIds !== null
            ? {
                OR: [
                  { branchId: null },
                  { branchId: { in: abilities.accessibleBranchIds } },
                ],
              }
            : {}),
        },
      },
      orderBy: { instance: { createdAt: 'desc' } },
      include: {
        instance: {
          include: {
            template: {
              select: { id: true, name: true, version: true },
            },
            initiatedByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        step: { include: { escalationRules: true } },
      },
    });

    return stepInstances;
  }

  async approve(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: WorkflowActionBodyDto,
    abilities: AbilitiesContext,
  ) {
    return this.act(tenantId, userId, instanceId, dto, abilities, 'approve');
  }

  async reject(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: WorkflowActionBodyDto,
    abilities: AbilitiesContext,
  ) {
    return this.act(tenantId, userId, instanceId, dto, abilities, 'reject');
  }

  async execute(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: WorkflowActionBodyDto,
    abilities: AbilitiesContext,
  ) {
    return this.act(tenantId, userId, instanceId, dto, abilities, 'execute');
  }

  /** Complete a non-approval step (CLOSURE / ACKNOWLEDGE / PROVIDE_INFO) as the
   *  assigned user.  Gated by WORKFLOW_VIEW + assignee check instead of the
   *  heavier WORKFLOW_EXECUTE / WORKFLOW_APPROVE permissions so that roles such
   *  as Secretary can close their own steps. */
  async complete(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: WorkflowActionBodyDto,
    abilities: AbilitiesContext,
  ) {
    return this.act(tenantId, userId, instanceId, dto, abilities, 'execute');
  }

  async cancel(
    tenantId: string,
    userId: string,
    instanceId: string,
    abilities: AbilitiesContext,
  ) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    this.assertRecordBranchAccess(instance.branchId, abilities);

    if (instance.initiatedByUserId !== userId && !abilities.isCompanyAdmin) {
      throw new ForbiddenException(
        'Only the initiator can cancel this workflow',
      );
    }
    if (instance.status !== 'PENDING') {
      throw new BadRequestException('Only pending workflows can be cancelled');
    }

    return this.prisma.workflowInstance
      .update({
        where: { id: instanceId },
        data: { status: 'CANCELLED', currentStepId: null },
        include: {
          stepInstances: { orderBy: { step: { order: 'asc' } } },
        },
      })
      .then((result) => {
        this.audit.record(tenantId, {
          userId,
          action: 'WORKFLOW_INSTANCE_CANCEL',
          entityType: 'WorkflowInstance',
          entityId: instance.id,
          metadata: { title: instance.title },
        });
        return result;
      });
  }

  async delegate(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: DelegateStepDto,
    abilities: AbilitiesContext,
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
    if (!instance)
      throw new NotFoundException('Pending workflow instance not found');
    this.assertRecordBranchAccess(instance.branchId, abilities);

    const current = instance.stepInstances.find((s) => s.status === 'PENDING');
    if (!current) {
      throw new BadRequestException('Workflow has no pending step');
    }

    const isAssignee =
      (current.assignedToUserId !== null &&
        current.assignedToUserId === userId) ||
      (current.delegatedToUserId !== null &&
        current.delegatedToUserId === userId);
    if (!isAssignee && !abilities.isCompanyAdmin) {
      throw new ForbiddenException('You are not assigned to the current step');
    }

    if (dto.delegatedToUserId === userId) {
      throw new BadRequestException('Cannot delegate to yourself');
    }

    const targetUser = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId: dto.delegatedToUserId },
      },
    });
    if (!targetUser) {
      throw new BadRequestException(
        'Target user is not a member of this tenant',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.workflowStepInstance.update({
        where: { id: current.id },
        data: {
          originalAssignedToUserId:
            current.originalAssignedToUserId ?? current.assignedToUserId,
          assignedToUserId: dto.delegatedToUserId,
          delegatedToUserId: dto.delegatedToUserId,
        },
      });

      await tx.workflowStepInstance.update({
        where: { id: current.id },
        data: {
          note: dto.note
            ? `[Delegated] ${dto.note}`
            : `[Delegated from ${current.assignedToUserId}]`,
        },
      });

      return updated;
    });

    await this.notifications.create(tenantId, {
      userId: dto.delegatedToUserId,
      type: 'WORKFLOW_DELEGATED',
      title: 'Workflow step delegated to you',
      body: instance.title,
      data: { instanceId, stepInstanceId: current.id },
    });

    this.audit.record(tenantId, {
      userId,
      action: 'WORKFLOW_STEP_DELEGATE',
      entityType: 'WorkflowStepInstance',
      entityId: current.id,
      metadata: {
        instanceId,
        delegatedToUserId: dto.delegatedToUserId,
        note: dto.note ?? null,
      },
    });

    return result;
  }

  private async act(
    tenantId: string,
    userId: string,
    instanceId: string,
    dto: WorkflowActionBodyDto,
    abilities: AbilitiesContext,
    action: 'approve' | 'reject' | 'execute',
  ) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId, status: 'PENDING' },
      include: {
        stepInstances: {
          orderBy: { step: { order: 'asc' } },
          include: { step: true },
        },
        template: {
          select: {
            id: true,
            formId: true,
            form: { select: { id: true, fields: true } },
          },
        },
      },
    });
    if (!instance)
      throw new NotFoundException('Pending workflow instance not found');
    this.assertRecordBranchAccess(instance.branchId, abilities);

    const instanceRef = instance;
    const current =
      instance.stepInstances.find((s) => s.id === instance.currentStepId) ??
      instance.stepInstances.find((s) => s.status === 'PENDING');
    if (!current) {
      throw new BadRequestException('Workflow has no pending step');
    }

    const isAssignee =
      (current.assignedToUserId !== null &&
        current.assignedToUserId === userId) ||
      (current.delegatedToUserId !== null &&
        current.delegatedToUserId === userId);
    const isRoleHolder =
      !!current.step?.assigneeCompanyRoleId &&
      (await this.userHoldsStepRole(
        tenantId,
        instance.branchId,
        userId,
        current.step.assigneeCompanyRoleId,
      ));
    if (!isAssignee && !isRoleHolder && !abilities.isCompanyAdmin) {
      throw new ForbiddenException('You are not assigned to the current step');
    }

    const stepRoleId = current.step?.assigneeCompanyRoleId ?? null;
    let stepRoleKey: string | null = null;
    if (stepRoleId) {
      const role = await this.prisma.companyRole.findUnique({
        where: { id: stepRoleId },
        select: { name: true },
      });
      stepRoleKey = role ? this.mapRoleNameToKey(role.name) : null;
    }
    const formFieldsForStep =
      (instance.template?.form?.fields as
        { key: string; roleKey?: string | null }[] | undefined) ?? [];
    const allowedKeys = this.allowedRoleKeys(formFieldsForStep, stepRoleKey);

    const remaining = instance.stepInstances.filter(
      (s) => s.id !== current.id && s.status === 'PENDING',
    );
    const stepDone = action === 'reject' || remaining.length === 0;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.workflowStepInstance.update({
        where: { id: current.id },
        data: {
          status: action === 'reject' ? 'REJECTED' : 'COMPLETED',
          actionedById: userId,
          actionedAt: new Date(),
          note: dto.note ?? null,
          data: dto.formData
            ? (dto.formData as Prisma.InputJsonValue)
            : undefined,
        },
      });

      if (instance.submissionId && dto.formData && allowedKeys.size > 0) {
        const mergedSub = await tx.formSubmission.findUnique({
          where: { id: instance.submissionId },
          select: { id: true, data: true },
        });
        if (mergedSub) {
          const mergedData = {
            ...((mergedSub.data || {}) as Record<string, unknown>),
          };
          for (const [k, v] of Object.entries(dto.formData)) {
            if (allowedKeys.has(k)) mergedData[k] = v;
          }
          await tx.formSubmission.update({
            where: { id: mergedSub.id },
            data: { data: mergedData as Prisma.InputJsonValue },
          });
        }
      }

      const nextId = remaining[0]?.id ?? null;

      return tx.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status:
            action === 'reject'
              ? 'REJECTED'
              : stepDone
                ? 'APPROVED'
                : 'PENDING',
          currentStepId: nextId,
        },
        include: {
          stepInstances: {
            orderBy: { step: { order: 'asc' } },
            include: {
              step: { include: { escalationRules: true } },
              assignedToUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              actionedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });

    const nextAssignee = result.stepInstances.find(
      (s) => s.status === 'PENDING',
    )?.assignedToUserId;
    if (result.status === 'PENDING' && nextAssignee) {
      await this.notifications.create(tenantId, {
        userId: nextAssignee,
        type: 'WORKFLOW_PENDING',
        title: 'Workflow awaiting your approval',
        body: instanceRef.title,
        data: { instanceId: instanceRef.id },
      });
    }
    if (result.status === 'APPROVED' || result.status === 'REJECTED') {
      await this.notifications.create(tenantId, {
        userId: instanceRef.initiatedByUserId,
        type:
          result.status === 'APPROVED'
            ? 'WORKFLOW_APPROVED'
            : 'WORKFLOW_REJECTED',
        title:
          result.status === 'APPROVED'
            ? 'Workflow approved'
            : 'Workflow rejected',
        body: instanceRef.title,
        data: { instanceId: instanceRef.id },
      });
    }
    this.audit.record(tenantId, {
      userId,
      action:
        action === 'reject'
          ? 'WORKFLOW_INSTANCE_REJECT'
          : action === 'execute'
            ? stepDone
              ? 'WORKFLOW_INSTANCE_EXECUTE'
              : 'WORKFLOW_STEP_EXECUTE'
            : stepDone
              ? 'WORKFLOW_INSTANCE_APPROVE'
              : 'WORKFLOW_STEP_APPROVE',
      entityType: 'WorkflowInstance',
      entityId: instanceRef.id,
      metadata: { stepId: current.id, note: dto.note ?? null },
    });

    return result;
  }

  async escalateStep(
    tenantId: string,
    instanceId: string,
    stepInstanceId: string,
    escalation: {
      type: string;
      action: string;
      targetUserId?: string | null;
    },
  ) {
    if (escalation.type === 'AUTO_ACTION') {
      const actionValue =
        escalation.action === 'APPROVE'
          ? 'COMPLETED'
          : escalation.action === 'REJECT'
            ? 'REJECTED'
            : 'COMPLETED';

      const instance = await this.prisma.workflowInstance.findFirst({
        where: { id: instanceId, tenantId, status: 'PENDING' },
        include: {
          stepInstances: {
            orderBy: { step: { order: 'asc' } },
            include: { step: true },
          },
        },
      });
      if (!instance) return;

      const current = instance.stepInstances.find(
        (s) => s.id === stepInstanceId,
      );
      if (!current || current.status !== 'PENDING') return;

      const remaining = instance.stepInstances.filter(
        (s) => s.id !== stepInstanceId && s.status === 'PENDING',
      );
      const stepDone = escalation.action === 'REJECT' || remaining.length === 0;

      await this.prisma.$transaction(async (tx) => {
        await tx.workflowStepInstance.update({
          where: { id: stepInstanceId },
          data: {
            status: actionValue,
            actionedAt: new Date(),
            note: `[Auto-actioned: ${escalation.action}]`,
          },
        });

        const nextId = remaining[0]?.id ?? null;

        await tx.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: stepDone
              ? escalation.action === 'REJECT'
                ? 'REJECTED'
                : 'APPROVED'
              : 'PENDING',
            currentStepId: nextId,
          },
        });
      });

      this.audit.record(tenantId, {
        action: 'WORKFLOW_ESCALATION_AUTO_ACTION',
        entityType: 'WorkflowStepInstance',
        entityId: stepInstanceId,
        metadata: {
          instanceId,
          action: escalation.action,
        },
      });
    } else if (escalation.type === 'NOTIFY') {
      const targetUserId = escalation.targetUserId;
      if (targetUserId) {
        const instance = await this.prisma.workflowInstance.findFirst({
          where: { id: instanceId },
        });
        await this.notifications.create(tenantId, {
          userId: targetUserId,
          type: 'WORKFLOW_ESCALATION',
          title: 'Workflow step overdue',
          body: instance?.title ?? 'Workflow action required',
          data: { instanceId, stepInstanceId },
        });
      }
    } else if (escalation.type === 'REASSIGN' && escalation.targetUserId) {
      await this.prisma.workflowStepInstance.update({
        where: { id: stepInstanceId },
        data: {
          assignedToUserId: escalation.targetUserId,
          delegatedToUserId: escalation.targetUserId,
          originalAssignedToUserId: undefined,
        },
      });

      const instance = await this.prisma.workflowInstance.findFirst({
        where: { id: instanceId },
      });
      await this.notifications.create(tenantId, {
        userId: escalation.targetUserId,
        type: 'WORKFLOW_REASSIGNED',
        title: 'Workflow step reassigned to you',
        body: instance?.title ?? 'Workflow action required',
        data: { instanceId, stepInstanceId },
      });
    }
  }

  private async userHoldsStepRole(
    tenantId: string,
    branchId: string | null,
    userId: string,
    companyRoleId: string | null,
  ): Promise<boolean> {
    if (!companyRoleId) return false;
    const assignment = await this.prisma.roleAssignment.findFirst({
      where: {
        tenantId,
        companyRoleId,
        userId,
        OR: [{ branchId: null }, { branchId: branchId ?? undefined }],
      },
    });
    if (!assignment) return false;
    const staff = await this.prisma.staffRecord.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      select: { id: true },
    });
    return !!staff;
  }

  private mapRoleNameToKey(name: string): string | null {
    const n = (name || '').toLowerCase();
    if (n.includes('account assist') || n.includes('account asisst'))
      return 'ACCOUNT_ASSIST';
    if (n.includes('it manager')) return 'IT_MANAGER';
    if (n.includes('energy manager')) return 'ENERGY_MANAGER';
    if (n.includes('general manager')) return 'GENERAL_MANAGER';
    if (n.includes('managing director') || n === 'md') return 'MD';
    return null;
  }

  private allowedRoleKeys(
    formFields: { key: string; roleKey?: string | null }[],
    stepRoleKey: string | null,
  ): Set<string> {
    const keys = new Set<string>();
    if (!stepRoleKey) return keys;
    for (const f of formFields) {
      if (f.roleKey === stepRoleKey) keys.add(f.key);
    }
    return keys;
  }

  private async resolveAssignee(
    tx: Prisma.TransactionClient,
    tenantId: string,
    initiatorUserId: string,
    branchId: string | null,
    step: StepInput,
  ): Promise<string | null> {
    if (step.assigneeRuleType === 'USER') {
      return step.assigneeUserId ?? null;
    }

    if (step.assigneeRuleType === 'ORIGINATOR_MANAGER') {
      const staff = await tx.staffRecord.findFirst({
        where: { tenantId, userId: initiatorUserId, isActive: true },
        include: { department: true },
      });
      return staff?.department?.managerUserId ?? null;
    }

    if (step.assigneeRuleType === 'COMPANY_ROLE') {
      if (!step.assigneeCompanyRoleId) {
        throw new BadRequestException(
          `Step "${step.name}" requires a company role`,
        );
      }
      const roleAssignments = await tx.roleAssignment.findMany({
        where: {
          tenantId,
          companyRoleId: step.assigneeCompanyRoleId,
          OR: [{ branchId: null }, { branchId: branchId ?? undefined }],
        },
        include: { user: true },
      });
      for (const assignment of roleAssignments) {
        const staff = await tx.staffRecord.findFirst({
          where: {
            tenantId,
            userId: assignment.userId,
            isActive: true,
            ...(branchId ? { branchId } : {}),
          },
          select: { id: true },
        });
        if (staff) return assignment.userId;
      }
      return null;
    }

    return null;
  }

  private validateSteps(steps: StepInput[]): void {
    const orders = steps.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Step order values must be unique');
    }
    for (const step of steps) {
      if (step.assigneeRuleType === 'USER' && !step.assigneeUserId) {
        throw new BadRequestException(
          `Step "${step.name}" requires an assignee user`,
        );
      }
      if (
        step.assigneeRuleType === 'COMPANY_ROLE' &&
        !step.assigneeCompanyRoleId
      ) {
        throw new BadRequestException(
          `Step "${step.name}" requires a company role`,
        );
      }
    }
  }

  private stepData(s: StepInput) {
    return {
      name: s.name,
      order: s.order,
      action: s.action as never,
      assigneeRuleType: s.assigneeRuleType as never,
      assigneeCompanyRoleId: s.assigneeCompanyRoleId ?? null,
      assigneeUserId: s.assigneeUserId ?? null,
      isFinal: s.isFinal,
      isRequired: s.isRequired ?? true,
      dueInMinutes: s.dueInMinutes ?? null,
    };
  }

  private assertManage(
    template: { createdByUserId: string },
    userId: string,
    abilities: AbilitiesContext,
  ): void {
    if (
      template.createdByUserId !== userId &&
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes(PERMISSIONS.WORKFLOW_CREATE)
    ) {
      throw new ForbiddenException('You cannot manage this workflow template');
    }
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private assertRecordBranchAccess(
    branchId: string | null,
    abilities: AbilitiesContext,
  ): void {
    if (
      branchId !== null &&
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }

  private async assertFormExists(
    tenantId: string,
    formId: string,
  ): Promise<void> {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      select: { id: true },
    });
    if (!form) throw new NotFoundException('Form not found');
  }
}
