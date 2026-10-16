import { PrismaClient } from '../generated/prisma/client';
import type { DayOfWeek } from '../generated/prisma/enums';
import { DEMO_SCHOOL_SLUG } from './school-results-seed';

/** School days the demo timetable is built for. */
const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

/**
 * A believable secondary-school bell schedule: three morning periods, a short
 * break, two mid-morning periods, then two afternoon periods after lunch.
 */
const SLOTS: Array<{ start: string; end: string }> = [
  { start: '08:00', end: '08:45' },
  { start: '08:45', end: '09:30' },
  { start: '09:30', end: '10:15' },
  { start: '10:45', end: '11:30' },
  { start: '11:30', end: '12:15' },
  { start: '12:45', end: '13:30' },
];

/**
 * Preferred subject teacher for the demo school, keyed by subject name. The
 * teachers not listed here are used as a fallback pool so every period can
 * still be staffed.
 */
const SUBJECT_TEACHER_EMAIL: Record<string, string> = {
  Mathematics: 'teacher.math@tgeasymodel.edu.ng',
  'English Language': 'teacher.eng@tgeasymodel.edu.ng',
  'Basic Science': 'teacher.sci@tgeasymodel.edu.ng',
  Physics: 'teacher.sci@tgeasymodel.edu.ng',
  Chemistry: 'teacher.bio@tgeasymodel.edu.ng',
  Biology: 'teacher.bio@tgeasymodel.edu.ng',
  Economics: 'teacher.econ@tgeasymodel.edu.ng',
  'Civic Education': 'teacher.econ@tgeasymodel.edu.ng',
};

export interface SeedSchoolTimetableResult {
  /** Number of classes the timetable was generated for. */
  classes: number;
  /** Number of period rows actually inserted. */
  periodsCreated: number;
  /** Number of existing period rows the seed left untouched. */
  periodsExisting: number;
}

interface PeriodRow {
  tenantId: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  room: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

/**
 * Seeds a full week's timetable for every class at the demo school.
 *
 * Each class gets one period per bell slot per school day. Periods are packed
 * so no teacher is booked into two classes at the same time: a class falls back
 * to the next subject (or, on exhaustion, a self-study period with no teacher)
 * whenever its preferred subject teacher is already busy in that slot.
 *
 * Idempotent: if the demo school already has any timetable periods, the seed
 * does nothing, so hand-edited timetables are never clobbered.
 */
export async function seedSchoolTimetable(
  prisma: PrismaClient,
): Promise<SeedSchoolTimetableResult> {
  const summary: SeedSchoolTimetableResult = {
    classes: 0,
    periodsCreated: 0,
    periodsExisting: 0,
  };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SCHOOL_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.log(
      `   Timetable seed skipped: demo school (${DEMO_SCHOOL_SLUG}) not found.`,
    );
    return summary;
  }

  const existing = await prisma.timetablePeriod.count({
    where: { tenantId: tenant.id },
  });
  if (existing > 0) {
    summary.periodsExisting = existing;
    console.log(
      `   Timetable seed skipped: ${existing} period(s) already present.`,
    );
    return summary;
  }

  const [classes, subjects, staff] = await Promise.all([
    prisma.classRoom.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subject.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.schoolStaff.findMany({
      where: {
        tenantId: tenant.id,
        category: 'TEACHER',
      },
      select: { id: true, user: { select: { email: true } } },
    }),
  ]);

  if (classes.length === 0 || subjects.length === 0) {
    console.log(
      '   Timetable seed skipped: the demo school has no classes or subjects.',
    );
    return summary;
  }

  summary.classes = classes.length;

  const teacherByEmail = new Map<string, string>();
  for (const member of staff) {
    const email = member.user?.email?.toLowerCase();
    if (email) teacherByEmail.set(email, member.id);
  }
  const fallbackTeachers = staff.map((member) => member.id);

  const teacherForSubject = (subjectName: string): string | null => {
    const email = SUBJECT_TEACHER_EMAIL[subjectName];
    if (email && teacherByEmail.has(email)) return teacherByEmail.get(email)!;
    return null;
  };

  const rows: PeriodRow[] = [];

  DAYS.forEach((day, dayIndex) => {
    SLOTS.forEach((slot, slotIndex) => {
      // Teachers already booked in this day/slot, so no one is double-booked.
      const busy = new Set<string>();

      classes.forEach((cls, classIndex) => {
        let subjectId = subjects[0].id;
        let teacherId: string | null = null;

        // Try subjects in a rotating order until one with a free teacher is
        // found. If every teacher is busy, the period becomes self-study.
        for (let attempt = 0; attempt < subjects.length; attempt += 1) {
          const subject =
            subjects[(classIndex + dayIndex + slotIndex + attempt) % subjects.length];
          const preferred = teacherForSubject(subject.name);
          const candidate =
            preferred && !busy.has(preferred)
              ? preferred
              : fallbackTeachers.find((id) => !busy.has(id)) ?? null;

          subjectId = subject.id;
          if (candidate) {
            teacherId = candidate;
            break;
          }
          teacherId = null;
        }

        if (teacherId) busy.add(teacherId);

        rows.push({
          tenantId: tenant.id,
          classId: cls.id,
          subjectId,
          teacherId,
          room: `Room ${String(classIndex + 1).padStart(2, '0')}`,
          dayOfWeek: day,
          startTime: slot.start,
          endTime: slot.end,
        });
      });
    });
  });

  const created = await prisma.timetablePeriod.createMany({ data: rows });
  summary.periodsCreated = created.count;
  return summary;
}
