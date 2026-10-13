import type { PrismaClient } from '../generated/prisma/client';
import { seedSchoolResults } from './school-results-seed';

interface PrismaMock {
  tenant: { findUnique: jest.Mock };
  academicSession: { findFirst: jest.Mock };
  classSubject: { findMany: jest.Mock };
  student: { findMany: jest.Mock };
  gradingScale: { findMany: jest.Mock };
  user: { findFirst: jest.Mock };
  academicResult: {
    findMany: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
  };
  resultApproval: { findMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
}

function buildPrisma(): PrismaMock {
  return {
    tenant: { findUnique: jest.fn() },
    academicSession: { findFirst: jest.fn() },
    classSubject: { findMany: jest.fn() },
    student: { findMany: jest.fn() },
    gradingScale: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    academicResult: {
      findMany: jest.fn(),
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      update: jest.fn((args: unknown) => Promise.resolve(args)),
    },
    resultApproval: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const SCALES = [
  {
    name: 'S',
    minScore: 70,
    maxScore: 100,
    grade: 'A',
    remark: 'Excellent',
    gradePoint: 5,
  },
  {
    name: 'S',
    minScore: 60,
    maxScore: 69,
    grade: 'B',
    remark: 'Good',
    gradePoint: 4,
  },
  {
    name: 'S',
    minScore: 0,
    maxScore: 59,
    grade: 'F',
    remark: 'Fail',
    gradePoint: 0,
  },
];

function setupDemo(prisma: PrismaMock, term: Record<string, unknown>) {
  prisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
  prisma.academicSession.findFirst.mockResolvedValue({
    id: 's1',
    terms: [{ id: 'term1', startDate: new Date(), ...term }],
  });
  prisma.classSubject.findMany.mockResolvedValue([
    { classId: 'c1', subjectId: 'sub1' },
    { classId: 'c1', subjectId: 'sub2' },
  ]);
  prisma.student.findMany.mockResolvedValue([
    { id: 'stu1', currentClassId: 'c1' },
    { id: 'stu2', currentClassId: 'c1' },
  ]);
  prisma.gradingScale.findMany.mockResolvedValue(SCALES);
  prisma.user.findFirst.mockResolvedValue({ id: 'principal' });
}

describe('seedSchoolResults', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('skips cleanly when the demo school does not exist', async () => {
    const prisma = buildPrisma();
    prisma.tenant.findUnique.mockResolvedValue(null);

    const result = await seedSchoolResults(prisma as unknown as PrismaClient);

    expect(result).toEqual({
      terms: 0,
      students: 0,
      resultsCreated: 0,
      resultsExisting: 0,
      approvalsCreated: 0,
      positionsCorrected: 0,
    });
    expect(prisma.academicResult.createMany).not.toHaveBeenCalled();
  });

  it('skips upcoming terms', async () => {
    const prisma = buildPrisma();
    setupDemo(prisma, { status: 'UPCOMING', resultPublished: false });

    const result = await seedSchoolResults(prisma as unknown as PrismaClient);

    expect(result.terms).toBe(0);
    expect(prisma.academicResult.createMany).not.toHaveBeenCalled();
  });

  it('generates a full result set with grades and positions for an active term', async () => {
    const prisma = buildPrisma();
    setupDemo(prisma, { status: 'ACTIVE', resultPublished: false });
    // First findMany (position reconciliation) returns nothing; second
    // (approval audit) returns the freshly inserted result ids.
    prisma.academicResult.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'r1' },
        { id: 'r2' },
        { id: 'r3' },
        { id: 'r4' },
      ]);

    const result = await seedSchoolResults(prisma as unknown as PrismaClient);

    const rows = prisma.academicResult.createMany.mock.calls[0][0]
      .data as Array<Record<string, any>>;
    expect(rows).toHaveLength(4); // 2 students × 2 subjects

    for (const row of rows) {
      expect(row.status).toBe('APPROVED');
      expect(row.locked).toBe(false);
      expect(row.publishedAt).toBeNull();
      expect(row.approvedByUserId).toBe('principal');
      expect(row.grade).toMatch(/^[ABF]$/);
      expect(row.gradePoint).toBeDefined();
    }

    // Each subject is ranked independently, highest score first.
    for (const subjectId of ['sub1', 'sub2']) {
      const subjectRows = rows.filter((r) => r.subjectId === subjectId);
      const best = subjectRows.reduce((a, b) =>
        a.totalScore >= b.totalScore ? a : b,
      );
      expect(best.subjectPosition).toBe(1);
      expect(new Set(subjectRows.map((r) => r.subjectPosition))).toEqual(
        new Set([1, 2]),
      );
    }

    // Class positions cover both students.
    expect(new Set(rows.map((r) => r.classPosition))).toEqual(new Set([1, 2]));

    expect(result).toMatchObject({
      terms: 1,
      students: 2,
      resultsCreated: 4,
      resultsExisting: 0,
      approvalsCreated: 4,
    });
  });

  it('marks results PUBLISHED and locked for a completed term', async () => {
    const prisma = buildPrisma();
    setupDemo(prisma, { status: 'COMPLETED', resultPublished: true });
    prisma.academicResult.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'r1' },
        { id: 'r2' },
        { id: 'r3' },
        { id: 'r4' },
      ]);

    await seedSchoolResults(prisma as unknown as PrismaClient);

    const rows = prisma.academicResult.createMany.mock.calls[0][0]
      .data as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(row.status).toBe('PUBLISHED');
      expect(row.locked).toBe(true);
      expect(row.publishedAt).toBeInstanceOf(Date);
    }

    const approvalAction =
      prisma.resultApproval.createMany.mock.calls[0][0].data[0].action;
    expect(approvalAction).toBe('PUBLISH');
  });

  it('does not duplicate approvals for already-approved results', async () => {
    const prisma = buildPrisma();
    setupDemo(prisma, { status: 'ACTIVE', resultPublished: false });
    prisma.academicResult.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }]);
    prisma.resultApproval.findMany.mockResolvedValue([{ resultId: 'r1' }]);

    const result = await seedSchoolResults(prisma as unknown as PrismaClient);

    expect(prisma.resultApproval.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.resultApproval.createMany.mock.calls[0][0].data).toHaveLength(
      1,
    );
    expect(result.approvalsCreated).toBe(1);
  });
});
