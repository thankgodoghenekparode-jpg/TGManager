import {
  DB_TRANSACTION_OPTIONS,
  isRetryablePrismaError,
  withDbRetry,
} from './prisma-retry';

describe('prisma-retry', () => {
  describe('isRetryablePrismaError', () => {
    it('treats transient connection/transport codes as retryable', () => {
      for (const code of [
        'P1001',
        'P1002',
        'P1008',
        'P1017',
        'P2024',
        'P2028',
        'P2034',
      ]) {
        expect(isRetryablePrismaError({ code })).toBe(true);
      }
    });

    it('does not retry genuine data errors or unknown shapes', () => {
      expect(isRetryablePrismaError({ code: 'P2002' })).toBe(false);
      expect(isRetryablePrismaError(new Error('boom'))).toBe(false);
      expect(isRetryablePrismaError(null)).toBe(false);
      expect(isRetryablePrismaError(undefined)).toBe(false);
    });
  });

  describe('withDbRetry', () => {
    it('returns the result without retrying on success', async () => {
      const fn = jest.fn().mockResolvedValue('ok');
      await expect(withDbRetry(fn, { baseDelayMs: 0 })).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries a transient error and then succeeds', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'P2028' })
        .mockRejectedValueOnce({ code: 'P1001' })
        .mockResolvedValue('recovered');

      await expect(
        withDbRetry(fn, { attempts: 3, baseDelayMs: 0 }),
      ).resolves.toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('rethrows after exhausting the attempts', async () => {
      const error = { code: 'P1001' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(
        withDbRetry(fn, { attempts: 2, baseDelayMs: 0 }),
      ).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-retryable errors', async () => {
      const error = { code: 'P2002' };
      const fn = jest.fn().mockRejectedValue(error);

      await expect(
        withDbRetry(fn, { attempts: 3, baseDelayMs: 0 }),
      ).rejects.toBe(error);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('exposes a generous transaction budget for pooled databases', () => {
      expect(DB_TRANSACTION_OPTIONS.maxWait).toBeGreaterThanOrEqual(10_000);
      expect(DB_TRANSACTION_OPTIONS.timeout).toBeGreaterThanOrEqual(30_000);
    });
  });
});
