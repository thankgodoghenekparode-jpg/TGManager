import { PrismaService } from '../../prisma/prisma.service';
import { DistributedLockService } from './distributed-lock.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomUUID: (): string => 'test-owner' };
});

describe('DistributedLockService', () => {
  const executeRaw = jest.fn().mockResolvedValue(undefined);
  const findUnique = jest.fn();
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });

  const prisma = {
    $executeRaw: executeRaw,
    distributedLock: { findUnique, deleteMany },
  } as unknown as PrismaService;

  let locks: DistributedLockService;
  const OWNER = 'test-owner';

  beforeEach(() => {
    jest.clearAllMocks();
    executeRaw.mockResolvedValue(undefined);
    deleteMany.mockResolvedValue({ count: 1 });
    locks = new DistributedLockService(prisma);
  });

  it('runs the job when this instance owns the lock', async () => {
    findUnique.mockResolvedValue({ name: 'job', owner: OWNER });

    const fn = jest.fn().mockResolvedValue(42);

    await expect(locks.runOnce('job', 60_000, fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { name: 'job', owner: OWNER },
    });
  });

  it('skips the job when another instance owns the lock', async () => {
    findUnique.mockResolvedValue({ name: 'job', owner: 'other-owner' });

    const fn = jest.fn();
    const result = await locks.runOnce('job', 60_000, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('releases the lock in a finally block when the job throws', async () => {
    findUnique.mockResolvedValue({ name: 'job', owner: OWNER });

    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(locks.runOnce('job', 60_000, fn)).rejects.toThrow('boom');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { name: 'job', owner: OWNER },
    });
  });

  it('claims the lease via upsert when the existing lock is expired', async () => {
    findUnique.mockResolvedValue({ name: 'job', owner: OWNER });
    await locks.runOnce('job', 60_000, jest.fn());

    const parts = executeRaw.mock.calls[0][0] as unknown as string[];
    const sql = parts.join('');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('"expiresAt" < now()');
  });
});
