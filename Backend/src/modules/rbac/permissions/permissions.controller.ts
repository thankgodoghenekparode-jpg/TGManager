import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessGuard } from '../../../common/guards/access.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ALL_PERMISSIONS, PERMISSIONS } from './permissions.constants';
import { SYSTEM_ROLE_DEFS } from '../system-roles/system-roles.constants';

/**
 * Exposes the granular permission catalog that company roles can carry, plus
 * the seeded system role definitions. The frontend uses this to render the
 * role-builder UI (grouped checkboxes) without hardcoding backend constants.
 */
@ApiTags('Company Roles')
@Controller('permissions')
export class PermissionsController {
  @Get()
  @UseGuards(AccessGuard)
  @Permissions(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({
    summary: 'List permission catalog and system roles',
    description:
      'Returns every permission a company role can carry (grouped by module) ' +
      'and the seeded system role definitions.',
  })
  @ApiOkResponse({
    description: 'Permission catalog and system role definitions.',
  })
  listCatalog() {
    const permissionKeys = ALL_PERMISSIONS;
    const grouped: Record<string, string[]> = {};
    for (const key of permissionKeys) {
      const group = key.split('.')[0];
      (grouped[group] ??= []).push(key);
    }

    const systemRoles = Object.values(SYSTEM_ROLE_DEFS).map((def) => ({
      name: def.name,
      description: def.description,
      permissions: [...def.permissions],
    }));

    return {
      permissions: permissionKeys,
      grouped,
      systemRoles,
    };
  }
}
