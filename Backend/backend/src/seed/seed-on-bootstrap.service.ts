import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { runSeed } from './seed';

/** Prisma error codes that indicate a transient connection/transport failure. */
const RETRYABLE_CODES = new Set(['P1008', 'P1017', 'P2024', 'P2028']);
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs the database seed automatically when the application bootstraps.
 *
 * Guardrails:
 * - Skipped entirely during tests (NODE_ENV=test).
 * - Skipped when DB_SEED_ON_START=false.
 * - In production the demo org is only seeded when SEED_DEMO=true; plans are
 *   always upserted (idempotent).
 * - The seed is retried a few times on transient connection failures (e.g.
 *   Render Postgres free-tier connection drops) so a momentary network blip
 *   does not take the whole API down. Only genuine data/schema errors abort
 *   startup (fail fast on real inconsistency).
 */
@Injectable()
export class SeedOnBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SeedOnBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isRetryable(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return typeof code === 'string' && RETRYABLE_CODES.has(code);
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') return;

    if (this.config.get<string>('DB_SEED_ON_START') === 'false') {
      this.logger.warn('Skipping DB seed on start (DB_SEED_ON_START=false).');
      return;
    }

    this.logger.log('Starting database seed…');
    const startedAt = Date.now();

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await runSeed(this.prisma);
        this.logger.log(
          `Database seed completed in ${Date.now() - startedAt}ms ` +
            `(plans=${result.plansSeeded}, demo=${result.demoSeeded}).`,
        );
        return;
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        this.logger.warn(
          `Database seed failed with transient connection error ` +
            `(attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`,
        );
        await sleep(attempt * 1000);
      }
    }

    const detail =
      lastError instanceof Error ? lastError.stack : String(lastError);
    if (this.isRetryable(lastError)) {
      this.logger.error(
        `Database seed failed after ${MAX_ATTEMPTS} attempts due to ` +
          `connection errors. Continuing startup — the app can retry the seed ` +
          `on the next deploy instead of bouncing on a flaky connection.\n${detail}`,
      );
      return;
    }
    this.logger.error('Database seed failed — aborting startup.', detail);
    throw lastError;
  }
}
