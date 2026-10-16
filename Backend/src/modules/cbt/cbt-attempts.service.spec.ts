import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CbtAttemptsService } from './cbt-attempts.service';
import { CbtExamsService } from './cbt-exams.service';

const TENANT = 't1';
const STUDENT = 'stu1';
const USER = 'u1';

const exam = {
  id: 'exam1',
  title: 'Mock CBT',
  category: 'MOCK',
  mode: 'MOCK',
  description: null,
  instructions: null,
  durationMinutes: 10,
  totalMarks: 3,
  passMark: 50,
  maxAttempts: 2,
  randomizeQuestions: false,
  randomizeOptions: false,
  showCorrectAnswers: false,
  showResultImmediately: true,
  negativeMarking: false,
  negativeMarkPerWrong: 0,
  subject: { id: 'sub1', code: 'MATH', name: 'Mathematics' },
  subjectId: 'sub1',
  classId: null,
  createdByUserId: 'u1',
};

const answerRows = [
  { id: 'a1', questionId: 'q1', selectedOptionId: 'q1a', markedForReview: false, isCorrect: false, marksAwarded: 0, updatedAt: new Date() },
  { id: 'a2', questionId: 'q2', selectedOptionId: 'q2a', markedForReview: true, isCorrect: false, marksAwarded: 0, updatedAt: new Date() },
  { id: 'a3', questionId: 'q3', selectedOptionId: 'q3a', markedForReview: false, isCorrect: false, marksAwarded: 0, updatedAt: new Date() },
];

const makeAttempt = (over: Record<string, unknown> = {}) => ({
  id: 'att1',
  tenantId: TENANT,
  examId: exam.id,
  studentId: STUDENT,
  attemptNumber: 1,
  status: 'IN_PROGRESS',
  startedAt: new Date(Date.now() - 60_000),
  expiresAt: new Date(Date.now() + 9 * 60_000),
  submittedAt: null,
  score: 0,
  totalMarks: 0,
  percentage: 0,
  correctCount: 0,
  incorrectCount: 0,
  unansweredCount: 0,
  passed: false,
  timeUsedSeconds: 0,
  exam,
  answers: answerRows,
  ...over,
});

const examQuestionRows = [
  {
    questionId: 'q1',
    marks: 1,
    question: {
      id: 'q1',
      text: 'Q1',
      imageUrl: null,
      marks: 1,
      difficulty: 'EASY',
      category: 'MOCK',
      topicName: null,
      options: [
        { id: 'q1a', label: 'A', text: 'one' },
        { id: 'q1b', label: 'B', text: 'two' },
      ],
    },
  },
  {
    questionId: 'q2',
    marks: 1,
    question: {
      id: 'q2',
      text: 'Q2',
      imageUrl: null,
      marks: 1,
      difficulty: 'EASY',
      category: 'MOCK',
      topicName: null,
      options: [
        { id: 'q2a', label: 'A', text: 'one' },
        { id: 'q2b', label: 'B', text: 'two' },
      ],
    },
  },
  {
    questionId: 'q3',
    marks: 1,
    question: {
      id: 'q3',
      text: 'Q3',
      imageUrl: null,
      marks: 1,
      difficulty: 'EASY',
      category: 'MOCK',
      topicName: null,
      options: [
        { id: 'q3a', label: 'A', text: 'one' },
        { id: 'q3b', label: 'B', text: 'two' },
      ],
    },
  },
];

// Correct answers: q1 => A, q2 => B, q3 => A
const scoringRows = examQuestionRows.map((row) => ({
  questionId: row.questionId,
  marks: row.marks,
  question: {
    marks: row.question.marks,
    options: row.question.options.map((option) => ({
      id: option.id,
      isCorrect: option.id === 'q1a' || option.id === 'q2b' || option.id === 'q3a',
    })),
  },
}));

