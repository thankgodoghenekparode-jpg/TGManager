import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { saveSettingsSchema, type SaveSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiSecurity('tgmanager_access')
@Controller('settings')
@UseGuards(AccessGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get tenant settings',
    description:
      'Returns the tenant settings: attendance geolocation defaults and ' +
      'application URLs. Any tenant member can read these.',
  })
  @ApiOkResponse({ description: 'Tenant settings.' })
  async get(@Req() req: PermissionRequest) {
    return this.settings.get(req.tenant.id);
  }

  @Post()
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @ApiOperation({
    summary: 'Save tenant settings',
    description:
      'Merges the provided fields into the tenant settings. Only users with ' +
      'tenant management permission can save.',
  })
  @ApiBody({ schema: schemaRef('SaveSettingsDto') })
  @ApiOkResponse({ description: 'Updated tenant settings.' })
  async update(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(saveSettingsSchema)) dto: SaveSettingsDto,
  ) {
    return this.settings.update(req.tenant.id, req.user.sub, dto);
  }
}
