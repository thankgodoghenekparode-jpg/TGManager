import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  /** Max requests per window for sensitive paths (auth). */
  maxAuthRequests: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const AUTH_PATH_PATTERN = /\/auth\/(login|register)/;

/**
 * Lightweight in-memory fixed-window rate limiter. Suitable for a single
 * process; for horizontally scaled deployments swap this for a Redis-backed
 * limiter. Disabled under test so suites don't flake.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimitOptions) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.options.enabled) {
      next();
      return;
    }

    const ip = req.ip ?? 'unknown';
    const isAuthPath = AUTH_PATH_PATTERN.test(req.originalUrl ?? req.url);
    const max =
      (isAuthPath ? this.options.maxAuthRequests : this.options.maxRequests) ||
      1;

    const now = Date.now();
    const key = `${ip}:${req.path}`;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.options.windowMs });
      this.cleanup(now);
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        error: 'Too Many Requests',
      });
      return;
    }

    bucket.count += 1;
    this.cleanup(now);
    next();
  }

  private cleanup(now: number): void {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