describe('CbtAttemptsService', () => {
  let service: CbtAttemptsService;
  let prisma: any;
  let exams: { getForStudent: jest.Mock };

  beforeEach(async () => {
    prisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue({
          id: STUDENT,
          status: 'ACTIVE',
          currentClassId: null,
          firstName: 'Ada',
          lastName: 'Obi',
        }),
      },
      cbtExamAttempt: {
        findFirst: jest.fn().mockResolvedValue(makeAttempt()),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _max: { attemptNumber: 0 } }),
        update: jest.fn().mockResolvedValue({}),
      },
      cbtExamQuestion: { findMany: jest.fn().mockResolvedValue(examQuestionRows) },
      cbtExamAttemptAnswer: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      cbtQuestionOption: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (arg) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };

    exams = {
      getForStudent: jest.fn().mockResolvedValue({
        ...exam,
        isClosed: false,
        attemptsLeft: 2,
        openAttemptId: null,
        questionCount: 3,
        canStart: true,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CbtAttemptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CbtExamsService, useValue: exams },
      ],
    }).compile();

    service = moduleRef.get(CbtAttemptsService);
  });

  it('rejects an inactive student record', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: STUDENT, status: 'INACTIVE' });
    await expect(service.getAttempt(TENANT, USER, 'att1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects an account with no student record', async () => {
    prisma.student.findFirst.mockResolvedValue(null);
    await expect(service.getAttempt(TENANT, USER, 'att1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('scopes attempt lookups by tenant and student', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(null);
    await expect(service.getAttempt(TENANT, USER, 'att1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cbtExamAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att1', tenantId: TENANT, studentId: STUDENT },
      }),
    );
  });

  it('never exposes the correct option while the attempt is in progress', async () => {
    const result: any = await service.getAttempt(TENANT, USER, 'att1');
    expect(result.mode).toBe('attempt');
    for (const question of result.questions) {
      for (const option of question.options) {
        expect('isCorrect' in option).toBe(false);
      }
    }
    expect(result.review ?? null).toBeNull();
  });

  it('returns server-timed remaining seconds for a resumed attempt', async () => {
    const result: any = await service.getAttempt(TENANT, USER, 'att1');
    expect(result.attempt.remainingSeconds).toBeGreaterThan(0);
    expect(result.attempt.remainingSeconds).toBeLessThanOrEqual(600);
  });

  it('refuses to start when the exam window is closed', async () => {
    exams.getForStudent.mockResolvedValue({ ...exam, isClosed: true, startAt: null });
    await expect(service.start(TENANT, USER, { examId: exam.id })).rejects.toThrow(
      /window has closed|not started/i,
    );
  });

  it('resumes an existing live attempt instead of creating a new one', async () => {
    const result: any = await service.start(TENANT, USER, { examId: exam.id });
    expect(result.mode).toBe('attempt');
    expect(result.attempt.id).toBe('att1');
    expect(prisma.cbtExamAttempt.create).not.toHaveBeenCalled();
  });

  it('auto-submits an expired live attempt and consumes the try', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({ expiresAt: new Date(Date.now() - 1000) }),
    );
    prisma.cbtExamAttempt.count.mockResolvedValue(2); // both attempts used

    await expect(service.start(TENANT, USER, { examId: exam.id })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.cbtExamAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED' }),
      }),
    );
  });

  it('creates a new attempt with a server-computed expiry', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(null);
    prisma.cbtExamAttempt.aggregate.mockResolvedValue({ _max: { attemptNumber: 1 } });
    prisma.cbtExamAttempt.create.mockImplementation(async ({ data }: any) => ({
      ...makeAttempt(),
      ...data,
      answers: answerRows,
    }));

    const result: any = await service.start(TENANT, USER, { examId: exam.id });
    expect(result.mode).toBe('attempt');

    const createArgs = prisma.cbtExamAttempt.create.mock.calls[0][0];
    expect(createArgs.data.attemptNumber).toBe(2);
    const started = createArgs.data.startedAt as Date;
    const expires = createArgs.data.expiresAt as Date;
    // 10 minute exam => server-controlled 600s window
    expect(expires.getTime() - started.getTime()).toBe(10 * 60_000);
    // one answer row per question so progress can be restored
    expect(createArgs.data.answers.create).toHaveLength(3);
  });

  it('saves answers only after the database confirms', async () => {
    prisma.cbtExamQuestion.findMany.mockResolvedValue([{ questionId: 'q1' }]);
    prisma.cbtQuestionOption.findMany.mockResolvedValue([
      { id: 'q1a', questionId: 'q1' },
    ]);

    const result: any = await service.saveAnswers(TENANT, USER, 'att1', {
      answers: [{ questionId: 'q1', selectedOptionId: 'q1a', markedForReview: true }],
    });

    expect(result.saved).toBe(true);
    expect(prisma.cbtExamAttemptAnswer.upsert).toHaveBeenCalledTimes(1);
  });

  it('drops an option that does not belong to the question', async () => {
    prisma.cbtExamQuestion.findMany.mockResolvedValue([{ questionId: 'q1' }]);
    prisma.cbtQuestionOption.findMany.mockResolvedValue([
      { id: 'other', questionId: 'q2' },
    ]);

    await expect(
      service.saveAnswers(TENANT, USER, 'att1', {
        answers: [{ questionId: 'q1', selectedOptionId: 'other', markedForReview: false }],
      }),
    ).rejects.toThrow(/No valid answers/);
  });

  it('finalises an attempt that expired before the answers arrived', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const result: any = await service.saveAnswers(TENANT, USER, 'att1', {
      answers: [{ questionId: 'q1', selectedOptionId: 'q1a', markedForReview: false }],
    });

    expect(result).toEqual({ saved: false, expired: true });
    expect(prisma.cbtExamAttemptAnswer.upsert).not.toHaveBeenCalled();
  });

  it('scores the attempt on the backend, ignoring any client claim', async () => {
    prisma.cbtExamQuestion.findMany.mockResolvedValue(scoringRows);

    await service.submit(TENANT, USER, 'att1', {});

    const updateArgs = prisma.cbtExamAttempt.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'att1' });
    // q1 correct (1), q2 wrong (0), q3 correct (1) => 2 of 3
    expect(updateArgs.data).toMatchObject({
      score: 2,
      totalMarks: 3,
      correctCount: 2,
      incorrectCount: 1,
      unansweredCount: 0,
      percentage: 66.67,
      passed: true,
      status: 'SUBMITTED',
    });
  });

  it('is idempotent — submitting twice does not rescore', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({ status: 'SUBMITTED', submittedAt: new Date() }),
    );

    const result: any = await service.submit(TENANT, USER, 'att1', {});
    expect(result.alreadySubmitted).toBe(true);
    expect(prisma.cbtExamAttempt.update).not.toHaveBeenCalled();
  });

  it('hides the score when the school has not released results', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: 2,
        totalMarks: 3,
        percentage: 66.67,
        passed: true,
        exam: { ...exam, showResultImmediately: false },
      }),
    );

    const result: any = await service.getAttempt(TENANT, USER, 'att1');
    expect(result.mode).toBe('result');
    expect(result.visible).toBe(false);
    expect(result.attempt.score).toBeUndefined();
    expect(result.attempt.percentage).toBeUndefined();
    expect(result.review).toBeNull();
  });

  it('omits the review when correct answers are withheld', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: 2,
        totalMarks: 3,
        percentage: 66.67,
        passed: true,
        exam: { ...exam, showResultImmediately: true, showCorrectAnswers: false },
      }),
    );

    const result: any = await service.getAttempt(TENANT, USER, 'att1');
    expect(result.visible).toBe(true);
    expect(result.attempt.score).toBe(2);
    expect(result.canReview).toBe(false);
    expect(result.review).toBeNull();
  });

  it('returns a full review with correct answers when permitted', async () => {
    prisma.cbtExamAttempt.findFirst.mockResolvedValue(
      makeAttempt({
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: 2,
        totalMarks: 3,
        percentage: 66.67,
        passed: true,
        exam: { ...exam, showResultImmediately: true, showCorrectAnswers: true },
      }),
    );
    prisma.cbtExamQuestion.findMany.mockResolvedValue(
      examQuestionRows.map((row) => ({
        questionId: row.questionId,
        marks: row.marks,
        question: {
          id: row.questionId,
          text: row.question.text,
          explanation: 'Because.',
          marks: row.question.marks,
          options: row.question.options.map((option) => ({
            ...option,
            isCorrect: option.id === 'q1a',
          })),
        },
      })),
    );

    const result: any = await service.getAttempt(TENANT, USER, 'att1');
    expect(result.canReview).toBe(true);
    expect(result.review).toHaveLength(3);
    expect(result.review[0].options.some((o: any) => o.isCorrect)).toBe(true);
  });
});
