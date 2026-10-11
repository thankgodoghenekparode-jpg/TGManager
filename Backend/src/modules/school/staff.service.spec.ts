import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolStaffService } from './staff.service';

describe('SchoolStaffService', () => {
  let service: SchoolStaffService;
  let prisma: {
    schoolStaff: {
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      schoolStaff: {
        count: jest.fn().mockResolvedValue(2),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({ id: 'st1', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'st1' }),
      },
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
    await service.create('tenant', {
      firstName: 'Ada',
      lastName: 'Obi',
      category: 'TEACHER',
      status: 'ACTIVE',
      employeeNumber: undefined,
    } as never);

    expect(prisma.schoolStaff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeNumber: 'STF-0003' }),
      }),
    );
  });

  it('rejects a duplicate employee number', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create('tenant', {
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
      service.update('tenant', 'missing', { firstName: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when removing a missing staff member', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue(null);
    await expect(service.remove('tenant', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
