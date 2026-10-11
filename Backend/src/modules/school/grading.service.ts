import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApproveResultsDto,
  CreateAssessmentComponentDto,
  CreateGradingScaleDto,
  QueryResultsDto,
  RecordClassResultsDto,
} from './dto/grading.dto';

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= Grading Scales =================
  async listGradingScales(tenantId: string) {
    const scales = await this.prisma.gradingScale.findMany({
      where: { tenantId },
      orderBy: { minScore: 'desc' },
    });
    if (scales.length === 0) {
      // Seed standard default grading scale for convenience
      return this.seedDefaultGradingScale(tenantId);
    }
    return scales;
  }

  async seedDefaultGradingScale(tenantId: string) {
    const defaultScales = [
      { minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent', gradePoint: 5.0 },
      { minScore: 60, maxScore: 69.99, grade: 'B', remark: 'Very Good', gradePoint: 4.0 },
      { minScore: 50, maxScore: 59.99, grade: 'C', remark: 'Good', gradePoint: 3.0 },
      { minScore: 45, maxScore: 49.99, grade: 'D', remark: 'Pass', gradePoint: 2.0 },
      { minScore: 40, maxScore: 44.99, grade: 'E', remark: 'Poor', gradePoint: 1.0 },
      { minScore: 0, maxScore: 39.99, grade: 'F', remark: 'Fail', gradePoint: 0.0 },
    ];

    await this.prisma.gradingScale.createMany({
      data: defaultScales.map((s) => ({
        tenantId,
        name: 'Standard',
        ...s,
      })),
    });

    return this.prisma.gradingScale.findMany({
      where: { tenantId },
      orderBy: { minScore: 'desc' },
    });
  }

  async createGradingScale(tenantId: string, dto: CreateGradingScaleDto) {
    return this.prisma.gradingScale.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }

  // ================= Assessment Components =================
  async listComponents(tenantId: string) {
    return this.prisma.assessmentComponent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComponent(tenantId: string, dto: CreateAssessmentComponentDto) {
    return this.prisma.assessmentComponent.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  }

  // ================= Results Entry & Calculation =================
  private resolveGrade(score: number, scales: Array<{ minScore: number; maxScore: number; grade: string; remark: string; gradePoint: number | null }>) {
    for (const scale of scales) {
      if (score >= scale.minScore && score <= scale.maxScore) {
        return { grade: scale.grade, remark: scale.remark, gradePoint: scale.gradePoint };
      }
    }
    return { grade: 'F', remark: 'Fail', gradePoint: 0 };
  }

  async recordClassResults(tenantId: string, dto: RecordClassResultsDto) {
    const scales = await this.listGradingScales(tenantId);

    // Compute totals and ranks for the batch
    const scoredList = dto.scores.map((s) => {
      const assignment = s.assignmentScore ?? 0;
      const test = s.testScore ?? 0;
      const ca = s.caScore ?? 0;
      const exam = s.examScore ?? 0;
      const total = assignment + test + ca + exam;
      const grading = this.resolveGrade(total, scales);
      return {
        ...s,
        totalScore: Math.round(total * 100) / 100,
        grade: grading.grade,
        gradePoint: grading.gradePoint,
        remark: s.remark || grading.remark,
      };
    });

    // Rank within this subject batch
    const sorted = [...scoredList].sort((a, b) => b.totalScore - a.totalScore);
    const ranks = new Map<string, number>();
    sorted.forEach((item, index) => {
      ranks.set(item.studentId, index + 1);
    });

    const operations = scoredList.map((entry) => {
      return this.prisma.academicResult.upsert({
        where: {
          tenantId_studentId_classId_subjectId_sessionId_termId: {
            tenantId,
            studentId: entry.studentId,
            classId: dto.classId,
            subjectId: dto.subjectId,
            sessionId: dto.sessionId,
            termId: dto.termId,
          },
        },
        create: {
          tenantId,
          studentId: entry.studentId,
          classId: dto.classId,
          subjectId: dto.subjectId,
          sessionId: dto.sessionId,
          termId: dto.termId,
          assignmentScore: entry.assignmentScore,
          testScore: entry.testScore,
          caScore: entry.caScore,
          examScore: entry.examScore,
          totalScore: entry.totalScore,
          grade: entry.grade,
          gradePoint: entry.gradePoint,
          remark: entry.remark,
          subjectPosition: ranks.get(entry.studentId) ?? null,
          status: 'DRAFT',
        },
        update: {
          assignmentScore: entry.assignmentScore,
          testScore: entry.testScore,
          caScore: entry.caScore,
          examScore: entry.examScore,
          totalScore: entry.totalScore,
          grade: entry.grade,
          gradePoint: entry.gradePoint,
          remark: entry.remark,
          subjectPosition: ranks.get(entry.studentId) ?? null,
        },
      });
    });

    const results = await this.prisma.$transaction(operations);
    return {
      success: true,
      count: results.length,
      results,
    };
  }

  async queryResults(tenantId: string, query: QueryResultsDto) {
    return this.prisma.academicResult.findMany({
      where: {
        tenantId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { subject: { name: 'asc' } }],
    });
  }

  async approveResults(tenantId: string, userId: string, dto: ApproveResultsDto) {
    const where: any = {
      tenantId,
      classId: dto.classId,
      sessionId: dto.sessionId,
      termId: dto.termId,
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
    };

    let updateData: any;
    if (dto.action === 'APPROVE') {
      updateData = {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: userId,
      };
    } else if (dto.action === 'PUBLISH') {
      updateData = {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        locked: true,
        approvedByUserId: userId,
      };
    } else {
      updateData = { status: 'DRAFT', locked: false };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.academicResult.updateMany({ where, data: updateData });

      const affected = await tx.academicResult.findMany({
        where,
        select: { id: true },
      });
      if (affected.length > 0) {
        await tx.resultApproval.createMany({
          data: affected.map((r) => ({
            tenantId,
            resultId: r.id,
            action: dto.action,
            userId,
            notes: dto.notes ?? null,
          })),
        });
      }

      // Keep the term's publishing flags in sync with the result lifecycle.
      if (dto.action === 'PUBLISH') {
        await tx.term.updateMany({
          where: { id: dto.termId, tenantId },
          data: { resultPublished: true, resultEntryOpen: false },
        });
      } else if (dto.action === 'REJECT') {
        await tx.term.updateMany({
          where: { id: dto.termId, tenantId },
          data: { resultPublished: false },
        });
      }

      return updated;
    });

    return {
      success: true,
      action: dto.action,
      updatedCount: result.count,
    };
  }

  // ================= Student Term Report Card =================
  private buildRemarks(percentage: number): {
    teacher: string;
    principal: string;
  } {
    if (percentage >= 75) {
      return {
        teacher: 'An excellent performance. Keep up the outstanding work.',
        principal: 'Outstanding result. Cleared for promotion.',
      };
    }
    if (percentage >= 60) {
      return {
        teacher: 'A very good result. A little more effort will get you to the top.',
        principal: 'Good performance. Keep improving.',
      };
    }
    if (percentage >= 50) {
      return {
        teacher: 'A fair result. More focus is needed in the weaker subjects.',
        principal: 'Satisfactory. Work harder next term.',
      };
    }
    if (percentage >= 40) {
      return {
        teacher: 'Below average. Please attend extra lessons.',
        principal: 'Needs significant improvement.',
      };
    }
    return {
      teacher: 'Poor performance. Parental attention is required.',
      principal: 'Unsatisfactory. Placed on academic probation.',
    };
  }

  async getStudentReportCard(
    tenantId: string,
    studentId: string,
    sessionId: string,
    termId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { currentClass: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [profile, session, term, results] = await Promise.all([
      this.prisma.schoolProfile.findUnique({ where: { tenantId } }),
      this.prisma.academicSession.findFirst({ where: { id: sessionId, tenantId } }),
      this.prisma.term.findFirst({ where: { id: termId, tenantId } }),
      this.prisma.academicResult.findMany({
        where: {
          tenantId,
          studentId,
          sessionId,
          termId,
        },
        include: {
          subject: true,
        },
        orderBy: { subject: { name: 'asc' } },
      }),
    ]);

    // Compute per-subject class statistics and the student's class position.
    const classStats = new Map<
      string,
      { sum: number; count: number; max: number; min: number }
    >();
    let position: number | null = null;
    let totalInClass = 0;

    if (student.currentClassId) {
      const cohort = await this.prisma.academicResult.findMany({
        where: {
          tenantId,
          classId: student.currentClassId,
          sessionId,
          termId,
        },
        select: { studentId: true, subjectId: true, totalScore: true },
      });

      const aggregate = new Map<string, number>();
      for (const r of cohort) {
        aggregate.set(r.studentId, (aggregate.get(r.studentId) ?? 0) + r.totalScore);
        const stat =
          classStats.get(r.subjectId) ??
          { sum: 0, count: 0, max: Number.NEGATIVE_INFINITY, min: Number.POSITIVE_INFINITY };
        stat.sum += r.totalScore;
        stat.count += 1;
        stat.max = Math.max(stat.max, r.totalScore);
        stat.min = Math.min(stat.min, r.totalScore);
        classStats.set(r.subjectId, stat);
      }

      const ranked = [...aggregate.entries()].sort((a, b) => b[1] - a[1]);
      totalInClass = ranked.length;
      const index = ranked.findIndex(([sid]) => sid === studentId);
      position = index >= 0 ? index + 1 : null;
    }

    const totalSubjects = results.length;
    const obtainedMarks = results.reduce((acc, r) => acc + r.totalScore, 0);
    const totalMarks = totalSubjects * 100;
    const averageScore =
      totalSubjects > 0
        ? Math.round((obtainedMarks / totalSubjects) * 100) / 100
        : 0;
    const percentage =
      totalMarks > 0
        ? Math.round((obtainedMarks / totalMarks) * 10000) / 100
        : 0;
    const totalGpa = results.reduce((acc, r) => acc + (r.gradePoint ?? 0), 0);
    const gpa =
      totalSubjects > 0
        ? Math.round((totalGpa / totalSubjects) * 100) / 100
        : 0;
    const remarks = this.buildRemarks(percentage);

    return {
      school: profile,
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName}${
          student.middleName ? ' ' + student.middleName : ''
        } ${student.lastName}`,
        gender: student.gender,
        photo: student.passportPhoto,
        className: student.currentClass?.name ?? 'N/A',
      },
      session: session?.name ?? '',
      term: term?.name ?? '',
      class: student.currentClass
        ? {
            id: student.currentClass.id,
            name: student.currentClass.name,
            level: student.currentClass.level,
          }
        : null,
      results: results.map((r) => {
        const stat = classStats.get(r.subjectId);
        return {
          subjectId: r.subjectId,
          subjectName: r.subject.name,
          subjectCode: r.subject.code,
          assignmentScore: r.assignmentScore,
          testScore: r.testScore,
          caScore: r.caScore,
          examScore: r.examScore,
          totalScore: r.totalScore,
          grade: r.grade,
          gradePoint: r.gradePoint,
          remark: r.remark,
          subjectPosition: r.subjectPosition,
          classAverage: stat
            ? Math.round((stat.sum / stat.count) * 100) / 100
            : null,
          highestScore: stat ? stat.max : null,
          lowestScore: stat ? stat.min : null,
          status: r.status,
        };
      }),
      summary: {
        totalSubjects,
        totalMarks,
        obtainedMarks: Math.round(obtainedMarks * 100) / 100,
        averageScore,
        percentage,
        gpa,
        position,
        totalInClass,
        teacherRemark: remarks.teacher,
        principalRemark: remarks.principal,
      },
    };
  }

  // ================= Class Results Sheet (for publishing review) =================
  async getClassResultsSheet(
    tenantId: string,
    classId: string,
    sessionId: string,
    termId: string,
  ) {
    const [classroom, session, term, results] = await Promise.all([
      this.prisma.classRoom.findFirst({ where: { id: classId, tenantId } }),
      this.prisma.academicSession.findFirst({ where: { id: sessionId, tenantId } }),
      this.prisma.term.findFirst({ where: { id: termId, tenantId } }),
      this.prisma.academicResult.findMany({
        where: { tenantId, classId, sessionId, termId },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);
    if (!classroom) throw new NotFoundException('Class not found');

    const perStudent = new Map<
      string,
      {
        student: {
          id: string;
          admissionNumber: string;
          firstName: string;
          lastName: string;
        };
        obtained: number;
        subjects: Set<string>;
        statuses: Set<string>;
      }
    >();

    for (const r of results) {
      const entry =
        perStudent.get(r.studentId) ??
        {
          student: r.student,
          obtained: 0,
          subjects: new Set<string>(),
          statuses: new Set<string>(),
        };
      entry.obtained += r.totalScore;
      entry.subjects.add(r.subjectId);
      entry.statuses.add(r.status);
      perStudent.set(r.studentId, entry);
    }

    const students = [...perStudent.entries()]
      .map(([studentId, e]) => ({
        studentId,
        admissionNumber: e.student.admissionNumber,
        name: `${e.student.firstName} ${e.student.lastName}`,
        subjectsCount: e.subjects.size,
        obtained: Math.round(e.obtained * 100) / 100,
        possible: e.subjects.size * 100,
        average:
          e.subjects.size > 0
            ? Math.round((e.obtained / e.subjects.size) * 100) / 100
            : 0,
        status: e.statuses.has('PUBLISHED')
          ? 'PUBLISHED'
          : e.statuses.has('APPROVED')
            ? 'APPROVED'
            : 'DRAFT',
      }))
      .sort((a, b) => b.obtained - a.obtained)
      .map((row, index) => ({ ...row, position: index + 1 }));

    return {
      class: { id: classroom.id, name: classroom.name, level: classroom.level },
      session: session?.name ?? '',
      term: term?.name ?? '',
      subjectCount: new Set(results.map((r) => r.subjectId)).size,
      totalStudents: students.length,
      students,
    };
  }
}
