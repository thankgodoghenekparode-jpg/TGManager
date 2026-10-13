import { PrismaClient } from '../generated/prisma/client';

/** Demo school slug the seeded term results belong to. */
export const DEMO_SCHOOL_SLUG = 'tgeasy-model-college';

/** Email of the demo principal used as the approver on seeded results. */
const DEMO_PRINCIPAL_EMAIL = 'principal@tgeasymodel.edu.ng';

/**
 * Generous bounds for the position-reconciliation transaction. The remote
 * pooler can be slow, and although reconciliation usually writes nothing we
 * don't want a legitimate fix-up to trip Prisma's 5s default timeout.
 */
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 } as const;

export interface SeedSchoolResultsResult {
  /** Number of terms that were considered for seeding. */
  terms: number;
  /** Number of enrolled students the results were generated for. */
  students: number;
  /** Number of result rows actually inserted. */
  resultsCreated: number;
  /** Number of result rows that already existed (skipped). */
  resultsExisting: number;
  /** Number of approval/publish audit rows inserted. */
  approvalsCreated: number;
  /** Number of stored positions corrected during reconciliation. */
  positionsCorrected: number;
}

type ResultStatusLiteral = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED';

interface GradingBand {
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
  gradePoint: number | null;
}

interface GeneratedResult {
  tenantId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  sessionId: string;
  termId: string;
  assignmentScore: number;
  testScore: number;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string | null;
  gradePoint: number | null;
  remark: string | null;
  subjectPosition: number | null;
  classPosition: number | null;
  status: ResultStatusLiteral;
  locked: boolean;
  submittedAt: Date;
  approvedAt: Date;
  publishedAt: Date | null;
  approvedByUserId: string | null;
}

/** FNV-1a 32-bit hash — deterministic across runs and process restarts. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A believable, stable overall mark (0–100) for a student in a subject/term.
 * Student ability dominates so the same pupils trend near the top of the class,
 * while subject variation and a per-term nudge keep every sheet distinct.
 */
function performanceMark(
  studentId: string,
  subjectId: string,
  termId: string,
): number {
  const ability = 50 + (hash(studentId) % 30); // 50–79 baseline ability
  const subjectLean = hash(`${studentId}:${subjectId}`) % 21; // 0–20
  const termNudge = (hash(`${studentId}:${termId}`) % 9) - 4; // -4–4
  return Math.max(
    35,
    Math.min(98, ability + Math.round(subjectLean * 0.7) + termNudge),
  );
}

function resolveGrade(bands: GradingBand[], score: number): GradingBand | null {
  return bands.find((b) => score >= b.minScore && score <= b.maxScore) ?? null;
}

/**
 * Ranks entries by score (highest first) with a stable student-id tie-break, so
 * positions are identical whether computed in memory or re-derived from the
 * database.
 */
function rank<T extends { studentId: string; totalScore: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.studentId === b.studentId) return 0;
    return a.studentId < b.studentId ? -1 : 1;
  });
}

/**
 * Recomputes subject/class positions from the scores actually stored for a
 * term. Only rows whose position changed are written, so this is a no-op on a
 * fully-seeded term and a cheap fix-up when legacy rows predate this seed.
 * Returns the number of rows corrected.
 */
async function reconcilePositions(
  prisma: PrismaClient,
  tenantId: string,
  sessionId: string,
  termId: string,
): Promise<number> {
  const rows = await prisma.academicResult.findMany({
    where: { tenantId, sessionId, termId },
    select: {
      id: true,
      classId: true,
      subjectId: true,
      studentId: true,
      totalScore: true,
      subjectPosition: true,
      classPosition: true,
    },
  });
  if (rows.length === 0) return 0;

  const bySubject = new Map<string, typeof rows>();
  const classTotals = new Map<
    string,
    Array<{ studentId: string; totalScore: number }>
  >();
  for (const row of rows) {
    const subjectKey = `${row.classId}:${row.subjectId}`;
    const list = bySubject.get(subjectKey);
    if (list) list.push(row);
    else bySubject.set(subjectKey, [row]);

    const totals = classTotals.get(row.classId) ?? [];
    const existing = totals.find((t) => t.studentId === row.studentId);
    if (existing) existing.totalScore += row.totalScore;
    else totals.push({ studentId: row.studentId, totalScore: row.totalScore });
    classTotals.set(row.classId, totals);
  }

  const subjectPosition = new Map<string, number>();
  for (const list of bySubject.values()) {
    rank(list).forEach((row, index) => subjectPosition.set(row.id, index + 1));
  }

  const classPosition = new Map<string, number>();
  for (const [classId, totals] of classTotals) {
    rank(totals).forEach((entry, index) =>
      classPosition.set(`${classId}:${entry.studentId}`, index + 1),
    );
  }

  const updates: Array<{
    id: string;
    subjectPosition: number | null;
    classPosition: number | null;
  }> = [];
  for (const row of rows) {
    const nextSubject = subjectPosition.get(row.id) ?? null;
    const nextClass =
      classPosition.get(`${row.classId}:${row.studentId}`) ?? null;
    if (
      nextSubject === row.subjectPosition &&
      nextClass === row.classPosition
    ) {
      continue;
    }
    updates.push({
      id: row.id,
      subjectPosition: nextSubject,
      classPosition: nextClass,
    });
  }

  if (updates.length === 0) return 0;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.academicResult.update({
        where: { id: u.id },
        data: {
          subjectPosition: u.subjectPosition,
          classPosition: u.classPosition,
        },
      }),
    ),
    TRANSACTION_OPTIONS,
  );

  return updates.length;
}

