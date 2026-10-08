import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AssignClassSubjectDto,
  CreateAcademicSessionDto,
  CreateClassRoomDto,
  CreateSubjectDto,
  CreateTermDto,
  SchoolProfileDto,
  UpdateAcademicSessionDto,
  UpdateClassRoomDto,
  UpdateSubjectDto,
  UpdateTermDto,
} from './dto/classes.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= School Profile =================
  async getProfile(tenantId: string) {
    let profile = await this.prisma.schoolProfile.findUnique({
      where: { tenantId },
    });
    if (!profile) {
      profile = await this.prisma.schoolProfile.create({
        data: {
          tenantId,
        },
      });
    }
    return profile;
  }

  async updateProfile(tenantId: string, dto: SchoolProfileDto) {
    return this.prisma.schoolProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...dto,
      },
      update: {
        ...dto,
      },
    });
  }

  // ================= Academic Sessions =================
  async listSessions(tenantId: string) {
    return this.prisma.academicSession.findMany({
      where: { tenantId },
      include: {
        terms: { orderBy: { createdAt: 'asc' } },
        _count: { select: { classes: true, results: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSession(tenantId: string, dto: CreateAcademicSessionDto) {
    const existing = await this.prisma.academicSession.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Session "${dto.name}" already exists`);
    }

    if (dto.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicSession.create({
      data: {
        tenantId,
        name: dto.name,
        isCurrent: dto.isCurrent,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async updateSession(tenantId: string, id: string, dto: UpdateAcademicSessionDto) {
    const session = await this.prisma.academicSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) throw new NotFoundException('Academic session not found');

    if (dto.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicSession.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
      },
    });
  }

  // ================= Terms =================
  async listTerms(tenantId: string, sessionId?: string) {
    return this.prisma.term.findMany({
      where: {
        tenantId,
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        session: { select: { id: true, name: true, isCurrent: true } },
      },
      orderBy: [{ sessionId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createTerm(tenantId: string, dto: CreateTermDto) {
    const session = await this.prisma.academicSession.findFirst({
      where: { id: dto.sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Academic session not found');

    const existing = await this.prisma.term.findUnique({
      where: { sessionId_name: { sessionId: dto.sessionId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Term "${dto.name}" already exists in this session`);
    }

    if (dto.isCurrent) {
      await this.prisma.term.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.term.create({
      data: {
        tenantId,
        sessionId: dto.sessionId,
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status,
        isCurrent: dto.isCurrent,
        resultEntryOpen: dto.resultEntryOpen,
        resultSubmissionDeadline: dto.resultSubmissionDeadline
          ? new Date(dto.resultSubmissionDeadline)
          : null,
        resultPublished: dto.resultPublished,
      },
    });
  }

  async updateTerm(tenantId: string, id: string, dto: UpdateTermDto) {
    const term = await this.prisma.term.findFirst({
      where: { id, tenantId },
    });
    if (!term) throw new NotFoundException('Term not found');

    if (dto.isCurrent) {
      await this.prisma.term.updateMany({
        where: { tenantId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.term.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        ...(dto.resultEntryOpen !== undefined ? { resultEntryOpen: dto.resultEntryOpen } : {}),
        ...(dto.resultPublished !== undefined ? { resultPublished: dto.resultPublished } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.resultSubmissionDeadline !== undefined
          ? {
              resultSubmissionDeadline: dto.resultSubmissionDeadline
                ? new Date(dto.resultSubmissionDeadline)
                : null,
            }
          : {}),
      },
    });
  }

  // ================= Classes =================
  async listClasses(tenantId: string, sessionId?: string) {
    return this.prisma.classRoom.findMany({
      where: {
        tenantId,
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        classTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            photo: true,
          },
        },
        session: { select: { id: true, name: true } },
        classSubjects: {
          include: {
            subject: true,
            teacher: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async getClass(tenantId: string, id: string) {
    const classroom = await this.prisma.classRoom.findFirst({
      where: { id, tenantId },
      include: {
        classTeacher: true,
        session: true,
        classSubjects: {
          include: {
            subject: true,
            teacher: true,
          },
        },
        students: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            gender: true,
            passportPhoto: true,
            status: true,
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
      },
    });
    if (!classroom) throw new NotFoundException('Class not found');
    return classroom;
  }

  async createClass(tenantId: string, dto: CreateClassRoomDto) {
    const existing = await this.prisma.classRoom.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Class "${dto.name}" already exists`);
    }

    return this.prisma.classRoom.create({
      data: {
        tenantId,
        name: dto.name,
        level: dto.level,
        section: dto.section,
        capacity: dto.capacity,
        sessionId: dto.sessionId,
        classTeacherId: dto.classTeacherId,
        status: dto.status,
      },
    });
  }

  async updateClass(tenantId: string, id: string, dto: UpdateClassRoomDto) {
    const classroom = await this.prisma.classRoom.findFirst({
      where: { id, tenantId },
    });
    if (!classroom) throw new NotFoundException('Class not found');

    return this.prisma.classRoom.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.level ? { level: dto.level } : {}),
        ...(dto.section !== undefined ? { section: dto.section } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.sessionId !== undefined ? { sessionId: dto.sessionId } : {}),
        ...(dto.classTeacherId !== undefined ? { classTeacherId: dto.classTeacherId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async deleteClass(tenantId: string, id: string) {
    const classroom = await this.prisma.classRoom.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { students: true } } },
    });
    if (!classroom) throw new NotFoundException('Class not found');
    if (classroom._count.students > 0) {
      throw new BadRequestException('Cannot delete class that has enrolled students');
    }

    await this.prisma.classRoom.delete({ where: { id } });
    return { success: true };
  }

  // ================= Subjects =================
  async listSubjects(tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId },
      include: {
        _count: { select: { classSubjects: true, results: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(tenantId: string, dto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Subject code "${dto.code}" already exists`);
    }

    return this.prisma.subject.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description,
        category: dto.category,
        status: dto.status,
      },
    });
  }

  async updateSubject(tenantId: string, id: string, dto: UpdateSubjectDto) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.code ? { code: dto.code.toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async assignSubjectToClass(tenantId: string, classId: string, dto: AssignClassSubjectDto) {
    const classroom = await this.prisma.classRoom.findFirst({
      where: { id: classId, tenantId },
    });
    if (!classroom) throw new NotFoundException('Class not found');

    return this.prisma.classSubject.upsert({
      where: {
        classId_subjectId: { classId, subjectId: dto.subjectId },
      },
      create: {
        tenantId,
        classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
      },
      update: {
        teacherId: dto.teacherId,
      },
    });
  }
}
