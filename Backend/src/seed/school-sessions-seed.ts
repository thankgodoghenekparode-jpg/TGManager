import { PrismaClient } from '../generated/prisma/client';

/**
 * Demo school slug the mock sessions belong to.
 */
export const MOCK_SCHOOL_SLUG = 'tgeasy-model-college';

/**
 * Names of the mock academic sessions created by `seedSchoolSessions`.
 *
 * Every name carries a `(Demo)` suffix so the sessions are trivial to spot in
 * the UI and, more importantly, so `cleanupSchoolSessions` can safely delete
 * exactly these rows without touching any real session a school may create.
 */
export const MOCK_SESSION_NAMES = [
  '2024/2025 Academic Session (Demo)',
  '2023/2024 Academic Session (Demo)',
  '2022/2023 Academic Session (Demo)',
] as const;

interface MockTerm {
  name: string;
  status: 'COMPLETED' | 'ACTIVE' | 'UPCOMING';
  startDate: string;
  endDate: string;
  resultPublished: boolean;
  resultEntryOpen: boolean;
}

interface MockSession {
  name: string;
  startDate: string;
  endDate: string;
  terms: MockTerm[];
}

const COMPLETED_TERMS = (year: number): MockTerm[] => [
  {
    name: '1st Term',
    status: 'COMPLETED',
    startDate: `${year}-09-09`,
    endDate: `${year}-12-20`,
    resultPublished: true,
    resultEntryOpen: false,
  },
  {
    name: '2nd Term',
    status: 'COMPLETED',
    startDate: `${year + 1}-01-13`,
    endDate: `${year + 1}-04-11`,
    resultPublished: true,
    resultEntryOpen: false,
  },
  {
    name: '3rd Term',
    status: 'COMPLETED',
    startDate: `${year + 1}-04-28`,
    endDate: `${year + 1}-07-25`,
    resultPublished: true,
    resultEntryOpen: false,
  },
];

/**
 * Three fully-completed past sessions, each with the standard Nigerian
 * three-term calendar. They are intentionally inert: no classes, results or
 * invoices point at them, so deleting them is always safe.
 */
const MOCK_SESSIONS: MockSession[] = [
  {
    name: MOCK_SESSION_NAMES[0],
    startDate: '2024-09-09',
    endDate: '2025-07-25',
    terms: COMPLETED_TERMS(2024),
  },
  {
    name: MOCK_SESSION_NAMES[1],
    startDate: '2023-09-11',
    endDate: '2024-07-26',
    terms: COMPLETED_TERMS(2023),
  },
  {
    name: MOCK_SESSION_NAMES[2],
    startDate: '2022-09-12',
    endDate: '2023-07-28',
    terms: COMPLETED_TERMS(2022),
  },
];

async function getSchoolTenantId(
  prisma: PrismaClient,
): Promise<{ id: string; name: string } | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: MOCK_SCHOOL_SLUG },
    select: { id: true, name: true },
  });
  return tenant;
}

/**
 * Loads the mock academic sessions for the demo school.
 *
 * Idempotent: sessions that already exist are skipped, so this is safe to call
 * on every seed run. Returns the number of sessions actually created.
 */
export async function seedSchoolSessions(
  prisma: PrismaClient,
): Promise<number> {
  const tenant = await getSchoolTenantId(prisma);
  if (!tenant) {
    console.log(
      `   Mock sessions skipped: demo school (${MOCK_SCHOOL_SLUG}) not found.`,
    );
    return 0;
  }

  let created = 0;

  for (const session of MOCK_SESSIONS) {
    const existing = await prisma.academicSession.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: session.name } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.$transaction(async (tx) => {
      const row = await tx.academicSession.create({
        data: {
          tenantId: tenant.id,
          name: session.name,
          isCurrent: false,
          startDate: new Date(session.startDate),
          endDate: new Date(session.endDate),
        },
      });

      await tx.term.createMany({
        data: session.terms.map((term) => ({
          tenantId: tenant.id,
          sessionId: row.id,
          name: term.name,
          status: term.status,
          isCurrent: false,
          resultEntryOpen: term.resultEntryOpen,
          resultPublished: term.resultPublished,
          startDate: new Date(term.startDate),
          endDate: new Date(term.endDate),
        })),
      });
    });

    created += 1;
  }

  if (created > 0) {
    console.log(
      `   ✓ Mock academic sessions (${created} new): ${MOCK_SESSIONS.map((s) => s.name).join(', ')}`,
    );
  } else {
    console.log('   Mock academic sessions already present. Skipping.');
  }

  return created;
}

export interface CleanupSessionsResult {
  sessions: number;
  terms: number;
}

/**
 * Deletes exactly the mock sessions created by `seedSchoolSessions` (and their
 * terms, via cascade). Real sessions are never touched.
 */
export async function cleanupSchoolSessions(
  prisma: PrismaClient,
): Promise<CleanupSessionsResult> {
  const tenant = await getSchoolTenantId(prisma);
  if (!tenant) {
    console.log(
      `   Mock session cleanup skipped: demo school (${MOCK_SCHOOL_SLUG}) not found.`,
    );
    return { sessions: 0, terms: 0 };
  }

  const sessions = await prisma.academicSession.findMany({
    where: {
      tenantId: tenant.id,
      name: { in: [...MOCK_SESSION_NAMES] },
    },
    select: { id: true },
  });

  const ids = sessions.map((s) => s.id);
  if (ids.length === 0) {
    console.log('   No mock academic sessions to remove.');
    return { sessions: 0, terms: 0 };
  }

  const terms = await prisma.term.count({
    where: { sessionId: { in: ids } },
  });

  // Terms, fee structures and invoices cascade / null-out automatically.
  await prisma.academicSession.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `   ✓ Removed ${ids.length} mock academic session(s) and ${terms} term(s).`,
  );
  return { sessions: ids.length, terms };
}