/**
 * Seeds comprehensive, realistic term results for the demo school:
 * every enrolled student gets a score in every subject their class offers, for
 * each term that has already started on the current academic session.
 *
 * Completed / published terms are stored as `PUBLISHED` and locked, while the
 * in-progress term is stored as `APPROVED` so it stays editable and
 * demonstrable on the grading screen, yet still visible to parents.
 *
 * Idempotent: rows are inserted with `skipDuplicates`, so re-running never
 * duplicates or overwrites existing (possibly hand-edited) scores. Stored
 * positions are reconciled against the actual scores on every run.
 */
export async function seedSchoolResults(
  prisma: PrismaClient,
): Promise<SeedSchoolResultsResult> {
  const summary: SeedSchoolResultsResult = {
    terms: 0,
    students: 0,
    resultsCreated: 0,
    resultsExisting: 0,
    approvalsCreated: 0,
    positionsCorrected: 0,
  };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SCHOOL_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.log(
      `   Results seed skipped: demo school (${DEMO_SCHOOL_SLUG}) not found.`,
    );
    return summary;
  }

  const session = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
    include: { terms: { orderBy: { startDate: 'asc' } } },
  });
  if (!session) {
    console.log(
      '   Results seed skipped: no current academic session for the demo school.',
    );
    return summary;
  }

  const terms = session.terms.filter((term) => term.status !== 'UPCOMING');
  if (terms.length === 0) {
    console.log(
      '   Results seed skipped: the current session has no active/completed terms.',
    );
    return summary;
  }

  const [classSubjects, students, scaleRows, approver] = await Promise.all([
    prisma.classSubject.findMany({
      where: { tenantId: tenant.id },
      select: { classId: true, subjectId: true },
    }),
    prisma.student.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, currentClassId: true },
    }),
    prisma.gradingScale.findMany({ where: { tenantId: tenant.id } }),
    prisma.user.findFirst({
      where: { email: DEMO_PRINCIPAL_EMAIL },
      select: { id: true },
    }),
  ]);

  const bands: GradingBand[] = scaleRows
    .map((scale) => ({
      minScore: scale.minScore,
      maxScore: scale.maxScore,
      grade: scale.grade,
      remark: scale.remark,
      gradePoint: scale.gradePoint,
    }))
    .sort((a, b) => b.minScore - a.minScore);

  const studentsByClass = new Map<string, string[]>();
  for (const student of students) {
    if (!student.currentClassId) continue;
    const list = studentsByClass.get(student.currentClassId);
    if (list) list.push(student.id);
    else studentsByClass.set(student.currentClassId, [student.id]);
  }
  if (studentsByClass.size === 0) {
    console.log(
      '   Results seed skipped: the demo school has no enrolled students.',
    );
    return summary;
  }

  const subjectsByClass = new Map<string, string[]>();
  for (const classSubject of classSubjects) {
    const list = subjectsByClass.get(classSubject.classId);
    if (list) list.push(classSubject.subjectId);
    else subjectsByClass.set(classSubject.classId, [classSubject.subjectId]);
  }

  const approverId = approver?.id ?? null;
  summary.students = students.length;

  for (const term of terms) {
    const published = term.status === 'COMPLETED' || term.resultPublished;
    const status: ResultStatusLiteral = published ? 'PUBLISHED' : 'APPROVED';
    const now = new Date();

    // Build the full intended result set and rank it in memory.
    const generated: GeneratedResult[] = [];
    const classTotals = new Map<
      string,
      Array<{ studentId: string; totalScore: number }>
    >();

    for (const [classId, subjectIds] of subjectsByClass) {
      const classStudents = studentsByClass.get(classId) ?? [];
      if (classStudents.length === 0) continue;

      const totals = classTotals.get(classId) ?? [];
      classTotals.set(classId, totals);

      for (const subjectId of subjectIds) {
        const scored = classStudents.map((studentId) => {
          const mark = performanceMark(studentId, subjectId, term.id);
          const caScore = Math.round((mark / 100) * 40);
          const examScore = Math.round((mark / 100) * 60);
          return {
            studentId,
            caScore,
            examScore,
            totalScore: caScore + examScore,
          };
        });

        const subjectPosition = new Map<string, number>();
        rank(scored).forEach((row, index) =>
          subjectPosition.set(row.studentId, index + 1),
        );

        for (const row of scored) {
          const total = totals.find((t) => t.studentId === row.studentId);
          if (total) total.totalScore += row.totalScore;
          else
            totals.push({
              studentId: row.studentId,
              totalScore: row.totalScore,
            });

          const band = resolveGrade(bands, row.totalScore);
          const firstCa = Math.round(row.caScore / 2);
          generated.push({
            tenantId: tenant.id,
            studentId: row.studentId,
            classId,
            subjectId,
            sessionId: session.id,
            termId: term.id,
            assignmentScore: firstCa,
            testScore: row.caScore - firstCa,
            caScore: row.caScore,
            examScore: row.examScore,
            totalScore: row.totalScore,
            grade: band?.grade ?? null,
            gradePoint: band?.gradePoint ?? null,
            remark: band?.remark ?? null,
            subjectPosition: subjectPosition.get(row.studentId) ?? null,
            classPosition: null,
            status,
            locked: published,
            submittedAt: now,
            approvedAt: now,
            publishedAt: published ? now : null,
            approvedByUserId: approverId,
          });
        }
      }
    }

    if (generated.length === 0) continue;

    // Class position = rank by aggregate score across the class's subjects.
    const classPosition = new Map<string, number>();
    for (const [classId, totals] of classTotals) {
      rank(totals).forEach((entry, index) =>
        classPosition.set(`${classId}:${entry.studentId}`, index + 1),
      );
    }
    for (const row of generated) {
      row.classPosition =
        classPosition.get(`${row.classId}:${row.studentId}`) ?? null;
    }

    const created = await prisma.academicResult.createMany({
      data: generated,
      skipDuplicates: true,
    });

    summary.terms += 1;
    summary.resultsCreated += created.count;
    summary.resultsExisting += generated.length - created.count;

    // Keep stored positions consistent with the actual scores (no-op once the
    // term is fully seeded; corrects any legacy/partial rows otherwise).
    summary.positionsCorrected += await reconcilePositions(
      prisma,
      tenant.id,
      session.id,
      term.id,
    );

    // Record a single approval/publish audit-trail entry per result.
    const termResults = await prisma.academicResult.findMany({
      where: { tenantId: tenant.id, sessionId: session.id, termId: term.id },
      select: { id: true },
    });
    const alreadyApproved = await prisma.resultApproval.findMany({
      where: {
        tenantId: tenant.id,
        resultId: { in: termResults.map((r) => r.id) },
      },
      select: { resultId: true },
    });
    const approvedIds = new Set(alreadyApproved.map((a) => a.resultId));
    const approvals = termResults
      .filter((result) => !approvedIds.has(result.id))
      .map((result) => ({
        tenantId: tenant.id,
        resultId: result.id,
        action: published ? 'PUBLISH' : 'APPROVE',
        userId: approverId ?? 'seed',
        notes: 'Seeded demo result',
      }));
    if (approvals.length > 0) {
      await prisma.resultApproval.createMany({ data: approvals });
      summary.approvalsCreated += approvals.length;
    }
  }

  if (summary.resultsCreated > 0) {
    console.log(
      `   ✓ Seeded ${summary.resultsCreated} term result(s) for ` +
        `${summary.students} student(s) across ${summary.terms} term(s) ` +
        `(${summary.approvalsCreated} approval record(s)).`,
    );
  } else {
    console.log(
      `   Demo term results already present (${summary.resultsExisting} row(s)). Skipping.`,
    );
  }
  if (summary.positionsCorrected > 0) {
    console.log(
      `   ✓ Corrected ${summary.positionsCorrected} stored result position(s).`,
    );
  }

  return summary;
}
