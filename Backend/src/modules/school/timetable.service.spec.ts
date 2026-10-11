import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TimetableService, periodsOverlap } from './timetable.service';

describe('periodsOverlap', () => {
  const base = { dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '09:00' };

  it('detects overlapping periods on the same day', () => {
    expect(
      periodsOverlap(base, {
        dayOfWeek: 'MONDAY',
        startTime: '08:30',
        endTime: '09:30',
      }),
    ).toBe(true);
  });

  it('treats touching endpoints as non-overlapping', () => {
    expect(
      periodsOverlap(base, {
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).toBe(false);
  });

  it('ignores periods on different days', () => {
    expect(
      periodsOverlap(base, {
        dayOfWeek: 'TUESDAY',
        startTime: '08:00',
        endTime: '09:00',
      }),
    ).toBe(false);
  });
});

describe('TimetableService', () => {
  let service: TimetableService;
  let prisma: {
    classRoom: { findFirst: jest.Mock };
    subject: { findFirst: jest.Mock };
    schoolStaff: { findFirst: jest.Mock };
    timetablePeriod: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      classRoom: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      schoolStaff: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
      timetablePeriod: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args) => ({ id: 'new', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'p1' }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(TimetableService);
  });

  const dto = {
    classId: 'c1',
    subjectId: 's1',
    teacherId: 't1',
    dayOfWeek: 'MONDAY' as const,
    startTime: '08:00',
    endTime: '09:00',
    room: 'R1',
  };

  it('creates a period when there are no clashes', async () => {
    const result = await service.create('t1', dto);
    expect(result).toMatchObject({ classId: 'c1', startTime: '08:00' });
    expect(prisma.timetablePeriod.create).toHaveBeenCalled();
  });

  it('rejects a class double-booking', async () => {
    prisma.timetablePeriod.findMany.mockResolvedValue([
      {
        id: 'existing',
        classId: 'c1',
        teacherId: null,
        dayOfWeek: 'MONDAY',
        startTime: '08:30',
        endTime: '09:30',
      },
    ]);
    await expect(service.create('t1', dto)).rejects.toThrow(ConflictException);
  });

  it('rejects a teacher double-booking across classes', async () => {
    prisma.timetablePeriod.findMany.mockResolvedValue([
      {
        id: 'existing',
        classId: 'c-other',
        teacherId: 't1',
        dayOfWeek: 'MONDAY',
        startTime: '08:30',
        endTime: '09:30',
      },
    ]);
    await expect(service.create('t1', dto)).rejects.toThrow(ConflictException);
  });

  it('validates referenced class and subject', async () => {
    prisma.classRoom.findFirst.mockResolvedValue(null);
    await expect(service.create('t1', dto)).rejects.toThrow(NotFoundException);
  });

  it('validates the referenced teacher', async () => {
    prisma.schoolStaff.findFirst.mockResolvedValue(null);
    await expect(service.create('t1', dto)).rejects.toThrow(NotFoundException);
  });

  it('throws when updating a missing period', async () => {
    prisma.timetablePeriod.findFirst.mockResolvedValue(null);
    await expect(service.update('t1', 'p1', { room: 'R2' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when removing a missing period', async () => {
    prisma.timetablePeriod.findFirst.mockResolvedValue(null);
    await expect(service.remove('t1', 'p1')).rejects.toThrow(NotFoundException);
  });
});
