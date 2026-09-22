import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AbilitiesContext } from '../types/permission-request.interface';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  const findFirst = jest.fn();
  const prisma = {
    branch: { findFirst },
  } as unknown as PrismaService;

  let access: AccessControlService;

  const scoped = {
    accessibleBranchIds: ['b1', 'b2'],
  } as unknown as AbilitiesContext;
  const companyWide = {
    accessibleBranchIds: null,
  } as unknown as AbilitiesContext;

  beforeEach(() => {
    jest.clearAllMocks();
    access = new AccessControlService(prisma);
  });

  describe('assertBranchAccess', () => {
    it('denies when the abilities scope excludes the branch', async () => {
      findFirst.mockResolvedValue({ id: 'b3' });
      await expect(
        access.assertBranchAccess('t1', 'b3', scoped),
      ).rejects.toThrow(ForbiddenException);
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('allows a branch inside the scope and verifies it exists', async () => {
      findFirst.mockResolvedValue({ id: 'b1' });
      await expect(
        access.assertBranchAccess('t1', 'b1', scoped),
      ).resolves.toBeUndefined();
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', tenantId: 't1' },
        select: { id: true },
      });
    });

    it('allows any branch for a company-wide abilities context', async () => {
      findFirst.mockResolvedValue({ id: 'b9' });
      await expect(
        access.assertBranchAccess('t1', 'b9', companyWide),
      ).resolves.toBeUndefined();
    });

    it('throws NotFound when the branch is not in the tenant', async () => {
      findFirst.mockResolvedValue(null);
      await expect(
        access.assertBranchAccess('t1', 'b1', scoped),
      ).rejects.toThrow(NotFoundException);
    });

    it('skips the scope check when abilities are omitted (legacy callers)', async () => {
      findFirst.mockResolvedValue({ id: 'b1' });
      await expect(
        access.assertBranchAccess('t1', 'b1', undefined),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertBranchScope', () => {
    it('denies a scoped branch outside the abilities scope', () => {
      expect(() => access.assertBranchScope('b3', scoped)).toThrow(
        ForbiddenException,
      );
    });

    it('allows a branch inside the scope', () => {
      expect(() => access.assertBranchScope('b2', scoped)).not.toThrow();
    });

    it('allows null branch (company-wide records) even when scoped', () => {
      expect(() => access.assertBranchScope(null, scoped)).not.toThrow();
    });

    it('allows any branch for company-wide abilities', () => {
      expect(() => access.assertBranchScope('b3', companyWide)).not.toThrow();
    });

    it('allows any branch without abilities', () => {
      expect(() => access.assertBranchScope('b3', undefined)).not.toThrow();
    });
  });
});
