import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../rbac/system-roles/system-roles.constants';
import { GradingService } from './grading.service';
import type {
  ChildAttendanceQueryDto,
  ChildResultsQueryDto,
  InviteGuardianDto,
} from './dto/parent.dto';

const VISIBLE_RESULT_STATUSES = ['APPROVED', 'PUBLISHED'] as const;

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradingService: GradingService,
  ) {}

  private async ensureParentRole(tenantId: string, actorUserId: string) {
    let role = await this.prisma.companyRole.findFirst({
      where: { tenantId, name: SYSTEM_ROLE_NAMES.PARENT },
    });
    if (!role) {
      role = await this.prisma.companyRole.create({
        data: {
          tenantId,
          name: SYSTEM_ROLE_NAMES.PARENT,
          description: SYSTEM_ROLE_DEFS.PARENT.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.PARENT.permissions],
          createdByUserId: actorUserId,
        },
      });
    }
    return role;
  }

  /** Grant (or refresh) portal access for a guardian. */
  async inviteGuardian(
    tenantId: string,
    actorUserId: string,
    dto: InviteGuardianDto,
  ) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, tenantId },
    });
    if (!guardian) throw new NotFoundException('Guardian not found');

    const email = (dto.email ?? guardian.email)?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'This guardian has no email address. Provide one to grant portal access.',
      );
    }

    const generatedPassword = dto.password ? null : randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(dto.password ?? generatedPassword!, 10);
    const parentRole = await this.ensureParentRole(tenantId, actorUserId);

    const { user, isNewUser } = await this.prisma.$transaction(async (tx) => {
      let existing = await tx.user.findUnique({ where: { email } });
      let isNew = false;
      if (!existing) {
        existing = await tx.user.create({
          data: {
            email,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            passwordHash,
            role: 'USER',
          },
        });
        isNew = true;
      }

      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId, userId: existing.id } },
        create: { tenantId, userId: existing.id },
        update: {},
      });

      const assignment = await tx.roleAssignment.findFirst({
        where: {
          tenantId,
          userId: existing.id,
          companyRoleId: parentRole.id,
          branchId: null,
        },
      });
      if (!assignment) {
        await tx.roleAssignment.create({
          data: {
            tenantId,
            userId: existing.id,
            companyRoleId: parentRole.id,
            assignedByUserId: actorUserId,
          },
        });
      }

      await tx.guardian.update({
        where: { id: guardian.id },
        data: { userId: existing.id },
      });

      return { user: existing, isNewUser: isNew };
    });

    return {
      guardianId: guardian.id,
      userId: user.id,
      email,
      accountCreated: isNewUser,
      temporaryPassword: isNewUser ? generatedPassword : null,
    };
  }

  async getMyProfile(tenantId: string, userId: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId, userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                currentClass: { select: { id: true, name: true, level: true } },
              },
            },
          },
        },
      },
    });
    if (!guardian) {
      throw new ForbiddenException('This account is not linked to a guardian record');
    }

    return {
      guardian: {
        id: guardian.id,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        phone: guardian.phone,
        email: guardian.email,
        address: guardian.address,
        occupation: guardian.occupation,
      },
      children: guardian.students.map((sg) => ({
        relationship: sg.relationship,
        isPrimary: sg.isPrimary,
        ...sg.student,
      })),
    };
  }

  private async assertChildAccess(
    tenantId: string,
    userId: string,
    studentId: string,
  ) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId, userId },
    });
    if (!guardian) {
      throw new ForbiddenException('This account is not linked to a guardian record');
    }
    const link = await this.prisma.studentGuardian.findFirst({
      where: { guardianId: guardian.id, studentId },
      include: {
        student: {
          include: {
            currentClass: { select: { id: true, name: true, level: true } },
          },
        },
      },
    });
    if (!link) {
      throw new ForbiddenException('You do not have access to this student');
    }
    return link.student;
  }

  async getChild(tenantId: string, userId: string, studentId: string) {
    return this.assertChildAccess(tenantId, userId, studentId);
  }

  async getChildAttendance(
    tenantId: string,
    userId: string,
    studentId: string,
    query: ChildAttendanceQueryDto,
  ) {
    await this.assertChildAccess(tenantId, userId, studentId);
    const date: Record<string, Date> = {};
    if (query.from) date.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) date.lte = new Date(`${query.to}T23:59:59.999Z`);

    return this.prisma.schoolAttendance.findMany({
      where: {
        tenantId,
        studentId,
        ...(query.from || query.to ? { date } : {}),
      },
      orderBy: { date: 'desc' },
      take: 180,
    });
  }

  async getChildResults(
    tenantId: string,
    userId: string,
    studentId: string,
    query: ChildResultsQueryDto,
  ) {
    await this.assertChildAccess(tenantId, userId, studentId);
    return this.prisma.academicResult.findMany({
      where: {
        tenantId,
        studentId,
        status: { in: [...VISIBLE_RESULT_STATUSES] },
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.termId ? { termId: query.termId } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: [{ subject: { name: 'asc' } }],
    });
  }

  async getChildReportCard(
    tenantId: string,
    userId: string,
    studentId: string,
    sessionId: string,
    termId: string,
  ) {
    await this.assertChildAccess(tenantId, userId, studentId);
    // Guardians must only ever see published results, never in-progress marks.
    const published = await this.prisma.academicResult.count({
      where: {
        tenantId,
        studentId,
        sessionId,
        termId,
        status: { in: [...VISIBLE_RESULT_STATUSES] },
      },
    });
    if (published === 0) {
      throw new NotFoundException(
        'Results for this term have not been published yet',
      );
    }
    return this.gradingService.getStudentReportCard(
      tenantId,
      studentId,
      sessionId,
      termId,
    );
  }

  async getChildInvoices(tenantId: string, userId: string, studentId: string) {
    await this.assertChildAccess(tenantId, userId, studentId);
    return this.prisma.studentInvoice.findMany({
      where: { tenantId, studentId },
      include: {
        items: true,
        payments: { orderBy: { paymentDate: 'desc' } },
        session: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
