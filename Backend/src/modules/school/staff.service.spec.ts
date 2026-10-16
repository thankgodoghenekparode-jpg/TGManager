import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolStaffService } from './staff.service';

describe('SchoolStaffService', () => {
  let service: SchoolStaffService;
  let tx: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    tenantUser: { upsert: jest.Mock };
    roleAssignment: { findFirst: jest.Mock; create: jest.Mock };
    schoolStaff: { create: jest.Mock };
  };
  let prisma: {
    schoolStaff: {
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    companyRole: { findFirst: jest.Mock; create: jest.Mock };
    tenant: { findUnique: jest.Mock };
    roleAssignment: { deleteMany: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', email: 'staff@example.com' }),
      },
      tenantUser: { upsert: jest.fn().mockResolvedValue({}) },
      roleAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      schoolStaff: {
        create: jest.fn().mockImplementation((args) => ({ id: 'st1', ...args.data })),
      },
    };

    prisma = {
      schoolStaff: {
        count: jest.fn().mockResolvedValue(2),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({ id: 'st1', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'st1' }),
      },
      companyRole: {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-teacher', name: 'TEACHER' }),
        create: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ slug: 'demo-school' }),
      },
      roleAssignment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SchoolStaffService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SchoolStaffService);
  });

  it('auto-generates the next employee number', async () => {
    await service.create('tenant', 'admin1', {
      firstName: 'Ada',
      lastName: 'Obi',
      category: 'TEACHER',
      status: 'ACTIVE',
      employeeNumber: undefined,
    } as never);

    expect(tx.schoolStaff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeNumber: 'STF-0003' }),
      }),
    );
  });

  it('provisions a login and grants the category role', async () => {
    const result = await service.create('tenant', 'admin1', {
      firstName: 'Ada',
      lastName: 'Obi',
      category: 'TEACHER',
      status: 'ACTIVE',
    } as never);

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'stf0003@demo-school.staff.tgmanager.app',
        }),
      }),
    );
    expect(tx.roleAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyRoleId: 'role-teacher' }),
      }),
    );
    expect(result.staffAccount).toMatchObject({
      created: true,
      role: 'TEACHER',
    });
  });

  it('rejects a duplicate employee number', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create('tenant', 'admin1', {
        firstName: 'Ada',
        lastName: 'Obi',
        employeeNumber: 'STF-0001',
        category: 'TEACHER',
        status: 'ACTIVE',
      } as never),
    ).rejects.toThrow(ConflictException);
  });

  it('throws when updating a missing staff member', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue(null);
    await expect(
      service.update('tenant', 'admin1', 'missing', { firstName: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when removing a missing staff member', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue(null);
    await expect(service.remove('tenant', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
