import { randomBytes, timingSafeEqual } from 'crypto';

/** Returns a fresh random token stored in the readable CSRF cookie. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Constant-time comparison to avoid leaking token equality through timing. */
export function csrfTokensEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
