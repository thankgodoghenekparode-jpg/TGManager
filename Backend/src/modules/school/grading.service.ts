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

    let targetStatus: 'APPROVED' | 'DRAFT' | 'PUBLISHED';
    let updateData: any = {};

    if (dto.action === 'APPROVE') {
      targetStatus = 'APPROVED';
      updateData = {
        status: targetStatus,
        approvedAt: new Date(),
        approvedByUserId: userId,
      };
    } else if (dto.action === 'PUBLISH') {
      targetStatus = 'PUBLISHED';
      updateData = {
        status: targetStatus,
        publishedAt: new Date(),
        locked: true,
      };
    } else {
      targetStatus = 'DRAFT';
      updateData = { status: targetStatus, locked: false };
    }

    const updated = await this.prisma.academicResult.updateMany({
      where,
      data: updateData,
    });

    return {
      success: true,
      action: dto.action,
      updatedCount: updated.count,
    };
  }

  // ================= Student Term Report Card =================
  async getStudentReportCard(tenantId: string, studentId: string, sessionId: string, termId: string) {
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

    const totalSubjects = results.length;
    const totalScore = results.reduce((acc, r) => acc + r.totalScore, 0);
    const averageScore = totalSubjects > 0 ? Math.round((totalScore / totalSubjects) * 100) / 100 : 0;
    const totalGpa = results.reduce((acc, r) => acc + (r.gradePoint ?? 0), 0);
    const gpa = totalSubjects > 0 ? Math.round((totalGpa / totalSubjects) * 100) / 100 : 0;

    return {
      school: profile,
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        fullName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`,
        class: student.currentClass?.name ?? 'N/A',
        gender: student.gender,
        photo: student.passportPhoto,
      },
      session: session?.name ?? '',
      term: term?.name ?? '',
      summary: {
        totalSubjects,
        totalScore,
        averageScore,
        gpa,
      },
      results: results.map((r) => ({
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        subjectCode: r.subject.code,
        assignmentScore: r.assignmentScore,
        testScore: r.testScore,
        caScore: r.caScore,
        examScore: r.examScore,
        totalScore: r.totalScore,
        grade: r.grade,
        remark: r.remark,
        subjectPosition: r.subjectPosition,
        status: r.status,
      })),
    };
  }
}
