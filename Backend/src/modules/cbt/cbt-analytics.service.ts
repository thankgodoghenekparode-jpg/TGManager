import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireStudentRecord } from './cbt-access';
import { CbtExamsService } from './cbt-exams.service';
import { round2 } from './cbt-scoring';
import type {
  AttemptHistoryQueryDto,
  ExamReportQueryDto,
  PerformanceQueryDto,
} from './dto/cbt.dto';

const FINAL_STATUSES = ['SUBMITTED', 'EXPIRED'] as const;
/** Topic analytics only appear once enough questions were actually answered. */
const MIN_TOPIC_ANSWERS = 4;

/** Who is asking — decides how far results may be scoped. */
export interface CbtReportActor {
  userId: string;
  /** Platform admins, company admins and school managers see everything. */
  isSchoolAdmin: boolean;
}

export interface CbtTeacherScope {
  subjectIds: string[];
  classIds: string[];
  ownExamIds: string[];
}

@Injectable()
export class CbtAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: CbtExamsService,
  ) {}

  /**
   * Role-aware dashboard: a student gets their own performance, everyone else
   * gets school-level CBT statistics scoped to what they are allowed to manage.
   */
  async dashboard(tenantId: string, actor: CbtReportActor) {
    const studentRow = await this.prisma.student.findFirst({
      where: { tenantId, userId: actor.userId },
      select: { id: true, status: true },
    });
    if (studentRow) {
      if (studentRow.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'Your student record is not active. Please contact the school office.',
        );
      }
      return this.studentDashboard(tenantId, studentRow.id);
    }
    return this.staffDashboard(tenantId, actor);
  }

  // --------------------------------------------------------------------------
  // Student view
  // --------------------------------------------------------------------------

  private async studentDashboard(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        currentClassId: true,
        currentClass: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [attempts, availableExams, topicAnswers] = await Promise.all([
      this.prisma.cbtExamAttempt.findMany({
        where: {
          tenantId,
          studentId,
          status: { in: [...FINAL_STATUSES] },
          submittedAt: { not: null },
        },
        orderBy: { submittedAt: 'desc' },
        take: 200,
        select: {
          id: true,
          percentage: true,
          passed: true,
          score: true,
          totalMarks: true,
          timeUsedSeconds: true,
          submittedAt: true,
          exam: {
            select: {
              id: true,
              title: true,
              category: true,
              mode: true,
              durationMinutes: true,
              subject: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.exams.listForStudent(tenantId, studentId, student.currentClassId),
      this.prisma.cbtExamAttemptAnswer.findMany({
        where: {
          attempt: { tenantId, studentId, status: { in: [...FINAL_STATUSES] } },
          selectedOptionId: { not: null },
        },
        take: 5000,
        select: {
          isCorrect: true,
          question: {
            select: {
              topicName: true,
              topic: { select: { name: true } },
              subject: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
    ]);

    const percentages = attempts.map((attempt) => attempt.percentage);
    const averageScore = percentages.length
      ? round2(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
      : 0;
    const bestScore = percentages.length ? Math.max(...percentages) : 0;
    const passedCount = attempts.filter((attempt) => attempt.passed).length;

    const byCategory = aggregateBy(
      attempts,
      (attempt) => attempt.exam.category,
      (attempt) => attempt.exam.category,
      (attempt) => attempt.percentage,
    );

    const bySubject = aggregateBy(
      attempts.filter((attempt) => attempt.exam.subject),
      (attempt) => attempt.exam.subject!.name,
      (attempt) => attempt.exam.subject!.name,
      (attempt) => attempt.percentage,
    );

    const topicMap = new Map<
      string,
      { topic: string; subject: string; correct: number; total: number }
    >();
    for (const row of topicAnswers) {
      const topicName =
        row.question.topic?.name ?? (row.question.topicName?.trim() || 'General');
      const subjectName =
        row.question.subject?.code ?? row.question.subject?.name ?? 'General';
      const key = `${subjectName}::${topicName}`;
      const entry = topicMap.get(key) ?? {
        topic: topicName,
        subject: subjectName,
        correct: 0,
        total: 0,
      };
      entry.total += 1;
      if (row.isCorrect) entry.correct += 1;
      topicMap.set(key, entry);
    }
    const topics = [...topicMap.values()]
      .filter((entry) => entry.total >= MIN_TOPIC_ANSWERS)
      .map((entry) => ({
        ...entry,
        accuracy: round2((entry.correct / entry.total) * 100),
      }));
    const strongTopics = [...topics]
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);
    const weakTopics = [...topics].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

    const openExams = availableExams.filter((exam) => exam.canStart);

    return {
      role: 'student' as const,
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNumber: student.admissionNumber,
        className: student.currentClass?.name ?? null,
      },
      summary: {
        attemptedExams: attempts.length,
        completedExams: new Set(attempts.map((attempt) => attempt.exam.id)).size,
        averageScore,
        bestScore,
        passRate: attempts.length
          ? round2((passedCount / attempts.length) * 100)
          : 0,
      },
      examinations: {
        available: availableExams.length,
        open: openExams.length,
        closed: availableExams.filter((exam) => exam.isClosed).length,
        list: openExams.slice(0, 6),
      },
      recentAttempts: attempts.slice(0, 8),
      performanceHistory: [...attempts]
        .slice(0, 20)
        .reverse()
        .map((attempt) => ({
          id: attempt.id,
          title: attempt.exam.title,
          subject: attempt.exam.subject?.name ?? null,
          percentage: attempt.percentage,
          passed: attempt.passed,
          submittedAt: attempt.submittedAt,
        })),
      byCategory,
      bySubject,
      strongSubjects: [...bySubject].sort((a, b) => b.average - a.average).slice(0, 3),
      weakSubjects: [...bySubject].sort((a, b) => a.average - b.average).slice(0, 3),
      strongTopics,
      weakTopics,
    };
  }

  // --------------------------------------------------------------------------
  // Staff view
  // --------------------------------------------------------------------------

  private async staffDashboard(tenantId: string, actor: CbtReportActor) {
    const scope = await this.attemptScope(tenantId, actor);
    const scopedWhere: Prisma.CbtExamAttemptWhereInput = scope ?? { id: '__none__' };

    const [questionStatus, questionDifficulty, examStatus, aggregates, passed, recent] =
      await Promise.all([
        this.prisma.cbtQuestion.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.cbtQuestion.groupBy({
          by: ['difficulty'],
          where: { tenantId, status: 'ACTIVE' },
          _count: { _all: true },
        }),
        this.prisma.cbtExam.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        }),
        this.prisma.cbtExamAttempt.aggregate({
          where: { tenantId, ...scopedWhere, status: { in: [...FINAL_STATUSES] } },
          _count: { _all: true },
          _avg: { percentage: true },
          _max: { percentage: true },
        }),
        this.prisma.cbtExamAttempt.count({
          where: { tenantId, ...scopedWhere, status: { in: [...FINAL_STATUSES] }, passed: true },
        }),
        this.prisma.cbtExamAttempt.findMany({
          where: {
            tenantId,
            ...scopedWhere,
            status: { in: [...FINAL_STATUSES] },
            submittedAt: { not: null },
          },
          orderBy: { submittedAt: 'desc' },
          take: 8,
          select: {
            id: true,
            percentage: true,
            passed: true,
            submittedAt: true,
            student: {
              select: { id: true, firstName: true, lastName: true, admissionNumber: true },
            },
            exam: {
              select: {
                id: true,
                title: true,
                category: true,
                subject: { select: { code: true, name: true } },
              },
            },
          },
        }),
      ]);

    const counts = (rows: { status: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    const questionCounts = counts(questionStatus);
    const examCounts = counts(examStatus);

    const questionTotal = Object.values(questionCounts).reduce((sum, value) => sum + value, 0);

    return {
      role: 'staff' as const,
      scoped: !actor.isSchoolAdmin,
      questions: {
        total: questionTotal,
        active: questionCounts.ACTIVE ?? 0,
        draft: questionCounts.DRAFT ?? 0,
        archived: questionCounts.ARCHIVED ?? 0,
        byDifficulty: {
          EASY: questionDifficulty.find((row) => row.difficulty === 'EASY')?._count._all ?? 0,
          MEDIUM:
            questionDifficulty.find((row) => row.difficulty === 'MEDIUM')?._count._all ?? 0,
          HARD: questionDifficulty.find((row) => row.difficulty === 'HARD')?._count._all ?? 0,
        },
      },
      exams: {
        total: examStatus.reduce((sum, row) => sum + row._count._all, 0),
        published: examCounts.PUBLISHED ?? 0,
        draft: examCounts.DRAFT ?? 0,
        archived: examCounts.ARCHIVED ?? 0,
      },
      attempts: {
        total: aggregates._count._all,
        averagePercentage: round2(aggregates._avg.percentage ?? 0),
        bestPercentage: round2(aggregates._max.percentage ?? 0),
        passRate: aggregates._count._all
          ? round2((passed / aggregates._count._all) * 100)
          : 0,
      },
      recentAttempts: recent,
    };
  }

  // --------------------------------------------------------------------------
  // History & reports
  // --------------------------------------------------------------------------

  /** The signed-in student's own attempt history. */
  async myAttempts(tenantId: string, userId: string, query: AttemptHistoryQueryDto) {
    const student = await requireStudentRecord(this.prisma, tenantId, userId);
    const where: Prisma.CbtExamAttemptWhereInput = {
      tenantId,
      studentId: student.id,
      status: { in: [...FINAL_STATUSES] },
      ...(query.examId ? { examId: query.examId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cbtExamAttempt.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: query.limit,
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          score: true,
          totalMarks: true,
          percentage: true,
          passed: true,
          correctCount: true,
          incorrectCount: true,
          unansweredCount: true,
          timeUsedSeconds: true,
          submittedAt: true,
          startedAt: true,
          exam: {
            select: {
              id: true,
              title: true,
              category: true,
              mode: true,
              durationMinutes: true,
              subject: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.cbtExamAttempt.count({ where }),
    ]);

    return { items, total, limit: query.limit };
  }

  /** Leaderboard-style report for one exam, scoped to the requesting actor. */
  async examReport(tenantId: string, actor: CbtReportActor, query: ExamReportQueryDto) {
    const exam = await this.prisma.cbtExam.findFirst({
      where: { id: query.examId, tenantId },
      select: {
        id: true,
        title: true,
        category: true,
        mode: true,
        status: true,
        passMark: true,
        durationMinutes: true,
        totalMarks: true,
        subjectId: true,
        classId: true,
        createdByUserId: true,
        subject: { select: { id: true, code: true, name: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
      },
    });
    if (!exam) throw new NotFoundException('Examination not found');

    const scope = await this.attemptScope(tenantId, actor, exam);
    if (scope === null) {
      throw new ForbiddenException('You are not authorised to view this report');
    }

    const where: Prisma.CbtExamAttemptWhereInput = {
      tenantId,
      examId: exam.id,
      status: { in: [...FINAL_STATUSES] },
      ...scope,
      ...(query.classId ? { student: { currentClassId: query.classId } } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
    };

    const [items, total, scored] = await Promise.all([
      this.prisma.cbtExamAttempt.findMany({
        where,
        orderBy: [{ percentage: 'desc' }, { submittedAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          score: true,
          totalMarks: true,
          percentage: true,
          passed: true,
          correctCount: true,
          incorrectCount: true,
          unansweredCount: true,
          timeUsedSeconds: true,
          submittedAt: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              currentClass: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.cbtExamAttempt.count({ where }),
      this.prisma.cbtExamAttempt.findMany({
        where,
        select: {
          percentage: true,
          passed: true,
          timeUsedSeconds: true,
          correctCount: true,
        },
      }),
    ]);

    const totalStudents = await this.prisma.cbtExamAttempt.findMany({
      where,
      distinct: ['studentId'],
      select: { studentId: true },
    });

    const percentages = scored.map((row) => row.percentage);
    const distribution = ['0–39', '40–49', '50–59', '60–69', '70–79', '80–89', '90–100'];
    const bucketCounts = Object.fromEntries(distribution.map((label) => [label, 0]));
    for (const percentage of percentages) {
      bucketCounts[scoreBucket(percentage)] += 1;
    }

    const stats = {
      attempts: scored.length,
      students: totalStudents.length,
      averageScore: percentages.length
        ? round2(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
        : 0,
      highestScore: percentages.length ? Math.max(...percentages) : 0,
      lowestScore: percentages.length ? Math.min(...percentages) : 0,
      passRate: scored.length
        ? round2((scored.filter((row) => row.passed).length / scored.length) * 100)
        : 0,
      averageTimeSeconds: scored.length
        ? Math.round(
            scored.reduce((sum, row) => sum + row.timeUsedSeconds, 0) / scored.length,
          )
        : 0,
      averageCorrect: scored.length
        ? round2(
            scored.reduce((sum, row) => sum + row.correctCount, 0) / scored.length,
          )
        : 0,
      distribution: distribution.map((label) => ({ label, count: bucketCounts[label] })),
    };

    return { exam, items, total, page: query.page, limit: query.limit, stats };
  }

  /** Per-student performance across exams (optionally filtered by class/subject). */
  async classPerformance(
    tenantId: string,
    actor: CbtReportActor,
    query: PerformanceQueryDto,
  ) {
    const scope = await this.attemptScope(tenantId, actor);
    if (scope === null) {
      return {
        students: [],
        totalAttempts: 0,
        averagePercentage: 0,
        hasAccess: false,
      };
    }

    const attempts = await this.prisma.cbtExamAttempt.findMany({
      where: {
        tenantId,
        ...scope,
        status: { in: [...FINAL_STATUSES] },
        ...(query.classId ? { student: { currentClassId: query.classId } } : {}),
        ...(query.subjectId ? { exam: { subjectId: query.subjectId } } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      take: query.limit,
      select: {
        percentage: true,
        passed: true,
        submittedAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            currentClass: { select: { id: true, name: true } },
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
            subject: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    const byStudent = new Map<
      string,
      {
        student: {
          id: string;
          name: string;
          admissionNumber: string;
          className: string | null;
        };
        attempts: number;
        passed: number;
        total: number;
        best: number;
        lastAttemptAt: Date | null;
        subjects: Map<string, { sum: number; count: number }>;
      }
    >();

    for (const attempt of attempts) {
      const key = attempt.student.id;
      const entry = byStudent.get(key) ?? {
        student: {
          id: attempt.student.id,
          name: `${attempt.student.firstName} ${attempt.student.lastName}`.trim(),
          admissionNumber: attempt.student.admissionNumber,
          className: attempt.student.currentClass?.name ?? null,
        },
        attempts: 0,
        passed: 0,
        total: 0,
        best: 0,
        lastAttemptAt: null,
        subjects: new Map(),
      };
      entry.attempts += 1;
      if (attempt.passed) entry.passed += 1;
      entry.total += attempt.percentage;
      entry.best = Math.max(entry.best, attempt.percentage);
      if (attempt.submittedAt) {
        entry.lastAttemptAt =
          !entry.lastAttemptAt || attempt.submittedAt > entry.lastAttemptAt
            ? attempt.submittedAt
            : entry.lastAttemptAt;
      }
      const subjectName =
        attempt.exam.subject?.name ?? attempt.exam.subject?.code ?? 'General';
      const subject = entry.subjects.get(subjectName) ?? { sum: 0, count: 0 };
      subject.sum += attempt.percentage;
      subject.count += 1;
      entry.subjects.set(subjectName, subject);
      byStudent.set(key, entry);
    }

    const students = [...byStudent.values()]
      .map((entry) => ({
        student: entry.student,
        attempts: entry.attempts,
        passRate: entry.attempts ? round2((entry.passed / entry.attempts) * 100) : 0,
        averagePercentage: round2(entry.total / entry.attempts),
        bestPercentage: round2(entry.best),
        lastAttemptAt: entry.lastAttemptAt,
        subjects: [...entry.subjects.entries()]
          .map(([name, value]) => ({
            subject: name,
            average: round2(value.sum / value.count),
            attempts: value.count,
          }))
          .sort((a, b) => b.average - a.average),
      }))
      .sort((a, b) => b.averagePercentage - a.averagePercentage);

    return {
      students,
      totalAttempts: attempts.length,
      averagePercentage: students.length
        ? round2(
            students.reduce((sum, row) => sum + row.averagePercentage, 0) /
              students.length,
          )
        : 0,
      hasAccess: true,
    };
  }

  // --------------------------------------------------------------------------
  // Authorisation scope
  // --------------------------------------------------------------------------

  /**
   * Teachers only see results for subjects they teach, classes they lead, or
   * exams they created themselves. School managers (school.manage / company
   * admins) see everything in the tenant.
   */
  private async attemptScope(
    tenantId: string,
    actor: CbtReportActor,
    exam?: {
      id: string;
      subjectId: string | null;
      classId: string | null;
      createdByUserId: string | null;
    },
  ): Promise<Prisma.CbtExamAttemptWhereInput | null> {
    if (actor.isSchoolAdmin) return {};

    const staff = await this.prisma.schoolStaff.findFirst({
      where: { tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return null;

    const [teacherSubjects, ledClasses, ownExams] = await Promise.all([
      this.prisma.teacherSubject.findMany({
        where: { tenantId, teacherId: staff.id },
        select: { subjectId: true },
      }),
      this.prisma.classRoom.findMany({
        where: { tenantId, classTeacherId: staff.id },
        select: { id: true },
      }),
      this.prisma.cbtExam.findMany({
        where: { tenantId, createdByUserId: actor.userId },
        select: { id: true },
      }),
    ]);

    const subjectIds = teacherSubjects.map((row) => row.subjectId);
    const classIds = ledClasses.map((row) => row.id);
    const ownExamIds = ownExams.map((row) => row.id);

    // A specific exam must be reachable through one of the teacher's routes.
    if (exam) {
      const allowed =
        (exam.subjectId && subjectIds.includes(exam.subjectId)) ||
        (exam.classId && classIds.includes(exam.classId)) ||
        (exam.createdByUserId === actor.userId) ||
        (ownExamIds.includes(exam.id));
      if (!allowed) return null;
      return {};
    }

    const filters: Prisma.CbtExamAttemptWhereInput[] = [];
    if (subjectIds.length > 0) filters.push({ exam: { subjectId: { in: subjectIds } } });
    if (classIds.length > 0) {
      filters.push({ student: { currentClassId: { in: classIds } } });
    }
    if (ownExamIds.length > 0) filters.push({ examId: { in: ownExamIds } });
    if (filters.length === 0) return null;

    return { OR: filters };
  }
}

/** Groups attempts by a key and returns average/best/count per group. */
function aggregateBy<T>(
  rows: T[],
  keyOf: (row: T) => string,
  labelOf: (row: T) => string,
  percentageOf: (row: T) => number,
) {
  const groups = new Map<string, { label: string; attempts: number; sum: number; best: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = groups.get(key) ?? { label: labelOf(row), attempts: 0, sum: 0, best: 0 };
    const percentage = percentageOf(row);
    entry.attempts += 1;
    entry.sum += percentage;
    entry.best = Math.max(entry.best, percentage);
    groups.set(key, entry);
  }
  return [...groups.values()]
    .map((entry) => ({
      key: entry.label,
      attempts: entry.attempts,
      average: round2(entry.sum / entry.attempts),
      best: round2(entry.best),
    }))
    .sort((a, b) => b.average - a.average);
}

function scoreBucket(percentage: number): string {
  if (percentage < 40) return '0–39';
  if (percentage < 50) return '40–49';
  if (percentage < 60) return '50–59';
  if (percentage < 70) return '60–69';
  if (percentage < 80) return '70–79';
  if (percentage < 90) return '80–89';
  return '90–100';
}
