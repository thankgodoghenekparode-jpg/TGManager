import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { TenantsService } from '../tenants/tenants.service';
import { PasswordResetService } from '../auth/password-reset.service';
import { DistributedLockService } from '../../common/locks/distributed-lock.service';
import { PlatformService } from './platform.service';

describe('PlatformService — tenant access windows', () => {
  let service: PlatformService;
  let prisma: {
    tenant: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    tenantSubscription: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };
  let locks: { runOnce: jest.Mock };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          name: 'Acme',
          planId: 'p1',
          status: 'ACTIVE',
        }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({ id: 'sub1', ...args.data })),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn() };
    locks = { runOnce: jest.fn((_name, _ttl, fn) => fn()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlanLimitsService, useValue: {} },
        { provide: AuditService, useValue: audit },
        { provide: TenantsService, useValue: {} },
        { provide: PasswordResetService, useValue: {} },
        { provide: DistributedLockService, useValue: locks },
      ],
    }).compile();

    service = moduleRef.get(PlatformService);
  });

  it('grants a timed window from durationDays and reactivates a lapsed tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Acme',
      planId: 'p1',
      status: 'TRIAL_ENDED',
    });

    const result = await service.setTenantAccess(
      't1',
      { durationDays: 30 },
      'admin1',
    );

    expect(prisma.tenantSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          planId: 'p1',
          status: 'ACTIVE',
          endsAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'ACTIVE' },
    });
    expect(result.status).toBe('ACTIVE');
    expect(result.accessExpiresAt).toBeTruthy();
    expect(audit.record).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ action: 'PLATFORM.SET_TENANT_ACCESS' }),
    );
  });

  it('extends the existing window instead of stacking new subscriptions', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({ id: 'sub-existing' });

    await service.setTenantAccess('t1', { durationDays: 7 }, 'admin1');

    expect(prisma.tenantSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-existing' },
        data: expect.objectContaining({ status: 'ACTIVE', endsAt: expect.any(Date) }),
      }),
    );
    expect(prisma.tenantSubscription.create).not.toHaveBeenCalled();
  });

  it('clears the expiry for unlimited access when endsAt is null', async () => {
    const result = await service.setTenantAccess('t1', { endsAt: null }, 'admin1');

    expect(prisma.tenantSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ endsAt: null, status: 'ACTIVE' }),
      }),
    );
    expect(result.accessExpiresAt).toBeNull();
  });

  it('rejects an endsAt in the past', async () => {
    await expect(
      service.setTenantAccess(
        't1',
        { endsAt: new Date(Date.now() - 60_000).toISOString() },
        'admin1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('sweep only expires tenants whose latest window has elapsed', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);
    prisma.tenant.findMany.mockResolvedValue([
      { id: 't-expired', name: 'Expired Co', subscriptions: [{ endsAt: past }] },
      // Has an old expired row, but the latest window is still valid -> keep.
      { id: 't-renewed', name: 'Renewed Co', subscriptions: [{ endsAt: future }] },
      { id: 't-unlimited', name: 'Unlimited Co', subscriptions: [{ endsAt: null }] },
    ]);

    const result = await service.expireLapsedTenants();

    expect(result.suspended).toBe(1);
    expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-expired' },
      data: { status: 'TRIAL_ENDED' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      't-expired',
      expect.objectContaining({ action: 'TENANT.ACCESS_EXPIRED' }),
    );
  });

  it('runs the hourly sweep under a distributed lock', async () => {
    await service.sweepExpiredAccess();

    expect(locks.runOnce).toHaveBeenCalledWith(
      'tenant-access-expiry',
      expect.any(Number),
      expect.any(Function),
    );
    expect(prisma.tenant.findMany).toHaveBeenCalledTimes(1);
  });

  it('activate clears an elapsed window so reactivation actually grants access', async () => {
    prisma.tenantSubscription.findFirst.mockResolvedValue({
      id: 'sub-lapsed',
      endsAt: new Date(Date.now() - 1000),
    });

    await service.activateTenant('t1', 'admin1');

    expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-lapsed' },
      data: { endsAt: null, status: 'ACTIVE' },
    });
  });
});