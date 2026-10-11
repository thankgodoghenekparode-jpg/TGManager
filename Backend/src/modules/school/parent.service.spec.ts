import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { GradingService } from './grading.service';
import { ParentService } from './parent.service';

describe('ParentService', () => {
  let service: ParentService;
  let grading: { getStudentReportCard: jest.Mock };
  let tx: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    tenantUser: { upsert: jest.Mock };
    roleAssignment: { findFirst: jest.Mock; create: jest.Mock };
    guardian: { update: jest.Mock };
  };
  let prisma: {
    guardian: { findFirst: jest.Mock; update: jest.Mock };
    companyRole: { findFirst: jest.Mock; create: jest.Mock };
    studentGuardian: { findFirst: jest.Mock };
    academicResult: { findMany: jest.Mock; count: jest.Mock };
    schoolAttendance: { findMany: jest.Mock };
    studentInvoice: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'parent@example.com' }),
      },
      tenantUser: { upsert: jest.fn().mockResolvedValue({}) },
      roleAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      guardian: { update: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      guardian: { findFirst: jest.fn(), update: jest.fn() },
      companyRole: {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-parent' }),
        create: jest.fn(),
      },
      studentGuardian: { findFirst: jest.fn() },
      academicResult: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) },
      schoolAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      studentInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };

    grading = { getStudentReportCard: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ParentService,
        { provide: PrismaService, useValue: prisma },
        { provide: GradingService, useValue: grading },
      ],
    }).compile();

    service = moduleRef.get(ParentService);
  });

  describe('inviteGuardian', () => {
    it('creates the parent account, role assignment and links the guardian', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'g1',
        firstName: 'Chukwudi',
        lastName: 'Eze',
        email: 'parent@example.com',
      });

      const result = await service.inviteGuardian('t1', 'admin1', {
        guardianId: 'g1',
      });

      expect(result.accountCreated).toBe(true);
      expect(result.temporaryPassword).toBeTruthy();
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'parent@example.com' }),
        }),
      );
      expect(tx.roleAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyRoleId: 'role-parent' }),
        }),
      );
      expect(tx.guardian.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { userId: 'u1' },
      });
    });

    it('rejects a guardian without an email', async () => {
      prisma.guardian.findFirst.mockResolvedValue({
        id: 'g1',
        firstName: 'No',
        lastName: 'Email',
        email: null,
      });
      await expect(
        service.inviteGuardian('t1', 'admin1', { guardianId: 'g1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when the guardian does not exist', async () => {
      prisma.guardian.findFirst.mockResolvedValue(null);
      await expect(
        service.inviteGuardian('t1', 'admin1', { guardianId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  it('denies access to a student not linked to the guardian', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.studentGuardian.findFirst.mockResolvedValue(null);
    await expect(service.getChild('t1', 'u1', 'other')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('restricts child results to approved and published statuses', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.studentGuardian.findFirst.mockResolvedValue({
      student: { id: 'stu1' },
    });

    await service.getChildResults('t1', 'u1', 'stu1', {});

    expect(prisma.academicResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: 'stu1',
          status: { in: ['APPROVED', 'PUBLISHED'] },
        }),
      }),
    );
  });

  it('delegates report cards to the grading service once access is verified', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.studentGuardian.findFirst.mockResolvedValue({
      student: { id: 'stu1' },
    });
    grading.getStudentReportCard.mockResolvedValue({ student: { id: 'stu1' } });

    const result = await service.getChildReportCard(
      't1',
      'u1',
      'stu1',
      'sess1',
      'term1',
    );

    expect(grading.getStudentReportCard).toHaveBeenCalledWith(
      't1',
      'stu1',
      'sess1',
      'term1',
    );
    expect(result).toMatchObject({ student: { id: 'stu1' } });
  });

  it('hides report cards until the term results are published', async () => {
    prisma.guardian.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.studentGuardian.findFirst.mockResolvedValue({
      student: { id: 'stu1' },
    });
    prisma.academicResult.count.mockResolvedValue(0);

    await expect(
      service.getChildReportCard('t1', 'u1', 'stu1', 'sess1', 'term1'),
    ).rejects.toThrow(NotFoundException);
    expect(grading.getStudentReportCard).not.toHaveBeenCalled();
  });
});
