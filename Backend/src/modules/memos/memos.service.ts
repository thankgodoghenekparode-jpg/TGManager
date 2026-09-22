import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessControlService } from '../../common/access/access-control.service';
import type {
  CreateMemoDto,
  ListMemosDto,
  UpdateMemoDto,
} from './dto/memo.dto';

interface MemoAudience {
  all?: boolean;
  branchIds?: string[];
  groupIds?: string[];
  userIds?: string[];
  departmentIds?: string[];
}

@Injectable()
export class MemosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly access: AccessControlService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateMemoDto,
    abilities: AbilitiesContext,
  ) {
    if (dto.branchId) {
      await this.access.assertBranchAccess(tenantId, dto.branchId, abilities);
    }
    const audience = dto.audience ?? { all: true };
    await this.assertAudienceValid(tenantId, audience, abilities);

    return this.prisma.memo.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        createdByUserId: userId,
        title: dto.title,
        body: dto.body,
        through: dto.through ?? null,
        audience: audience,
        publishedAt: dto.publish ? new Date() : null,
      },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async list(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: ListMemosDto,
  ) {
    const ctx = await this.buildAudienceContext(tenantId, userId);
    const readSet = await this.readSet(tenantId, userId);
    const memos = await this.prisma.memo.findMany({
      where: {
        tenantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return memos
      .filter((m) => this.isVisible(m, userId, ctx, abilities))
      .map((m) => this.toResponse(m, readSet));
  }

  async getOne(
    tenantId: string,
    userId: string,
    memoId: string,
    abilities: AbilitiesContext,
  ) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, tenantId },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!memo) throw new NotFoundException('Memo not found');

    const ctx = await this.buildAudienceContext(tenantId, userId);
    if (!this.isVisible(memo, userId, ctx, abilities)) {
      throw new ForbiddenException('You do not have access to this memo');
    }
    const readSet = await this.readSet(tenantId, userId);
    return this.toResponse(memo, readSet);
  }

  async markRead(
    tenantId: string,
    userId: string,
    memoId: string,
    abilities: AbilitiesContext,
  ) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, tenantId },
    });
    if (!memo) throw new NotFoundException('Memo not found');

    const ctx = await this.buildAudienceContext(tenantId, userId);
    if (!this.isVisible(memo, userId, ctx, abilities)) {
      throw new ForbiddenException('You do not have access to this memo');
    }

    await this.prisma.memoRead.upsert({
      where: { memoId_userId: { memoId, userId } },
      update: { readAt: new Date() },
      create: { memoId, userId },
    });
    return { read: true };
  }

  async update(
    tenantId: string,
    userId: string,
    memoId: string,
    dto: UpdateMemoDto,
    abilities: AbilitiesContext,
  ) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, tenantId },
    });
    if (!memo) throw new NotFoundException('Memo not found');
    this.assertManage(memo, userId, abilities);

    if (dto.branchId) {
      await this.access.assertBranchAccess(tenantId, dto.branchId, abilities);
    }
    if (dto.audience) {
      await this.assertAudienceValid(tenantId, dto.audience, abilities);
    }

    return this.prisma.memo.update({
      where: { id: memoId },
      data: {
        title: dto.title,
        body: dto.body,
        through: dto.through === null ? null : dto.through,
        branchId: dto.branchId === null ? null : dto.branchId,
        audience: dto.audience,
      },
    });
  }

  async publish(
    tenantId: string,
    userId: string,
    memoId: string,
    abilities: AbilitiesContext,
  ) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, tenantId },
    });
    if (!memo) throw new NotFoundException('Memo not found');
    this.assertManage(memo, userId, abilities);

    return this.prisma.memo
      .update({
        where: { id: memoId },
        data: { publishedAt: new Date() },
      })
      .then(async (updated) => {
        const recipients = await this.audienceMemberIds(tenantId, updated);
        await this.notifications.createMany(
          tenantId,
          recipients.map((recipientId) => ({
            userId: recipientId,
            type: 'MEMO_PUBLISH',
            title: `New memo: ${updated.title}`,
            body: updated.body?.slice(0, 200) ?? null,
            data: { memoId: updated.id },
          })),
        );
        this.audit.record(tenantId, {
          userId,
          action: 'MEMO_PUBLISH',
          entityType: 'Memo',
          entityId: updated.id,
          metadata: { title: updated.title },
        });
        return updated;
      });
  }

  async remove(
    tenantId: string,
    userId: string,
    memoId: string,
    abilities: AbilitiesContext,
  ) {
    const memo = await this.prisma.memo.findFirst({
      where: { id: memoId, tenantId },
    });
    if (!memo) throw new NotFoundException('Memo not found');
    this.assertManage(memo, userId, abilities);
    await this.prisma.memo.delete({ where: { id: memoId } });
  }

  private isVisible(
    memo: {
      publishedAt: Date | null;
      createdByUserId: string;
      branchId: string | null;
      audience: unknown;
    },
    userId: string,
    ctx: { branchIds: string[]; groupIds: string[]; departmentIds: string[] },
    abilities: AbilitiesContext,
  ): boolean {
    if (memo.createdByUserId === userId) return true;
    if (abilities.isCompanyAdmin) return true;
    if (abilities.permissions.includes('memo.manage')) return true;
    if (!memo.publishedAt) return false;

    if (memo.branchId && !ctx.branchIds.includes(memo.branchId)) {
      return false;
    }

    const audience = (memo.audience ?? {}) as MemoAudience;
    if (audience.all === true) return true;
    if (audience.userIds?.includes(userId)) return true;
    if (audience.departmentIds?.some((d) => ctx.departmentIds.includes(d)))
      return true;
    if (audience.branchIds?.some((b) => ctx.branchIds.includes(b))) return true;
    if (audience.groupIds?.some((g) => ctx.groupIds.includes(g))) return true;
    return false;
  }

  private async assertAudienceValid(
    tenantId: string,
    audience: MemoAudience,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (abilities.accessibleBranchIds === null) return;
    const branchIds = audience.branchIds ?? [];
    for (const branchId of branchIds) {
      await this.access.assertBranchAccess(tenantId, branchId, abilities);
    }
  }

  private async buildAudienceContext(tenantId: string, userId: string) {
    const records = await this.prisma.staffRecord.findMany({
      where: { tenantId, userId, isActive: true },
      select: {
        branchId: true,
        departmentId: true,
        staffGroups: { select: { groupId: true } },
      },
    });
    return {
      branchIds: records.map((r) => r.branchId),
      groupIds: records.flatMap((r) => r.staffGroups.map((g) => g.groupId)),
      departmentIds: records
        .map((r) => r.departmentId)
        .filter((d): d is string => d !== null),
    };
  }

  private async audienceMemberIds(
    tenantId: string,
    memo: { branchId: string | null; audience: unknown },
  ): Promise<string[]> {
    const audience = (memo.audience ?? {}) as MemoAudience;
    const userIdSet = new Set<string>();

    if (audience.userIds?.length) {
      const validUsers = await this.prisma.tenantUser.findMany({
        where: { tenantId, userId: { in: audience.userIds } },
        select: { userId: true },
      });
      for (const u of validUsers) userIdSet.add(u.userId);
    }

    if (audience.departmentIds?.length) {
      const deptRecords = await this.prisma.staffRecord.findMany({
        where: {
          tenantId,
          isActive: true,
          departmentId: { in: audience.departmentIds },
        },
        select: { userId: true },
      });
      for (const r of deptRecords) userIdSet.add(r.userId);
    }

    const where: {
      tenantId: string;
      isActive: boolean;
      branchId?: { in: string[] };
      staffGroups?: { some: { groupId: { in: string[] } } };
    } = { tenantId, isActive: true };

    if (audience.groupIds?.length) {
      where.staffGroups = { some: { groupId: { in: audience.groupIds } } };
    } else if (audience.branchIds?.length) {
      where.branchId = { in: audience.branchIds };
    } else if (memo.branchId) {
      where.branchId = { in: [memo.branchId] };
    }

    if (
      audience.groupIds?.length ||
      audience.branchIds?.length ||
      memo.branchId
    ) {
      const records = await this.prisma.staffRecord.findMany({
        where,
        select: { userId: true },
      });
      for (const r of records) userIdSet.add(r.userId);
    }

    return Array.from(userIdSet);
  }

  private async readSet(
    tenantId: string,
    userId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.memoRead.findMany({
      where: { userId, memo: { tenantId } },
      select: { memoId: true },
    });
    return new Set(rows.map((r) => r.memoId));
  }

  private assertManage(
    memo: { createdByUserId: string },
    userId: string,
    abilities: AbilitiesContext,
  ): void {
    if (
      memo.createdByUserId !== userId &&
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes('memo.manage')
    ) {
      throw new ForbiddenException('You cannot manage this memo');
    }
  }

  private toResponse(
    memo: {
      id: string;
      title: string;
      body: string;
      branchId: string | null;
      audience: unknown;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdByUser?: { id: string; firstName: string; lastName: string };
    },
    readSet: Set<string>,
  ) {
    return { ...memo, read: readSet.has(memo.id) };
  }
}
