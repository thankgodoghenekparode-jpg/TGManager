import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../generated/prisma/enums';
import { PlatformRoleGuard } from './platform-role.guard';
import { AuthenticatedRequest } from '../types/authenticated-request.interface';

describe('PlatformRoleGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const makeContext = (
    user?: Partial<AuthenticatedRequest['user']>,
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }) as AuthenticatedRequest,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows any authenticated user when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const guard = new PlatformRoleGuard(reflector);
    expect(guard.canActivate(makeContext({ sub: 'u1' }))).toBe(true);
  });

  it('allows a user with the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.SUPER_ADMIN,
    ]);
    const guard = new PlatformRoleGuard(reflector);
    expect(
      guard.canActivate(
        makeContext({ sub: 'u1', userRole: UserRole.SUPER_ADMIN }),
      ),
    ).toBe(true);
  });

  it('forbids a user without the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.SUPER_ADMIN,
    ]);
    const guard = new PlatformRoleGuard(reflector);
    expect(() =>
      guard.canActivate(makeContext({ sub: 'u1', userRole: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when the request has no user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.USER]);
    const guard = new PlatformRoleGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
