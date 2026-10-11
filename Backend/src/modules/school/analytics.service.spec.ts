import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolAnalyticsService } from './analytics.service';

describe('SchoolAnalyticsService', () => {
  let service: SchoolAnalyticsService;
  let prisma: {
    student: { groupBy: jest.Mock };
    schoolStaff: { groupBy: jest.Mock };
    classRoom: { count: jest.Mock; findMany: jest.Mock };
    subject: { count: jest.Mock };
    guardian: { count: jest.Mock };
    schoolAttendance: { groupBy: jest.Mock };
    studentInvoice: { groupBy: jest.Mock; aggregate: jest.Mock };
    academicResult: { count: jest.Mock };
    academicSession: { findFirst: jest.Mock };
    term: { findFirst: jest.Mock };
    schoolAnnouncement: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      student: {
        groupBy: jest
          .fn()
          .mockImplementation(({ by }) =>
            Promise.resolve(
              by.includes('status')
                ? [
                    { status: 'ACTIVE', _count: { _all: 28 } },
                    { status: 'TRANSFERRED', _count: { _all: 2 } },
                  ]
                : [
                    { gender: 'MALE', _count: { _all: 16 } },
                    { gender: 'FEMALE', _count: { _all: 14 } },
                  ],
            ),
          ),
      },
      schoolStaff: {
        groupBy: jest.fn().mockResolvedValue([
          { category: 'TEACHER', _count: { _all: 5 } },
          { category: 'ADMINISTRATOR', _count: { _all: 3 } },
        ]),
      },
      classRoom: {
        count: jest.fn().mockResolvedValue(6),
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'JSS 1 Gold', level: 'JSS 1', _count: { students: 12 } },
        ]),
      },
      subject: { count: jest.fn().mockResolvedValue(8) },
      guardian: { count: jest.fn().mockResolvedValue(10) },
      schoolAttendance: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PRESENT', _count: { _all: 20 } },
          { status: 'LATE', _count: { _all: 4 } },
        ]),
      },
      studentInvoice: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PAID', _count: { _all: 10 } },
          { status: 'UNPAID', _count: { _all: 5 } },
        ]),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: 1100000, paidAmount: 700000, balance: 400000 },
        }),
      },
      academicResult: {
        count: jest
          .fn()
          .mockResolvedValueOnce(15)
          .mockResolvedValueOnce(0),
      },
      academicSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', name: '2025/2026 Academic Session' }),
      },
      term: {
        findFirst: jest.fn().mockResolvedValue({ id: 't1', name: '2nd Term', status: 'ACTIVE' }),
      },
      schoolAnnouncement: { count: jest.fn().mockResolvedValue(3) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SchoolAnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SchoolAnalyticsService);
  });

  it('aggregates student, staff, attendance and fee counts', async () => {
    const result = await service.overview('t1');

    expect(result.students.total).toBe(30);
    expect(result.students.active).toBe(28);
    expect(result.staff.total).toBe(8);
    expect(result.academics.classes).toBe(6);
    expect(result.academics.subjects).toBe(8);
    expect(result.academics.guardians).toBe(10);

    expect(result.attendanceToday.total).toBe(24);
    expect(result.attendanceToday.byStatus).toEqual([
      { status: 'PRESENT', count: 20 },
      { status: 'LATE', count: 4 },
    ]);

    expect(result.fees.totalInvoiced).toBe(1100000);
    expect(result.fees.totalPaid).toBe(700000);
    expect(result.fees.outstanding).toBe(400000);

    expect(result.results.approved).toBe(15);
    expect(result.results.published).toBe(0);
    expect(result.currentSession?.name).toBe('2025/2026 Academic Session');
    expect(result.currentTerm?.name).toBe('2nd Term');
    expect(result.announcements).toBe(3);
  });

  it('runs today attendance within the local day window', async () => {
    await service.overview('t1');

    const call = prisma.schoolAttendance.groupBy.mock.calls[0][0];
    expect(call.where.date).toMatchObject({
      gte: expect.any(Date),
      lt: expect.any(Date),
    });
  });

  it('copies with a school that has no data yet', async () => {
    prisma.schoolAttendance.groupBy.mockResolvedValue([]);
    prisma.studentInvoice.aggregate.mockResolvedValue({
      _sum: { totalAmount: null, paidAmount: null, balance: null },
    });
    prisma.studentInvoice.groupBy.mockResolvedValue([]);
    prisma.academicSession.findFirst.mockResolvedValue(null);
    prisma.term.findFirst.mockResolvedValue(null);

    const result = await service.overview('t1');
    expect(result.students.total).toBe(30);
    expect(result.attendanceToday.total).toBe(0);
    expect(result.fees.totalInvoiced).toBe(0);
    expect(result.currentSession).toBeNull();
    expect(result.currentTerm).toBeNull();
  });
});