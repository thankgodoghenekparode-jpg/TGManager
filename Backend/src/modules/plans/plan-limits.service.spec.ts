import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitsService } from './plan-limits.service';

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    branch: { count: jest.Mock };
    staffRecord: { count: jest.Mock };
    document: { count: jest.Mock; aggregate: jest.Mock };
    message: { count: jest.Mock };
    department: { count: jest.Mock };
    group: { count: jest.Mock };
    memo: { count: jest.Mock };
    form: { count: jest.Mock };
    formSubmission: { count: jest.Mock };
    workflowTemplate: { count: jest.Mock };
    inventoryItem: { count: jest.Mock };
    conversation: { count: jest.Mock };
    auditLog: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const planOf = (overrides: Record<string, unknown> = {}) => ({
    name: 'Free',
    maxBranches: 1,
    maxStaff: 5,
    maxDocuments: 10,
    maxStorageBytes: BigInt(1000),
    maxChatMessages: 20,
    ...overrides,
  });

  const tenant = (plan: unknown) => ({ id: 't1', plan });

  beforeEach(async () => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      branch: { count: jest.fn() },
      staffRecord: { count: jest.fn() },
      document: { count: jest.fn(), aggregate: jest.fn() },
      message: { count: jest.fn() },
      department: { count: jest.fn() },
      group: { count: jest.fn() },
      memo: { count: jest.fn() },
      form: { count: jest.fn() },
      formSubmission: { count: jest.fn() },
      workflowTemplate: { count: jest.fn() },
      inventoryItem: { count: jest.fn() },
      conversation: { count: jest.fn() },
      auditLog: { count: jest.fn() },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlanLimitsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PlanLimitsService);
  });

  describe('enforceBranchLimit', () => {
    it('allows when under the limit', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.branch.count.mockResolvedValue(0);
      await expect(service.enforceBranchLimit('t1')).resolves.toBeUndefined();
    });

    it('blocks when at the limit with an upgrade hint', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.branch.count.mockResolvedValue(1);
      await expect(service.enforceBranchLimit('t1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.enforceBranchLimit('t1')).rejects.toThrow(
        /up to 1 branches/,
      );
      await expect(service.enforceBranchLimit('t1')).rejects.toThrow(
        /Upgrade your plan/,
      );
    });

    it('never blocks when the limit is null (unlimited)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        tenant(planOf({ maxBranches: null })),
      );
      prisma.branch.count.mockResolvedValue(999);
      await expect(service.enforceBranchLimit('t1')).resolves.toBeUndefined();
    });
  });

  describe('enforceDocumentLimits', () => {
    it('blocks when document count is at the cap', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.document.count.mockResolvedValue(10);
      await expect(
        service.enforceDocumentLimits('t1', BigInt(100)),
      ).rejects.toThrow(/up to 10 documents/);
    });

    it('blocks when storage would be exceeded', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.document.count.mockResolvedValue(0);
      prisma.document.aggregate.mockResolvedValue({
        _sum: { sizeBytes: BigInt(950) },
      });
      await expect(
        service.enforceDocumentLimits('t1', BigInt(100)),
      ).rejects.toThrow(/storage limit exceeded/);
    });

    it('passes when both count and storage fit', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.document.count.mockResolvedValue(5);
      prisma.document.aggregate.mockResolvedValue({
        _sum: { sizeBytes: BigInt(400) },
      });
      await expect(
        service.enforceDocumentLimits('t1', BigInt(100)),
      ).resolves.toBeUndefined();
    });
  });

  describe('enforceChatMessagesLimit', () => {
    it('counts messages across the tenant via conversation relation', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant(planOf()));
      prisma.message.count.mockResolvedValue(20);
      await expect(service.enforceChatMessagesLimit('t1')).rejects.toThrow(
        /up to 20 chat messages/,
      );
      expect(prisma.message.count).toHaveBeenCalledWith({
        where: { conversation: { tenantId: 't1' } },
      });
    });
  });

  describe('getUsage', () => {
    it('returns aggregated usage counts', async () => {
      prisma.$transaction.mockResolvedValue([
        3,
        7,
        2,
        { _sum: { sizeBytes: BigInt(500) } },
        11,
        1,
        1,
        2,
        1,
        4,
        1,
        5,
        6,
        9,
      ]);
      const usage = await service.getUsage('t1');
      expect(usage).toEqual({
        branches: 3,
        staff: 7,
        documents: 2,
        storageBytes: '500',
        chatMessages: 11,
        departments: 1,
        groups: 1,
        memos: 2,
        forms: 1,
        formSubmissions: 4,
        workflows: 1,
        inventoryItems: 5,
        conversations: 6,
        auditLogs: 9,
      });
    });
  });
});
