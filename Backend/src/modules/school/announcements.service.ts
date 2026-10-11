import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateAnnouncementDto,
  QueryAnnouncementsDto,
  UpdateAnnouncementDto,
} from './dto/announcements.dto';

const createdByInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryAnnouncementsDto) {
    const where = {
      tenantId,
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.schoolAnnouncement.findMany({
        where,
        include: createdByInclude,
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.schoolAnnouncement.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }

  async create(
    tenantId: string,
    createdByUserId: string | undefined,
    dto: CreateAnnouncementDto,
  ) {
    return this.prisma.schoolAnnouncement.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        audience: dto.audience,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        createdByUserId,
      },
      include: createdByInclude,
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ) {
    const existing = await this.prisma.schoolAnnouncement.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Announcement not found');

    return this.prisma.schoolAnnouncement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
        ...(dto.publishedAt !== undefined
          ? { publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date() }
          : {}),
      },
      include: createdByInclude,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.schoolAnnouncement.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Announcement not found');

    await this.prisma.schoolAnnouncement.delete({ where: { id } });
    return { success: true };
  }
}