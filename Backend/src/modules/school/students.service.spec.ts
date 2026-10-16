import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from './students.service';

describe('StudentsService', () => {
  let service: StudentsService;
  let prisma: {
    student: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    user: { update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      student: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({ id: 's1' }),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          userId: 'u1',
          ...args.data,
        })),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { update: jest.fn().mockResolvedValue({ id: 'u1' }) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [StudentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(StudentsService);
  });

  it('throws when deleting a missing student', async () => {
    prisma.student.findFirst.mockResolvedValue(null);
    await expect(service.delete('tenant', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deactivates the linked login when a student is hard-deleted', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      _count: { results: 0, invoices: 0 },
    });

    await service.delete('tenant', 's1');

    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
  });

  it('archives and deactivates the login when the student has records', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      _count: { results: 3, invoices: 0 },
    });

    const result = await service.delete('tenant', 's1');

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'WITHDRAWN' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
    expect(result).toMatchObject({ status: 'WITHDRAWN' });
  });

  it('reactivates the login when a student is set ACTIVE', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', userId: 'u1' });

    await service.update('tenant', 's1', { status: 'ACTIVE' } as never);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: true },
    });
  });

  it('deactivates the login when a student is withdrawn via update', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', userId: 'u1' });

    await service.update('tenant', 's1', { status: 'WITHDRAWN' } as never);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isActive: false },
    });
  });

  it('leaves the login untouched when the status is not changing', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1', userId: 'u1' });

    await service.update('tenant', 's1', { firstName: 'Ada' } as never);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
