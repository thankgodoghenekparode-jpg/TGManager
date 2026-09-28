import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  StreamableFile,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import type { TenantRequest } from '../../common/types/tenant-request.interface';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { TenantsService } from './tenants.service';

const LOGO_LIMIT = 2 * 1024 * 1024;

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

  @Post('current/logo')
  @UseGuards(AccessGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LOGO_LIMIT } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload the tenant logo',
    description:
      'Stores a PNG/JPEG/WebP image (max 2 MB) as the tenant brand logo. ' +
      'Requires tenant management permission.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'The updated logoKey.' })
  async uploadLogo(
    @Req() req: PermissionRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.tenantsService.uploadLogo(req.tenant.id, file);
  }

  @Delete('current/logo')
  @UseGuards(AccessGuard)
  @Permissions(PERMISSIONS.TENANT_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove the tenant logo',
    description:
      'Deletes the stored logo and reverts the tenant to the default brand. ' +
      'Requires tenant management permission.',
  })
  @ApiNoContentResponse({ description: 'Logo removed.' })
  async removeLogo(@Req() req: PermissionRequest) {
    await this.tenantsService.deleteLogo(req.tenant.id);
  }

  @Get(':id/logo')
  @Public()
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Get a tenant logo',
    description:
      'Publicly streams the stored logo for a tenant. Returns 404 when the ' +
      'tenant has not uploaded a logo.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Tenant ID' })
  @ApiOkResponse({ description: 'The tenant logo image bytes.' })
  async getLogo(@Param('id') id: string) {
    const logo = await this.tenantsService.getLogo(id);
    if (!logo) {
      throw new NotFoundException('This tenant has no logo');
    }
    return new StreamableFile(logo.buffer, {
      type: logo.mimeType,
      disposition: 'inline',
    });
  }
}
