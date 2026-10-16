import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilitiesGuard } from './abilities.guard';
import { AbilitiesService } from '../../modules/rbac/abilities/abilities.service';
import {
  ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import type { Permission } from '../../modules/rbac/permissions/permissions.constants';

function makeContext() {
  const req = {
    user: { sub: 'user-1' },
    tenant: { id: 'tenant-1' },
    abilities: undefined as unknown,
  };
  return {
    req,
    context: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    },
  };
}

function makeGuard(meta: {
  required?: Permission[];
  any?: Permission[];
  permissions: string[];
  isCompanyAdmin?: boolean;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === REQUIRED_PERMISSIONS_KEY) return meta.required;
      if (key === ANY_PERMISSIONS_KEY) return meta.any;
      return undefined;
    }),
  } as unknown as Reflector;

  const abilities = {
    resolveContext: jest.fn().mockResolvedValue({
      isCompanyAdmin: meta.isCompanyAdmin ?? false,
      permissions: meta.permissions,
    }),
  } as unknown as AbilitiesService;

  return { guard: new AbilitiesGuard(reflector, abilities), ...makeContext() };
}

describe('AbilitiesGuard permission checks', () => {
  it('allows routes without any permission metadata', async () => {
    const { guard, context } = makeGuard({ permissions: [] });
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('requires every @Permissions entry', async () => {
    const { guard, context } = makeGuard({
      required: ['a', 'b'] as Permission[],
      permissions: ['a'],
    });
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows when all @Permissions entries are held', async () => {
    const { guard, context } = makeGuard({
      required: ['a', 'b'] as Permission[],
      permissions: ['a', 'b'],
    });
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('denies when none of the @AnyPermissions entries are held', async () => {
    const { guard, context } = makeGuard({
      any: ['school.manage', 'staff.create'] as Permission[],
      permissions: ['student.view'],
    });
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows when one @AnyPermissions entry is held', async () => {
    const { guard, context } = makeGuard({
      any: ['school.manage', 'staff.create'] as Permission[],
      permissions: ['staff.create'],
    });
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('enforces @Permissions and @AnyPermissions together', async () => {
    const { guard, context } = makeGuard({
      required: ['staff.view'] as Permission[],
      any: ['school.manage', 'staff.create'] as Permission[],
      permissions: ['school.manage'],
    });
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets company admins bypass the checks', async () => {
    const { guard, context } = makeGuard({
      required: ['a'] as Permission[],
      permissions: [],
      isCompanyAdmin: true,
    });
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
