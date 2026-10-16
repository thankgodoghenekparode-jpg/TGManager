import { CBT_CATEGORIES } from './cbt.constants';
import { CBT_SEED_PLAN } from './cbt-defaults.data';
import { resetCbtForTenant, seedCbtDefaults } from './cbt-defaults';

/** Minimal in-memory stand-in for the Prisma calls the seeder makes. */
function fakePrisma(overrides: {
  subjects?: Array<{ id: string; name: string }>;
  existingQuestions?: Record<string, number>;
} = {}) {
  const subjects = overrides.subjects ?? [{ id: 'subj-1', name: 'Mathematics' }];
  const existing = overrides.existingQuestions ?? {};

  return {
    subject: { findMany: jest.fn().mockResolvedValue(subjects) },
    cbtQuestion: {
      count: jest.fn(({ where }: any) =>
        Promise.resolve(existing[where.category] ?? 0),
      ),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cbtTopic: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cbtQuestionOption: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    cbtExam: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'exam-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cbtExamQuestion: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    cbtExamAttempt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

describe('CBT categories', () => {
  it('exposes exactly the four examination tracks', () => {
    expect(CBT_CATEGORIES).toEqual(['WAEC', 'NECO', 'JAMB', 'MOCK']);
  });

  it('ships a default bank for every category', () => {
    expect(CBT_SEED_PLAN.map((plan) => plan.category)).toEqual([
      ...CBT_CATEGORIES,
    ]);
    for (const plan of CBT_SEED_PLAN) {
      expect(plan.questions.length).toBeGreaterThan(5);
      // Every question must have a valid correct-answer index.
      for (const question of plan.questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.correct).toBeGreaterThanOrEqual(0);
        expect(question.correct).toBeLessThan(question.options.length);
      }
    }
  });
});

describe('seedCbtDefaults', () => {
  it('creates a question bank and one examination per category', async () => {
    const prisma = fakePrisma();
    const result = await seedCbtDefaults(prisma as never, 'tenant-1', {
      createdByUserId: 'user-1',
    });

    const expectedQuestions = CBT_SEED_PLAN.reduce(
      (sum, plan) => sum + plan.questions.length,
      0,
    );
    expect(result.questions).toBe(expectedQuestions);
    expect(result.exams).toBe(CBT_SEED_PLAN.length);
    expect(result.skipped).toEqual([]);
    expect(prisma.cbtQuestion.createMany).toHaveBeenCalledTimes(
      CBT_SEED_PLAN.length,
    );
    expect(prisma.cbtExam.create).toHaveBeenCalledTimes(CBT_SEED_PLAN.length);
    // Options are written in a batched call per category.
    expect(prisma.cbtQuestionOption.createMany).toHaveBeenCalledTimes(
      CBT_SEED_PLAN.length,
    );
  });

  it('leaves a category that already has questions untouched', async () => {
    const prisma = fakePrisma({ existingQuestions: { WAEC: 12 } });
    const result = await seedCbtDefaults(prisma as never, 'tenant-1');

    expect(result.skipped).toEqual(['WAEC']);
    expect(result.exams).toBe(CBT_SEED_PLAN.length - 1);
  });

  it('does nothing when the school has no subjects', async () => {
    const prisma = fakePrisma({ subjects: [] });
    const result = await seedCbtDefaults(prisma as never, 'tenant-1');

    expect(result).toEqual({ questions: 0, exams: 0, topics: 0, skipped: [] });
    expect(prisma.cbtQuestion.createMany).not.toHaveBeenCalled();
  });

  it('tags every seeded question as TGManager content', async () => {
    const prisma = fakePrisma();
    await seedCbtDefaults(prisma as never, 'tenant-1');
    for (const call of prisma.cbtQuestion.createMany.mock.calls) {
      for (const row of call[0].data) {
        expect(row.source).toBe('TGMANAGER');
        expect(row.status).toBe('ACTIVE');
      }
    }
  });
});

describe('resetCbtForTenant', () => {
  it('removes attempts, exams, questions and topics for the tenant', async () => {
    const prisma = fakePrisma();
    await resetCbtForTenant(prisma as never, 'tenant-1');

    expect(prisma.cbtExamAttempt.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
    expect(prisma.cbtExam.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
    expect(prisma.cbtQuestion.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
    expect(prisma.cbtTopic.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
    });
  });
});
