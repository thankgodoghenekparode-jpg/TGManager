import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from './csrf.constants';
import { csrfTokensEqual } from './csrf.util';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Double-submit cookie CSRF protection.
 *
 * The readable `tgmanager_csrf` cookie is set alongside the auth cookies on
 * login/refresh. For every state-changing request that ships that
 * cookie, the client must echo its value in the `x-csrf-token` header.
 * Cross-site attackers cannot read the cookie value (same-origin policy), so
 * they cannot forge the matching header. Requests without the cookie (e.g.
 * server-to-server integration calls using `X-Api-Key`) are allowed through.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(request.method)) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE] as string | undefined;
    if (!cookieToken) return true;

    const rawHeader = request.headers[CSRF_HEADER];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!headerToken || !csrfTokensEqual(headerToken, cookieToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
