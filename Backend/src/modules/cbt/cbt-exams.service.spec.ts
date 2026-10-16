import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CbtExamsService } from './cbt-exams.service';
import type { CreateExamDto, UpdateExamDto } from './dto/cbt.dto';

const TENANT = 't1';

const baseDto = (over: Partial<CreateExamDto> = {}): CreateExamDto => ({
  title: 'Mid-term Mock',
  category: 'MOCK',
  mode: 'MOCK',
  subjectId: 'sub1',
  classId: null,
  description: null,
  instructions: null,
  durationMinutes: 30,
  passMark: 50,
  questionIds: ['q1', 'q2'],
  autoPickCount: 0,
  randomizeQuestions: false,
  randomizeOptions: false,
  maxAttempts: 1,
  showResultImmediately: true,
  showCorrectAnswers: false,
  negativeMarking: false,
  negativeMarkPerWrong: 0,
  startAt: null,
  endAt: null,
  status: 'DRAFT',
  assignClassId: null,
  assignStudentIds: [],
  ...over,
});

describe('CbtExamsService', () => {
  let service: CbtExamsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 'sub1' }) },
      classRoom: { findFirst: jest.fn().mockResolvedValue({ id: 'class1' }) },
      student: { findMany: jest.fn().mockResolvedValue([]) },
      cbtQuestion: { findMany: jest.fn().mockResolvedValue([]) },
      cbtExam: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'exam1', ...data })),
        update: jest.fn().mockResolvedValue({ id: 'exam1' }),
        delete: jest.fn().mockResolvedValue({ id: 'exam1' }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      cbtExamQuestion: { findMany: jest.fn().mockResolvedValue([]) },
      cbtExamAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cbtExamAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg,
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CbtExamsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CbtExamsService);
  });

  it('computes total marks from the questions it actually stored', async () => {
    prisma.cbtQuestion.findMany.mockResolvedValue([
      { id: 'q1', marks: 2 },
      { id: 'q2', marks: 3 },
    ]);

    await service.create(TENANT, 'u1', baseDto());

    const createArgs = prisma.cbtExam.create.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(TENANT);
    expect(createArgs.data.totalMarks).toBe(5);
    expect(createArgs.data.questions.create).toEqual([
      { questionId: 'q1', order: 0, marks: 2 },
      { questionId: 'q2', order: 1, marks: 3 },
    ]);
  });

  it('only loads questions that belong to the tenant and are not archived', async () => {
    prisma.cbtQuestion.findMany.mockResolvedValue([{ id: 'q1', marks: 1 }]);

    await expect(service.create(TENANT, 'u1', baseDto())).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.cbtQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT,
          status: { not: 'ARCHIVED' },
        }),
      }),
    );
  });

  it('refuses a random pick larger than the bank holds', async () => {
    prisma.cbtQuestion.findMany.mockResolvedValue([{ id: 'q1', marks: 1 }]);
    await expect(
      service.create(TENANT, 'u1', baseDto({ questionIds: [], autoPickCount: 10 })),
    ).rejects.toThrow(/Only 1 matching question/);
  });

  it('rejects students that do not belong to the tenant', async () => {
    prisma.cbtQuestion.findMany.mockResolvedValue([{ id: 'q1', marks: 1 }]);
    prisma.student.findMany.mockResolvedValue([{ id: 'stu1' }]);
    await expect(
      service.create(
        TENANT,
        'u1',
        baseDto({ questionIds: ['q1'], assignStudentIds: ['stu1', 'stu2'] }),
      ),
    ).rejects.toThrow(/not found for this school/);
  });

  it('rejects a subject from another school', async () => {
    prisma.subject.findFirst.mockResolvedValue(null);
    await expect(service.create(TENANT, 'u1', baseDto())).rejects.toThrow(
      /Subject not found/,
    );
  });

  it('scopes the student exam list to the tenant, published status and targeting', async () => {
    prisma.cbtExam.findMany.mockResolvedValue([]);
    await service.listForStudent(TENANT, 'stu1', 'class1');

    const where = prisma.cbtExam.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.status).toBe('PUBLISHED');
    expect(Array.isArray(where.OR)).toBe(true);
  });

  it('blocks a student who is not targeted by a targeted exam', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      title: 'Mock',
      classId: 'other-class',
      startAt: null,
      endAt: null,
      maxAttempts: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      showCorrectAnswers: false,
      showResultImmediately: true,
      negativeMarking: false,
      negativeMarkPerWrong: 0,
      subject: null,
      class: { id: 'other-class', name: 'Other' },
      _count: { questions: 5 },
      attempts: [],
    });
    prisma.student.findFirst = jest.fn().mockResolvedValue({ currentClassId: 'class1' });
    prisma.cbtExamAssignment.findFirst.mockResolvedValue(null);
    prisma.cbtExamAssignment.count.mockResolvedValue(2);

    await expect(service.getForStudent(TENANT, 'stu1', 'exam1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows an untargeted published exam for any student in the school', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      title: 'General practice',
      classId: null,
      startAt: null,
      endAt: null,
      maxAttempts: 3,
      randomizeQuestions: false,
      randomizeOptions: false,
      showCorrectAnswers: false,
      showResultImmediately: true,
      negativeMarking: false,
      negativeMarkPerWrong: 0,
      subject: null,
      class: null,
      _count: { questions: 5 },
      attempts: [],
    });
    prisma.student.findFirst = jest.fn().mockResolvedValue({ currentClassId: 'class1' });
    prisma.cbtExamAssignment.findFirst.mockResolvedValue(null);
    prisma.cbtExamAssignment.count.mockResolvedValue(0);

    const result = await service.getForStudent(TENANT, 'stu1', 'exam1');
    expect(result.canStart).toBe(true);
    expect(result.questionCount).toBe(5);
  });

  it('refuses to swap questions once an exam has attempts', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      durationMinutes: 30,
      startAt: null,
      endAt: null,
      subjectId: 'sub1',
      classId: null,
      _count: { attempts: 3 },
    });

    await expect(
      service.update(TENANT, 'exam1', { questionIds: ['q9'] } as UpdateExamDto),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('shifts the expiry of open attempts when the duration changes', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      durationMinutes: 30,
      startAt: null,
      endAt: null,
      subjectId: 'sub1',
      classId: null,
      _count: { attempts: 0 },
    });
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    prisma.cbtExamAttempt.findMany.mockResolvedValue([{ id: 'att1', expiresAt }]);

    await service.update(TENANT, 'exam1', { durationMinutes: 40 } as UpdateExamDto);

    const updateArgs = prisma.cbtExamAttempt.update.mock.calls[0][0];
    // +10 minutes of remaining time
    expect(updateArgs.data.expiresAt.getTime()).toBe(expiresAt.getTime() + 10 * 60_000);
  });

  it('archives an exam that already has attempts instead of deleting it', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      _count: { attempts: 2 },
    });

    const result = await service.remove(TENANT, 'exam1');
    expect(result).toEqual({ success: true, action: 'archived' });
    expect(prisma.cbtExam.delete).not.toHaveBeenCalled();
    expect(prisma.cbtExam.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ARCHIVED' } }),
    );
  });

  it('hard-deletes an exam with no attempts', async () => {
    prisma.cbtExam.findFirst.mockResolvedValue({
      id: 'exam1',
      _count: { attempts: 0 },
    });

    const result = await service.remove(TENANT, 'exam1');
    expect(result).toEqual({ success: true, action: 'deleted' });
    expect(prisma.cbtExam.delete).toHaveBeenCalledWith({ where: { id: 'exam1' } });
  });
});
