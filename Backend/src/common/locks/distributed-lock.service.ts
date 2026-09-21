import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * DB-backed lease that guarantees a scheduled job runs on a single instance
 * even when the backend is deployed with multiple replicas.
 *
 * Unlike `pg_advisory_lock`, a table lease is safe under PgBouncer
 * transaction-mode pooling (each Prisma query may use a different pooled
 * connection), so the lock survives the pool. Leases expire automatically if
 * the holder crashes, and are released eagerly on success.
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Acquires the lease for `name` (up to `leaseMs`), runs `fn` only if this
   * instance won the lease, then releases it. Returns `fn`'s result, or `null`
   * when another instance already holds the lock.
   */
  async runOnce<T>(
    name: string,
    leaseMs: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const owner = randomUUID();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO "DistributedLock" (name, owner, "acquiredAt", "expiresAt")
      VALUES (${name}, ${owner}, ${now}, ${new Date(now.getTime() + leaseMs)})
      ON CONFLICT (name) DO UPDATE
        SET owner = EXCLUDED.owner,
            "acquiredAt" = EXCLUDED."acquiredAt",
            "expiresAt" = EXCLUDED."expiresAt"
        WHERE "DistributedLock"."expiresAt" < now()
    `;

    const row = await this.prisma.distributedLock.findUnique({
      where: { name },
    });
    if (!row || row.owner !== owner) {
      this.logger.debug(`Skipping '${name}': another instance holds the lock`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.prisma.distributedLock
        .deleteMany({ where: { name, owner } })
        .catch(() => undefined);
      this.logger.debug(`Released lock '${name}'`);
    }
  }
}
