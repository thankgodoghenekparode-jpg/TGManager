import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AnnouncementsService } from './announcements.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: {
    schoolAnnouncement: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      schoolAnnouncement: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation((args) => ({ id: 'a1', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'a1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AnnouncementsService);
  });

  it('lists announcements with pagination metadata', async () => {
    prisma.schoolAnnouncement.findMany.mockResolvedValue([{ id: 'a1', title: 'Hi' }]);
    prisma.schoolAnnouncement.count.mockResolvedValue(1);

    const result = await service.list('t1', { page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(prisma.schoolAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('filters by audience and search text', async () => {
    prisma.schoolAnnouncement.count.mockResolvedValue(0);
    await service.list('t1', { page: 1, limit: 20, audience: 'PARENTS', search: 'exam' });

    expect(prisma.schoolAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audience: 'PARENTS',
          title: { contains: 'exam', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('creates an announcement with the acting user and a publish time', async () => {
    const result = await service.create('t1', 'u1', {
      title: 'Mid-term break',
      content: 'School closes Friday',
      audience: 'ALL',
    });

    expect(result).toMatchObject({ id: 'a1', title: 'Mid-term break' });
    expect(prisma.schoolAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          createdByUserId: 'u1',
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws when updating a missing announcement', async () => {
    prisma.schoolAnnouncement.findFirst.mockResolvedValue(null);
    await expect(service.update('t1', 'nope', { title: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when removing a missing announcement', async () => {
    prisma.schoolAnnouncement.findFirst.mockResolvedValue(null);
    await expect(service.remove('t1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('removes an existing announcement', async () => {
    await expect(service.remove('t1', 'a1')).resolves.toEqual({ success: true });
    expect(prisma.schoolAnnouncement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});