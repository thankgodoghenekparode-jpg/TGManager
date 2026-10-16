import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AssignExamDto,
  CreateExamDto,
  QueryExamsDto,
  UpdateExamDto,
} from './dto/cbt.dto';

const examSummaryInclude = {
  subject: { select: { id: true, code: true, name: true } },
  class: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { questions: true, attempts: true, assignments: true } },
} as const;

const examDetailInclude = {
  ...examSummaryInclude,
  questions: {
    orderBy: { order: 'asc' as const },
    include: {
      question: {
        select: {
          id: true,
          text: true,
          difficulty: true,
          category: true,
          marks: true,
          status: true,
          subject: { select: { id: true, code: true, name: true } },
          options: {
            orderBy: { order: 'asc' as const },
            select: { id: true, label: true, text: true, isCorrect: true },
          },
        },
      },
    },
  },
  assignments: {
    include: {
      class: { select: { id: true, name: true } },
      student: {
        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
      },
    },
  },
} as const;

@Injectable()
export class CbtExamsService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // Staff-facing (administration / teachers)
  // --------------------------------------------------------------------------

  async list(tenantId: string, query: QueryExamsDto) {
    const where: Prisma.CbtExamWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cbtExam.findMany({
        where,
        include: examSummaryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cbtExam.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async get(tenantId: string, id: string) {
    const exam = await this.prisma.cbtExam.findFirst({
      where: { id, tenantId },
      include: examDetailInclude,
    });
    if (!exam) throw new NotFoundException('Examination not found');
    return exam;
  }

  async create(tenantId: string, userId: string, dto: CreateExamDto) {
    await this.assertReferences(tenantId, dto.subjectId, dto.classId);
    const selected = await this.resolveQuestions(tenantId, dto);
    const studentIds = await this.assertStudents(tenantId, dto.assignStudentIds);

    const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);
    const startAt = dto.startAt ? new Date(dto.startAt) : null;
    const endAt = dto.endAt ? new Date(dto.endAt) : null;
    // Practice mode is about learning: reveal answers straight away by default.
    // Mock mode never reveals answers until the school opts in explicitly.
    const showCorrectAnswers =
      dto.mode === 'PRACTICE' ? true : dto.showCorrectAnswers;

    const assignments: Prisma.CbtExamAssignmentUncheckedCreateWithoutExamInput[] = [];
    if (dto.assignClassId) {
      assignments.push({ tenantId, classId: dto.assignClassId, studentId: null });
    }
    for (const studentId of studentIds) {
      assignments.push({ tenantId, studentId, classId: null });
    }

    return this.prisma.cbtExam.create({
      data: {
        tenantId,
        title: dto.title,
        category: dto.category,
        mode: dto.mode,
        subjectId: dto.subjectId ?? null,
        classId: dto.classId ?? null,
        description: dto.description ?? null,
        instructions: dto.instructions ?? null,
        durationMinutes: dto.durationMinutes,
        totalMarks,
        passMark: dto.passMark,
        randomizeQuestions: dto.randomizeQuestions,
        randomizeOptions: dto.randomizeOptions,
        maxAttempts: dto.maxAttempts,
        showResultImmediately: dto.showResultImmediately,
        showCorrectAnswers,
        negativeMarking: dto.negativeMarking,
        negativeMarkPerWrong: dto.negativeMarkPerWrong,
        startAt,
        endAt,
        status: dto.status,
        createdByUserId: userId,
        questions: {
          create: selected.map((question, index) => ({
            questionId: question.id,
            order: index,
            marks: question.marks,
          })),
        },
        ...(assignments.length > 0
          ? { assignments: { create: assignments } }
          : {}),
      },
      include: examDetailInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExamDto) {
    const existing = await this.prisma.cbtExam.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        durationMinutes: true,
        startAt: true,
        endAt: true,
        subjectId: true,
        classId: true,
        _count: { select: { attempts: true } },
      },
    });
    if (!existing) throw new NotFoundException('Examination not found');

    if (dto.subjectId || dto.classId) {
      await this.assertReferences(
        tenantId,
        dto.subjectId ?? undefined,
        dto.classId ?? undefined,
      );
    }

    if (dto.questionIds && dto.questionIds.length > 0) {
      if (existing._count.attempts > 0) {
        throw new BadRequestException(
          'This examination already has attempts, so its questions cannot be changed. Duplicate it instead.',
        );
      }
      const selected = await this.loadQuestions(tenantId, dto.questionIds);
      const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);

      return this.prisma.cbtExam.update({
        where: { id: existing.id },
        data: {
          totalMarks,
          questions: {
            deleteMany: {},
            create: selected.map((question, index) => ({
              questionId: question.id,
              order: index,
              marks: question.marks,
            })),
          },
        },
        include: examDetailInclude,
      });
    }

    const data: Prisma.CbtExamUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.category ? { category: dto.category } : {}),
      ...(dto.mode ? { mode: dto.mode } : {}),
      ...(dto.subjectId !== undefined
        ? dto.subjectId === null
          ? { subject: { disconnect: true } }
          : { subject: { connect: { id: dto.subjectId } } }
        : {}),
      ...(dto.classId !== undefined
        ? dto.classId === null
          ? { class: { disconnect: true } }
          : { class: { connect: { id: dto.classId } } }
        : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
      ...(dto.durationMinutes !== undefined
        ? { durationMinutes: dto.durationMinutes }
        : {}),
      ...(dto.passMark !== undefined ? { passMark: dto.passMark } : {}),
      ...(dto.randomizeQuestions !== undefined
        ? { randomizeQuestions: dto.randomizeQuestions }
        : {}),
      ...(dto.randomizeOptions !== undefined
        ? { randomizeOptions: dto.randomizeOptions }
        : {}),
      ...(dto.maxAttempts !== undefined ? { maxAttempts: dto.maxAttempts } : {}),
      ...(dto.showResultImmediately !== undefined
        ? { showResultImmediately: dto.showResultImmediately }
        : {}),
      ...(dto.showCorrectAnswers !== undefined
        ? { showCorrectAnswers: dto.showCorrectAnswers }
        : {}),
      ...(dto.negativeMarking !== undefined
        ? { negativeMarking: dto.negativeMarking }
        : {}),
      ...(dto.negativeMarkPerWrong !== undefined
        ? { negativeMarkPerWrong: dto.negativeMarkPerWrong }
        : {}),
      ...(dto.startAt !== undefined
        ? { startAt: dto.startAt ? new Date(dto.startAt) : null }
        : {}),
      ...(dto.endAt !== undefined
        ? { endAt: dto.endAt ? new Date(dto.endAt) : null }
        : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };

    // Switching an exam to practice mode reveals answers by default, unless the
    // school explicitly chose a setting in the same request.
    if (dto.mode === 'PRACTICE' && dto.showCorrectAnswers === undefined) {
      data.showCorrectAnswers = true;
    }

    // Shift open attempts by the duration change so edits stay server-authoritative.
    if (
      dto.durationMinutes !== undefined &&
      dto.durationMinutes !== existing.durationMinutes
    ) {
      const deltaMs = (dto.durationMinutes - existing.durationMinutes) * 60_000;
      const openAttempts = await this.prisma.cbtExamAttempt.findMany({
        where: { examId: existing.id, status: 'IN_PROGRESS' },
        select: { id: true, expiresAt: true },
      });
      if (openAttempts.length > 0) {
        await this.prisma.$transaction(
          openAttempts.map((attempt) =>
            this.prisma.cbtExamAttempt.update({
              where: { id: attempt.id },
              data: {
                expiresAt: new Date(
                  Math.max(Date.now(), attempt.expiresAt.getTime() + deltaMs),
                ),
              },
            }),
          ),
        );
      }
    }

    return this.prisma.cbtExam.update({
      where: { id: existing.id },
      data,
      include: examDetailInclude,
    });
  }

  async assign(tenantId: string, examId: string, dto: AssignExamDto) {
    const exam = await this.prisma.cbtExam.findFirst({
      where: { id: examId, tenantId },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('Examination not found');
    if (dto.classId) {
      const classroom = await this.prisma.classRoom.findFirst({
        where: { id: dto.classId, tenantId },
        select: { id: true },
      });
      if (!classroom) throw new BadRequestException('Class not found for this school');
    }
    const studentIds = await this.assertStudents(tenantId, dto.studentIds);

    if (dto.replace) {
      await this.prisma.cbtExamAssignment.deleteMany({ where: { examId: exam.id } });
    }

    const rows: Prisma.CbtExamAssignmentCreateManyInput[] = [];
    if (dto.classId) {
      const already = await this.prisma.cbtExamAssignment.findFirst({
        where: { examId: exam.id, classId: dto.classId },
        select: { id: true },
      });
      if (!already) {
        rows.push({ examId: exam.id, tenantId, classId: dto.classId, studentId: null });
      }
    }
    for (const studentId of studentIds) {
      const already = await this.prisma.cbtExamAssignment.findFirst({
        where: { examId: exam.id, studentId },
        select: { id: true },
      });
      if (!already) {
        rows.push({ examId: exam.id, tenantId, studentId, classId: null });
      }
    }

    if (rows.length > 0) {
      await this.prisma.cbtExamAssignment.createMany({ data: rows });
    }

    const assignments = await this.prisma.cbtExamAssignment.findMany({
      where: { examId: exam.id },
      include: {
        class: { select: { id: true, name: true } },
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
    });
    return { assignments, added: rows.length };
  }

  async remove(tenantId: string, id: string) {
    const exam = await this.prisma.cbtExam.findFirst({
      where: { id, tenantId },
      select: { id: true, _count: { select: { attempts: true } } },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    if (exam._count.attempts === 0) {
      await this.prisma.cbtExam.delete({ where: { id: exam.id } });
      return { success: true, action: 'deleted' };
    }

    await this.prisma.cbtExam.update({
      where: { id: exam.id },
      data: { status: 'ARCHIVED' },
    });
    return { success: true, action: 'archived' };
  }

  // --------------------------------------------------------------------------
  // Student-facing visibility (used by the CBT dashboard and attempts)
  // --------------------------------------------------------------------------

  /**
   * Published exams this student may take. Access requires all of:
   * published, inside its date window (still listed when closed), and either
   * targeted at their class / them directly, or left untargeted (which means
   * "everyone in this school"). Every row is tenant-scoped.
   */
  async listForStudent(tenantId: string, studentId: string, classId: string | null) {
    const now = new Date();

    const exams = await this.prisma.cbtExam.findMany({
      where: {
        tenantId,
        status: 'PUBLISHED',
        OR: [
          ...(classId ? [{ classId }] : []),
          { classId: null, assignments: { none: {} } },
          {
            assignments: {
              some: { OR: [{ studentId }, ...(classId ? [{ classId }] : [])] },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        mode: true,
        description: true,
        durationMinutes: true,
        totalMarks: true,
        passMark: true,
        maxAttempts: true,
        startAt: true,
        endAt: true,
        subject: { select: { id: true, code: true, name: true } },
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId },
          orderBy: { attemptNumber: 'desc' },
          select: {
            id: true,
            status: true,
            percentage: true,
            passed: true,
            submittedAt: true,
            attemptNumber: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return exams.map((exam) => {
      const submitted = exam.attempts.filter(
        (attempt) => attempt.status !== 'IN_PROGRESS',
      );
      const openAttempt = exam.attempts.find(
        (attempt) => attempt.status === 'IN_PROGRESS',
      );
      const started = exam.attempts.length;
      const withinWindow =
        (!exam.startAt || exam.startAt <= now) && (!exam.endAt || exam.endAt >= now);
      const attemptsLeft = Math.max(0, exam.maxAttempts - submitted.length);

      return {
        id: exam.id,
        title: exam.title,
        category: exam.category,
        mode: exam.mode,
        description: exam.description,
        subject: exam.subject,
        questionCount: exam._count.questions,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passMark: exam.passMark,
        maxAttempts: exam.maxAttempts,
        startAt: exam.startAt,
        endAt: exam.endAt,
        isClosed: !withinWindow,
        attemptsLeft,
        canStart: withinWindow && (attemptsLeft > 0 || !!openAttempt),
        openAttemptId: openAttempt?.id ?? null,
        attempts: exam.attempts,
        startedCount: submitted.length,
        bestPercentage: submitted.reduce(
          (best, attempt) => Math.max(best, attempt.percentage),
          0,
        ),
      };
    });
  }

  /** Non-scored exam card for the pre-flight screen (no correct answers). */
  async getForStudent(tenantId: string, studentId: string, examId: string) {
    const exam = await this.prisma.cbtExam.findFirst({
      where: { id: examId, tenantId, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        category: true,
        mode: true,
        description: true,
        instructions: true,
        durationMinutes: true,
        totalMarks: true,
        passMark: true,
        maxAttempts: true,
        startAt: true,
        endAt: true,
        showCorrectAnswers: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        showResultImmediately: true,
        negativeMarking: true,
        negativeMarkPerWrong: true,
        classId: true,
        subject: { select: { id: true, code: true, name: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId },
          orderBy: { attemptNumber: 'desc' },
          select: { id: true, status: true, attemptNumber: true },
        },
      },
    });
    if (!exam) throw new NotFoundException('Examination not found or not published');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { currentClassId: true },
    });
    const classId = student?.currentClassId ?? null;

    const targeted = await this.prisma.cbtExamAssignment.findFirst({
      where: {
        examId: exam.id,
        OR: [{ studentId }, ...(classId ? [{ classId }] : [])],
      },
      select: { id: true },
    });

    const isUntargeted =
      !exam.classId &&
      (await this.prisma.cbtExamAssignment.count({ where: { examId: exam.id } })) === 0;

    const matchesClass = !!classId && exam.classId === classId;
    if (!targeted && !isUntargeted && !matchesClass) {
      throw new ForbiddenException('You are not assigned to this examination');
    }

    const now = new Date();
    const withinWindow =
      (!exam.startAt || exam.startAt <= now) && (!exam.endAt || exam.endAt >= now);
    const submitted = exam.attempts.filter((a) => a.status !== 'IN_PROGRESS');
    const openAttempt = exam.attempts.find((a) => a.status === 'IN_PROGRESS');

    return {
      ...exam,
      isClosed: !withinWindow,
      attemptsLeft: Math.max(0, exam.maxAttempts - submitted.length),
      openAttemptId: openAttempt?.id ?? null,
      questionCount: exam._count.questions,
      canStart: withinWindow && (submitted.length < exam.maxAttempts || !!openAttempt),
    };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /** Verifies referenced subject/class belong to this tenant. */
  private async assertReferences(
    tenantId: string,
    subjectId?: string | null,
    classId?: string | null,
  ) {
    if (subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: { id: subjectId, tenantId },
        select: { id: true },
      });
      if (!subject) throw new BadRequestException('Subject not found for this school');
    }
    if (classId) {
      const classroom = await this.prisma.classRoom.findFirst({
        where: { id: classId, tenantId },
        select: { id: true },
      });
      if (!classroom) throw new BadRequestException('Class not found for this school');
    }
  }

  private async assertStudents(
    tenantId: string,
    studentIds: string[],
  ): Promise<string[]> {
    if (studentIds.length === 0) return [];
    const unique = [...new Set(studentIds)];
    const found = await this.prisma.student.findMany({
      where: { id: { in: unique }, tenantId },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException(
        'One or more selected students were not found for this school',
      );
    }
    return unique;
  }

  /** Loads explicit question ids, verifying ownership and status. */
  private async loadQuestions(tenantId: string, questionIds: string[]) {
    const unique = [...new Set(questionIds)];
    const questions = await this.prisma.cbtQuestion.findMany({
      where: { id: { in: unique }, tenantId, status: { not: 'ARCHIVED' } },
      select: { id: true, marks: true },
    });
    if (questions.length !== unique.length) {
      throw new BadRequestException(
        'Some selected questions are missing or archived — refresh the question bank and try again.',
      );
    }
    const byId = new Map(questions.map((question) => [question.id, question]));
    return unique.map((id) => byId.get(id)!);
  }

  /** Either the explicit question set, or a random sample from the bank. */
  private async resolveQuestions(tenantId: string, dto: CreateExamDto) {
    if (dto.questionIds.length > 0) {
      return this.loadQuestions(tenantId, dto.questionIds);
    }

    const where: Prisma.CbtQuestionWhereInput = {
      tenantId,
      status: 'ACTIVE',
      ...(dto.autoPickCategory
        ? { category: dto.autoPickCategory }
        : dto.subjectId
          ? { subjectId: dto.subjectId }
          : {}),
    };
    const candidates = await this.prisma.cbtQuestion.findMany({
      where,
      select: { id: true, marks: true },
    });

    if (candidates.length < dto.autoPickCount) {
      throw new BadRequestException(
        `Only ${candidates.length} matching question(s) are available in the bank — ${dto.autoPickCount} were requested.`,
      );
    }

    // Fisher–Yates with Math.random: the chosen set is stored on the exam.
    const pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, dto.autoPickCount);
  }
}
