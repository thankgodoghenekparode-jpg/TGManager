import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DEFAULT_PASSWORD } from '../../common/default-password.constants';
import { derivedLoginEmail } from '../../common/login-email.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYSTEM_ROLE_DEFS,
  SYSTEM_ROLE_NAMES,
} from '../rbac/system-roles/system-roles.constants';
import type {
  CreateGuardianDto,
  CreateStudentDto,
  LinkGuardianDto,
  QueryStudentsDto,
  UpdateStudentDto,
} from './dto/students.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateQrIdentifier(tenantId: string): string {
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `STU-${tenantId.slice(-4).toUpperCase()}-${random}`;
  }

  private async generateAdmissionNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.student.count({ where: { tenantId } });
    const serial = String(count + 1).padStart(4, '0');
    return `ADM/${year}/${serial}`;
  }

  /** Lazily ensures the tenant has a STUDENT role (existing tenants predate it). */
  private async ensureStudentRole(tenantId: string, actorUserId?: string) {
    let role = await this.prisma.companyRole.findFirst({
      where: { tenantId, name: SYSTEM_ROLE_NAMES.STUDENT },
    });
    if (!role) {
      role = await this.prisma.companyRole.create({
        data: {
          tenantId,
          name: SYSTEM_ROLE_NAMES.STUDENT,
          description: SYSTEM_ROLE_DEFS.STUDENT.description,
          isSystem: true,
          permissions: [...SYSTEM_ROLE_DEFS.STUDENT.permissions],
          createdByUserId: actorUserId,
        },
      });
    }
    return role;
  }

  /**
   * Resolves the login email for a newly enrolled student. The email captured
   * on the admission form wins; otherwise one is derived from the admission
   * number (the automatic student ID) on the school's own student sub-domain
   * so it stays unique across tenants.
   */
  private async resolveStudentLoginEmail(
    tenantId: string,
    admissionNumber: string,
    providedEmail?: string | null,
  ): Promise<string> {
    const provided = providedEmail?.trim().toLowerCase();
    if (provided) return provided;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    return derivedLoginEmail(admissionNumber, tenant?.slug, 'students');
  }

  async list(tenantId: string, query: QueryStudentsDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(query.classId ? { currentClassId: query.classId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { admissionNumber: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          currentClass: { select: { id: true, name: true, level: true } },
          guardians: {
            include: {
              guardian: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        currentClass: true,
        branch: { select: { id: true, name: true } },
        guardians: {
          include: {
            guardian: true,
          },
        },
        idCards: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            attendance: true,
            results: true,
            invoices: true,
            payments: true,
          },
        },
      },
    });

    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async create(tenantId: string, actorUserId: string, dto: CreateStudentDto) {
    let admissionNumber = dto.admissionNumber;
    if (!admissionNumber) {
      admissionNumber = await this.generateAdmissionNumber(tenantId);
    } else {
      const existing = await this.prisma.student.findUnique({
        where: { tenantId_admissionNumber: { tenantId, admissionNumber } },
      });
      if (existing) {
        throw new ConflictException(`Admission number "${admissionNumber}" already exists`);
      }
    }

    const qrIdentifier = this.generateQrIdentifier(tenantId);
    const loginEmail = await this.resolveStudentLoginEmail(
      tenantId,
      admissionNumber,
      dto.email,
    );
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const studentRole = await this.ensureStudentRole(tenantId, actorUserId);

    return this.prisma.$transaction(async (tx) => {
      // Every enrolment also provisions the student's own login. An existing
      // account with the same email is reused so its password is never reset.
      let account = await tx.user.findUnique({ where: { email: loginEmail } });
      const accountCreated = !account;
      if (!account) {
        account = await tx.user.create({
          data: {
            email: loginEmail,
            firstName: dto.firstName,
            lastName: dto.lastName,
            passwordHash,
            role: 'USER',
          },
        });
      }

      await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId, userId: account.id } },
        create: { tenantId, userId: account.id },
        update: {},
      });

      const existingAssignment = await tx.roleAssignment.findFirst({
        where: {
          tenantId,
          userId: account.id,
          companyRoleId: studentRole.id,
          branchId: null,
        },
      });
      if (!existingAssignment) {
        await tx.roleAssignment.create({
          data: {
            tenantId,
            userId: account.id,
            companyRoleId: studentRole.id,
            assignedByUserId: actorUserId,
          },
        });
      }

      const student = await tx.student.create({
        data: {
          tenantId,
          userId: account.id,
          admissionNumber,
          qrIdentifier,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          passportPhoto: dto.passportPhoto,
          nationality: dto.nationality,
          stateOfOrigin: dto.stateOfOrigin,
          localGovernment: dto.localGovernment,
          religion: dto.religion,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
          previousSchool: dto.previousSchool,
          currentClassId: dto.currentClassId,
          branchId: dto.branchId,
          armSection: dto.armSection,
          house: dto.house,
          bloodGroup: dto.bloodGroup,
          genotype: dto.genotype,
          medicalNotes: dto.medicalNotes,
          status: dto.status,
        },
      });

      // Auto-issue initial ID card record
      const cardNumber = `CARD-${student.admissionNumber.replace(/\//g, '-')}`;
      await tx.studentIdCard.create({
        data: {
          tenantId,
          studentId: student.id,
          cardNumber,
          qrPayload: student.qrIdentifier,
          status: 'ACTIVE',
        },
      });

      // Create and link guardian if provided
      if (dto.guardian) {
        const g = await tx.guardian.create({
          data: {
            tenantId,
            firstName: dto.guardian.firstName,
            lastName: dto.guardian.lastName,
            phone: dto.guardian.phone,
            email: dto.guardian.email,
            address: dto.guardian.address,
          },
        });
        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: g.id,
            relationship: dto.guardian.relationship,
            isPrimary: dto.guardian.isPrimary,
            emergencyContact: dto.guardian.emergencyContact,
            receivesNotifications: true,
          },
        });
      }

      return {
        ...student,
        studentAccount: {
          email: loginEmail,
          password: accountCreated ? DEFAULT_PASSWORD : null,
          created: accountCreated,
        },
      };
    });
  }

  async update(tenantId: string, id: string, dto: UpdateStudentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (dto.admissionNumber && dto.admissionNumber !== student.admissionNumber) {
      const existing = await this.prisma.student.findUnique({
        where: { tenantId_admissionNumber: { tenantId, admissionNumber: dto.admissionNumber } },
      });
      if (existing) {
        throw new ConflictException(`Admission number "${dto.admissionNumber}" already in use`);
      }
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.admissionNumber ? { admissionNumber: dto.admissionNumber } : {}),
        ...(dto.firstName ? { firstName: dto.firstName } : {}),
        ...(dto.middleName !== undefined ? { middleName: dto.middleName } : {}),
        ...(dto.lastName ? { lastName: dto.lastName } : {}),
        ...(dto.gender ? { gender: dto.gender } : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
        ...(dto.passportPhoto !== undefined ? { passportPhoto: dto.passportPhoto } : {}),
        ...(dto.nationality ? { nationality: dto.nationality } : {}),
        ...(dto.stateOfOrigin !== undefined ? { stateOfOrigin: dto.stateOfOrigin } : {}),
        ...(dto.localGovernment !== undefined ? { localGovernment: dto.localGovernment } : {}),
        ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.previousSchool !== undefined ? { previousSchool: dto.previousSchool } : {}),
        ...(dto.currentClassId !== undefined ? { currentClassId: dto.currentClassId } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.armSection !== undefined ? { armSection: dto.armSection } : {}),
        ...(dto.house !== undefined ? { house: dto.house } : {}),
        ...(dto.bloodGroup !== undefined ? { bloodGroup: dto.bloodGroup } : {}),
        ...(dto.genotype !== undefined ? { genotype: dto.genotype } : {}),
        ...(dto.medicalNotes !== undefined ? { medicalNotes: dto.medicalNotes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    // Keep portal access in lockstep with the enrolment status: only ACTIVE
    // students are able to sign in.
    if (dto.status !== undefined) {
      await this.setLoginActive(updated.userId, updated.status === 'ACTIVE');
    }

    return updated;
  }

  /** Enables/disables the portal login attached to a student record. */
  private async setLoginActive(
    userId: string | null | undefined,
    isActive: boolean,
  ) {
    if (!userId) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async delete(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { results: true, invoices: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    // A removed or withdrawn student must not keep an active portal login.
    if (student._count.results > 0 || student._count.invoices > 0) {
      // Soft-archive if records exist
      const archived = await this.prisma.student.update({
        where: { id },
        data: { status: 'WITHDRAWN' },
      });
      await this.setLoginActive(student.userId, false);
      return archived;
    }

    await this.prisma.student.delete({ where: { id } });
    await this.setLoginActive(student.userId, false);
    return { success: true };
  }

  // ================= ID Cards =================
  async issueIdCard(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cardNumber = `CARD-${student.admissionNumber.replace(/\//g, '-')}-${Date.now().toString().slice(-4)}`;
    return this.prisma.studentIdCard.create({
      data: {
        tenantId,
        studentId: student.id,
        cardNumber,
        qrPayload: student.qrIdentifier,
        status: 'ACTIVE',
      },
    });
  }

  // ================= Guardians =================
  async listGuardians(tenantId: string, search?: string) {
    return this.prisma.guardian.findMany({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        students: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, admissionNumber: true },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async createGuardian(tenantId: string, dto: CreateGuardianDto) {
    return this.prisma.guardian.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        occupation: dto.occupation,
      },
    });
  }

  async linkGuardian(tenantId: string, studentId: string, dto: LinkGuardianDto) {
    const [student, guardian] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: studentId, tenantId } }),
      this.prisma.guardian.findFirst({ where: { id: dto.guardianId, tenantId } }),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!guardian) throw new NotFoundException('Guardian not found');

    return this.prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: { studentId, guardianId: dto.guardianId },
      },
      create: {
        studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary,
        emergencyContact: dto.emergencyContact,
        receivesNotifications: dto.receivesNotifications,
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary,
        emergencyContact: dto.emergencyContact,
        receivesNotifications: dto.receivesNotifications,
      },
    });
  }
}
