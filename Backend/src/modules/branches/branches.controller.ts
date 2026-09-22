import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { BranchesService } from './branches.service';
import {
  createBranchSchema,
  updateBranchSchema,
  type CreateBranchDto,
  type UpdateBranchDto,
} from './dto/branch.dto';

@ApiTags('Branches')
@Controller('branches')
@UseGuards(AccessGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @Permissions(PERMISSIONS.BRANCH_CREATE)
  @ApiOperation({
    summary: 'Create a branch',
    description: 'Creates a new branch for the current tenant.',
  })
  @ApiBody({ schema: schemaRef('CreateBranchDto') })
  @ApiCreatedResponse({ description: 'Branch created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchDto,
  ) {
    return this.branches.create(req.tenant.id, dto);
  }

  @Get()
  @Permissions(PERMISSIONS.BRANCH_VIEW)
  @ApiOperation({
    summary: 'List branches',
    description: 'Lists branches the current user can view.',
  })
  @ApiOkResponse({ description: 'List of branches.' })
  async list(@Req() req: PermissionRequest) {
    return this.branches.list(req.tenant.id, req.abilities);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.BRANCH_VIEW)
  @ApiOperation({
    summary: 'Get a branch',
    description: 'Returns a single branch by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Branch ID (UUID)' })
  @ApiOkResponse({ description: 'The requested branch.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.branches.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.BRANCH_UPDATE)
  @ApiOperation({
    summary: 'Update a branch',
    description: 'Partially updates a branch by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Branch ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateBranchDto') })
  @ApiOkResponse({ description: 'Branch updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) dto: UpdateBranchDto,
  ) {
    return this.branches.update(req.tenant.id, id, dto, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.BRANCH_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a branch',
    description: 'Deletes a branch by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Branch ID (UUID)' })
  @ApiNoContentResponse({ description: 'Branch deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.branches.remove(req.tenant.id, id, req.abilities);
  }
}
