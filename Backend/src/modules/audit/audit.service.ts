import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decodeCursor,
  paginate,
} from '../../common/pagination/pagination.util';

export interface AuditInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export interface ListAuditQuery {
  entityType?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(tenantId: string, input: AuditInput): void {
    void this.prisma.auditLog
      .create({
        data: {
          tenantId,
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ip: input.ip ?? null,
        },
      })
      .catch((error) => {
        this.logger.error(
          `Failed to write audit log (${input.action} ${input.entityType}): ${error instanceof Error ? error.message : 'unknown'}`,
        );
      });
  }

  async list(tenantId: string, query: ListAuditQuery) {
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const cursor = decodeCursor(query.cursor);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return paginate(rows, limit);
  }
}
