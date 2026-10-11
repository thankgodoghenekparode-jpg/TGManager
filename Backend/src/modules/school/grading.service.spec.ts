import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { GradingService } from './grading.service';

describe('GradingService', () => {
  let service: GradingService;
  let tx: {
    academicResult: { updateMany: jest.Mock; findMany: jest.Mock };
    resultApproval: { createMany: jest.Mock };
    term: { updateMany: jest.Mock };
  };
  let prisma: {
    gradingScale: { findMany: jest.Mock; createMany: jest.Mock };
    academicResult: {
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    student: { findFirst: jest.Mock };
    schoolProfile: { findUnique: jest.Mock };
    academicSession: { findFirst: jest.Mock };
    term: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const scales = [
    { minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent', gradePoint: 5 },
    { minScore: 0, maxScore: 69.99, grade: 'F', remark: 'Fail', gradePoint: 0 },
  ];

  beforeEach(async () => {
    tx = {
      academicResult: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]),
      },
      resultApproval: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      term: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      gradingScale: { findMany: jest.fn().mockResolvedValue(scales), createMany: jest.fn() },
      academicResult: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation((args) => ({ id: 'r', ...args.create })),
      },
      student: { findFirst: jest.fn() },
      schoolProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Demo School' }) },
      academicSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess1', name: '2025/2026' }) },
      term: { findFirst: jest.fn().mockResolvedValue({ id: 'term1', name: 'First Term' }) },
      $transaction: jest.fn((arg: unknown) =>
        Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => unknown)(tx),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [GradingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(GradingService);
  });

  describe('recordClassResults', () => {
    it('computes totals, assigns grades and ranks the batch', async () => {
      const result = await service.recordClassResults('t1', {
        classId: 'c1',
        subjectId: 'sub1',
        sessionId: 'sess1',
        termId: 'term1',
        scores: [
          { studentId: 'stu1', caScore: 30, examScore: 50 },
          { studentId: 'stu2', caScore: 10, examScore: 20 },
        ],
      } as never);

      expect(result.count).toBe(2);
      const firstUpsert = prisma.academicResult.upsert.mock.calls[0][0];
      expect(firstUpsert.create.totalScore).toBe(80);
      expect(firstUpsert.create.grade).toBe('A');
      expect(firstUpsert.create.subjectPosition).toBe(1);
      const secondUpsert = prisma.academicResult.upsert.mock.calls[1][0];
      expect(secondUpsert.create.grade).toBe('F');
      expect(secondUpsert.create.subjectPosition).toBe(2);
    });
  });

  describe('approveResults', () => {
    it('publishes results, writes an approval trail and locks the term', async () => {
      const result = await service.approveResults('t1', 'admin1', {
        classId: 'c1',
        sessionId: 'sess1',
        termId: 'term1',
        action: 'PUBLISH',
      } as never);

      expect(result).toMatchObject({ success: true, action: 'PUBLISH', updatedCount: 3 });
      expect(tx.academicResult.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PUBLISHED', locked: true }),
        }),
      );
      expect(tx.resultApproval.createMany).toHaveBeenCalled();
      expect(tx.term.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { resultPublished: true, resultEntryOpen: false },
        }),
      );
    });

    it('reopens the term when results are rejected', async () => {
      await service.approveResults('t1', 'admin1', {
        classId: 'c1',
        sessionId: 'sess1',
        termId: 'term1',
        action: 'REJECT',
      } as never);

      expect(tx.term.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { resultPublished: false } }),
      );
    });
  });

  describe('getStudentReportCard', () => {
    it('computes percentage, GPA, class position and remarks', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'stu1',
        admissionNumber: 'ADM1',
        firstName: 'Chinedu',
        middleName: null,
        lastName: 'Eze',
        gender: 'MALE',
        passportPhoto: null,
        currentClassId: 'c1',
        currentClass: { id: 'c1', name: 'JSS 1A', level: 'JSS1' },
      });

      prisma.academicResult.findMany
        .mockResolvedValueOnce([
          {
            subjectId: 'sub1',
            subject: { name: 'Maths', code: 'MTH' },
            assignmentScore: null,
            testScore: null,
            caScore: 30,
            examScore: 50,
            totalScore: 80,
            grade: 'A',
            gradePoint: 5,
            remark: 'Excellent',
            subjectPosition: 1,
            status: 'PUBLISHED',
          },
          {
            subjectId: 'sub2',
            subject: { name: 'English', code: 'ENG' },
            assignmentScore: null,
            testScore: null,
            caScore: 20,
            examScore: 40,
            totalScore: 60,
            grade: 'F',
            gradePoint: 0,
            remark: 'Fail',
            subjectPosition: 2,
            status: 'PUBLISHED',
          },
        ])
        .mockResolvedValueOnce([
          { studentId: 'stu1', subjectId: 'sub1', totalScore: 80 },
          { studentId: 'stu1', subjectId: 'sub2', totalScore: 60 },
          { studentId: 'stu2', subjectId: 'sub1', totalScore: 90 },
          { studentId: 'stu2', subjectId: 'sub2', totalScore: 95 },
        ]);

      const card = await service.getStudentReportCard('t1', 'stu1', 'sess1', 'term1');

      expect(card.summary.obtainedMarks).toBe(140);
      expect(card.summary.totalMarks).toBe(200);
      expect(card.summary.percentage).toBe(70);
      expect(card.summary.position).toBe(2);
      expect(card.summary.totalInClass).toBe(2);
      expect(card.summary.teacherRemark).toBeTruthy();
      expect(card.class).toMatchObject({ name: 'JSS 1A' });
      expect(card.student.fullName).toBe('Chinedu Eze');
      // class average for Maths = (80 + 90) / 2 = 85
      expect(card.results[0].classAverage).toBe(85);
    });
  });
});
