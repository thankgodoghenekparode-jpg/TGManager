import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../common/access/access-control.service';
import type {
  CreateFormDto,
  ListFormsDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/form.dto';

const APPROVER_ROLE_KEYS = [
  'ACCOUNT_ASSIST',
  'IT_MANAGER',
  'ENERGY_MANAGER',
  'GENERAL_MANAGER',
  'MD',
];

function isApproverRoleKey(roleKey: string | null | undefined): boolean {
  return !!roleKey && APPROVER_ROLE_KEYS.includes(roleKey);
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateFormDto,
    abilities: AbilitiesContext,
  ) {
    if (dto.branchId) {
      await this.access.assertBranchAccess(tenantId, dto.branchId, abilities);
    }
    if (dto.parentFormId) {
      await this.assertParentForm(tenantId, dto.parentFormId, abilities);
    }

    return this.prisma.form.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        createdByUserId: userId,
        name: dto.name,
        description: dto.description ?? null,
        isCustomerTicket: dto.isCustomerTicket ?? false,
        parentFormId: dto.parentFormId ?? null,
        fields: {
          create: dto.fields.map((f, i) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options ?? [],
            order: f.order ?? i,
            section: f.section ?? 'General',
            roleKey: f.roleKey ?? null,
          })),
        },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
  }

  async list(
    tenantId: string,
    abilities: AbilitiesContext,
    query: ListFormsDto,
  ) {
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
      isPublished?: boolean;
    } = { tenantId };
    if (query.branchId) where.branchId = query.branchId;
    if (query.published === 'true') where.isPublished = true;
    if (query.published === 'false') where.isPublished = false;
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }
    return this.prisma.form.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        fields: { orderBy: { order: 'asc' } },
        parentForm: {
          select: { id: true, name: true, isCustomerTicket: true },
        },
        childForms: {
          select: { id: true, name: true, isCustomerTicket: true },
        },
        _count: { select: { submissions: true } },
      },
    });
  }

  async getOne(tenantId: string, formId: string, abilities: AbilitiesContext) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      include: {
        fields: { orderBy: { order: 'asc' } },
        parentForm: {
          select: { id: true, name: true, isCustomerTicket: true },
        },
        childForms: {
          select: { id: true, name: true, isCustomerTicket: true },
        },
        _count: { select: { submissions: true } },
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    this.access.assertBranchScope(form.branchId, abilities);
    return form;
  }

  async update(
    tenantId: string,
    userId: string,
    formId: string,
    dto: UpdateFormDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      include: { fields: true },
    });
    if (!existing) throw new NotFoundException('Form not found');
    this.assertManage(existing, userId, abilities);

    if (dto.parentFormId) {
      await this.assertParentForm(tenantId, dto.parentFormId, abilities);
    }
    if (existing.id === dto.parentFormId) {
      throw new BadRequestException('A form cannot be its own parent');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.fields) {
        await tx.formField.deleteMany({ where: { formId } });
      }
      return tx.form.update({
        where: { id: formId },
        data: {
          name: dto.name,
          description: dto.description === null ? null : dto.description,
          isCustomerTicket: dto.isCustomerTicket,
          parentFormId: dto.parentFormId,
          fields: dto.fields
            ? {
                create: dto.fields.map((f, i) => ({
                  key: f.key,
                  label: f.label,
                  type: f.type,
                  required: f.required,
                  options: f.options ?? [],
                  order: f.order ?? i,
                  section: f.section ?? 'General',
                  roleKey: f.roleKey ?? null,
                })),
              }
            : undefined,
        },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async publish(
    tenantId: string,
    userId: string,
    formId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
    });
    if (!existing) throw new NotFoundException('Form not found');
    this.assertManage(existing, userId, abilities);

    return this.prisma.form.update({
      where: { id: formId },
      data: { isPublished: true },
    });
  }

  async remove(
    tenantId: string,
    userId: string,
    formId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
    });
    if (!existing) throw new NotFoundException('Form not found');
    this.assertManage(existing, userId, abilities);
    await this.prisma.form.delete({ where: { id: formId } });
  }

  async submit(
    tenantId: string,
    userId: string,
    formId: string,
    dto: SubmitFormDto,
    abilities: AbilitiesContext,
  ) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId, isPublished: true },
      include: { fields: true },
    });
    if (!form) {
      throw new NotFoundException('Published form not found');
    }
    this.access.assertBranchScope(form.branchId, abilities);
    this.validateSubmission(form.fields, dto.data);
    const data = this.sanitizeSubmissionData(form.fields, dto.data);

    // Determine whether this form is a "child" form that must be bundled
    // under a parent Customer Ticket submission.
    const parentRefNumber =
      (data.parentRefNumber as string | undefined) ?? null;

    if (form.parentFormId && !parentRefNumber) {
      throw new BadRequestException(
        'This form is linked to a Customer Ticket, so the parent REFF is required',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (parentRefNumber) {
        const parent = await tx.formSubmission.findFirst({
          where: { tenantId, refNumber: parentRefNumber },
          include: {
            form: { select: { id: true, isCustomerTicket: true } },
          },
        });
        if (!parent) {
          throw new BadRequestException(
            `Parent REFF "${parentRefNumber}" does not exist for this tenant`,
          );
        }
        if (form.parentFormId && parent.form.id !== form.parentFormId) {
          throw new BadRequestException(
            `Parent REFF "${parentRefNumber}" is not linked to the ${form.name} Customer Ticket form`,
          );
        }
        if (!form.parentFormId && parent.form.isCustomerTicket !== true) {
          throw new BadRequestException(
            `Parent REFF "${parentRefNumber}" must reference a Customer Ticket form`,
          );
        }
      }

      // Forms bound to a Customer Ticket share the ticket's REFF (single ticket
      // number for the whole bundle). Standalone forms get their own unique REFF.
      const isBound = !!form.parentFormId;
      const refNumber = isBound
        ? (parentRefNumber as string)
        : await this.generateRefNumber(tx, tenantId);

      const submissionData = {
        ...data,
        refNumber,
        ...(parentRefNumber ? { parentRefNumber } : {}),
      };

      const submission = await tx.formSubmission.create({
        data: {
          tenantId,
          formId,
          submittedByUserId: userId,
          refNumber,
          parentRefNumber,
          data: submissionData,
        },
        include: { form: { select: { id: true, name: true } } },
      });

      return submission;
    });
  }

  private async generateRefNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await tx.formRefCounter.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, lastNumber: 0 },
      update: {},
    });
    const next = await tx.formRefCounter.update({
      where: { id: counter.id },
      data: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });
    return `ZV-${year}-${String(next.lastNumber).padStart(5, '0')}`;
  }

  async listSubmissions(
    tenantId: string,
    userId: string,
    formId: string,
    abilities: AbilitiesContext,
  ) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new NotFoundException('Form not found');
    this.access.assertBranchScope(form.branchId, abilities);

    const isManager =
      abilities.isCompanyAdmin || abilities.permissions.includes('form.manage');
    // Customer Ticket forms are shared containers: any user who can access the
    // form may list all of its submissions, so they can bundle their form under
    // an existing ticket regardless of who created it.
    const sharedTickets = form.isCustomerTicket === true;

    return this.prisma.formSubmission.findMany({
      where: {
        formId,
        ...(isManager || sharedTickets ? {} : { submittedByUserId: userId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        submittedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getSubmission(
    tenantId: string,
    userId: string,
    formId: string,
    submissionId: string,
    abilities: AbilitiesContext,
  ) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new NotFoundException('Form not found');
    this.access.assertBranchScope(form.branchId, abilities);

    const isManager =
      abilities.isCompanyAdmin || abilities.permissions.includes('form.manage');

    const submission = await this.prisma.formSubmission.findFirst({
      where: {
        id: submissionId,
        formId,
        ...(isManager ? {} : { submittedByUserId: userId }),
      },
      include: {
        submittedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  private sanitizeSubmissionData(
    fields: {
      key: string;
      roleKey?: string | null;
    }[],
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const field = fields.find((f) => f.key === key);
      if (field && isApproverRoleKey(field.roleKey)) continue;
      cleaned[key] = value;
    }
    return cleaned;
  }

  private validateSubmission(
    fields: {
      key: string;
      label: string;
      required: boolean;
      type: string;
      options: unknown;
      roleKey?: string | null;
    }[],
    data: Record<string, unknown>,
  ): void {
    // All form details are optional: required flags are advisory only.
    // Approver-role sections must never be enforced at submit time, and the
    // secretary must always be able to submit, leaving role sections blank.
    for (const field of fields) {
      const value = data[field.key];
      if (value === undefined || value === null || value === '') continue;

      const options = Array.isArray(field.options)
        ? (field.options as string[])
        : [];
      const plainValue =
        typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : null;
      if (
        (field.type === 'SELECT' || field.type === 'RADIO') &&
        options.length > 0 &&
        (plainValue === null || !options.includes(plainValue))
      ) {
        throw new BadRequestException(
          `Invalid value for field "${field.label}"`,
        );
      }
      if (
        field.type === 'NUMBER' &&
        typeof value === 'number' &&
        Number.isNaN(value)
      ) {
        throw new BadRequestException(
          `Field "${field.label}" must be a number`,
        );
      }
      if (
        field.type === 'NUMBER' &&
        typeof value === 'string' &&
        !/^-?\d+(\.\d+)?$/.test(value)
      ) {
        throw new BadRequestException(
          `Field "${field.label}" must be a number`,
        );
      }
      if (field.type === 'DATE') {
        const date = typeof value === 'string' ? new Date(value) : null;
        if (!date || Number.isNaN(date.getTime())) {
          throw new BadRequestException(
            `Field "${field.label}" must be a date`,
          );
        }
      }
      if (field.type === 'CHECKBOX' && typeof value !== 'boolean') {
        throw new BadRequestException(
          `Field "${field.label}" must be a boolean`,
        );
      }
    }
  }

  private assertManage(
    form: { createdByUserId: string },
    userId: string,
    abilities: AbilitiesContext,
  ): void {
    if (
      form.createdByUserId !== userId &&
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes('form.manage')
    ) {
      throw new ForbiddenException('You cannot manage this form');
    }
  }

  private async assertParentForm(
    tenantId: string,
    parentFormId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    const parent = await this.prisma.form.findFirst({
      where: { id: parentFormId, tenantId },
    });
    if (!parent || !parent.isCustomerTicket) {
      throw new BadRequestException(
        'Parent form must be an existing Customer Ticket form',
      );
    }
    this.access.assertBranchScope(parent.branchId, abilities);
  }
}
