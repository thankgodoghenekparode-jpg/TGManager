import { Logger } from '@nestjs/common';

/**
 * Prisma error codes that indicate a transient transport/connection failure
 * (a network blip or pooled-connection hiccup) rather than a data or query bug.
 * These are safe to retry for read-only work.
 *
 * - P1001: Can't reach database server
 * - P1002: Database server timed out
 * - P1008: Operations timed out
 * - P1017: Server has closed the connection
 * - P2024: Timed out fetching a connection from the connection pool
 * - P2028: Transaction API error (expired / timed out transaction)
 * - P2034: Transaction failed due to a write conflict or deadlock
 */
export const RETRYABLE_PRISMA_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2028',
  'P2034',
]);

/**
 * Generous transaction budget for slow/remote pooled databases (e.g. the
 * Supabase PgBouncer endpoint). The Prisma defaults (maxWait 2s / timeout 5s)
 * are far too tight there and surface as P2028 on otherwise healthy reads.
 */
export const DB_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 60_000,
} as const;

export function isRetryablePrismaError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && RETRYABLE_PRISMA_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DbRetryOptions {
  /** Total attempts, including the first (default 3). */
  attempts?: number;
  /** Base backoff in ms; the Nth retry waits `baseDelayMs * N` (default 250). */
  baseDelayMs?: number;
  /** Label used in retry warning logs. */
  label?: string;
  /** Optional logger; when omitted, retries are silent. */
  logger?: Pick<Logger, 'warn'>;
}

/**
 * Runs `fn`, retrying a bounded number of times when it fails with a transient
 * Prisma connection error.
 *
 * Intended for **read-only** operations — never wrap non-idempotent writes,
 * since a retry could apply them twice.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: DbRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt === attempts) {
        break;
      }
      options.logger?.warn(
        `${options.label ?? 'Database query'} failed with a transient ` +
          `connection error (attempt ${attempt}/${attempts}); retrying…`,
      );
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}
