import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { TenantRequest } from '../../common/types/tenant-request.interface';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my tenants',
    description: 'Returns the tenants (companies) the current user belongs to.',
  })
  @ApiOkResponse({ description: "List of the current user's tenants." })
  async myTenants(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.getMyTenants(user.sub);
  }

  @Get('current')
  @UseGuards(TenantGuard)
  @ApiOperation({
    summary: 'Get the current tenant',
    description:
      "Returns the active tenant context, including the current user's membership.",
  })
  @ApiOkResponse({ description: 'The current tenant context.' })
  async currentTenant(@Req() req: TenantRequest) {
    return this.tenantsService.getCurrent(req.tenant.id, req.user.sub);
  }
}
