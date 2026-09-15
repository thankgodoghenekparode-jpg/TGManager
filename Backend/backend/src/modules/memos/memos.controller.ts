import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import {
  createMemoSchema,
  listMemosSchema,
  updateMemoSchema,
  type CreateMemoDto,
  type ListMemosDto,
  type UpdateMemoDto,
} from './dto/memo.dto';
import { MemosService } from './memos.service';

@ApiTags('Memos')
@Controller('memos')
@UseGuards(TenantGuard, AbilitiesGuard)
export class MemosController {
  constructor(private readonly memos: MemosService) {}

  @Post()
  @Permissions(PERMISSIONS.MEMO_CREATE)
  @ApiOperation({
    summary: 'Create a memo',
    description: 'Creates a memo, optionally publishing it immediately.',
  })
  @ApiBody({ schema: schemaRef('CreateMemoDto') })
  @ApiCreatedResponse({ description: 'Memo created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createMemoSchema)) dto: CreateMemoDto,
  ) {
    return this.memos.create(req.tenant.id, req.user.sub, dto, req.abilities);
  }

  @Get()
  @Permissions(PERMISSIONS.MEMO_VIEW)
  @ApiOperation({
    summary: 'List memos',
    description: 'Lists memos the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiOkResponse({ description: 'List of memos.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listMemosSchema)) query: ListMemosDto,
  ) {
    return this.memos.list(req.tenant.id, req.user.sub, req.abilities, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.MEMO_VIEW)
  @ApiOperation({
    summary: 'Get a memo',
    description: 'Returns a single memo by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Memo ID (UUID)' })
  @ApiOkResponse({ description: 'The requested memo.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.memos.getOne(req.tenant.id, req.user.sub, id, req.abilities);
  }

  @Post(':id/read')
  @Permissions(PERMISSIONS.MEMO_VIEW)
  @ApiOperation({
    summary: 'Mark a memo as read',
    description: 'Marks a memo as read by the current user.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Memo ID (UUID)' })
  @ApiOkResponse({ description: 'Memo marked as read.' })
  async markRead(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.memos.markRead(req.tenant.id, req.user.sub, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.MEMO_MANAGE)
  @ApiOperation({
    summary: 'Update a memo',
    description: 'Partially updates a memo by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Memo ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateMemoDto') })
  @ApiOkResponse({ description: 'Memo updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemoSchema)) dto: UpdateMemoDto,
  ) {
    return this.memos.update(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Post(':id/publish')
  @Permissions(PERMISSIONS.MEMO_MANAGE)
  @ApiOperation({
    summary: 'Publish a memo',
    description: 'Publishes a draft memo.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Memo ID (UUID)' })
  @ApiOkResponse({ description: 'Memo published.' })
  async publish(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.memos.publish(req.tenant.id, req.user.sub, id, req.abilities);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.MEMO_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a memo',
    description: 'Deletes a memo by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Memo ID (UUID)' })
  @ApiNoContentResponse({ description: 'Memo deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.memos.remove(req.tenant.id, req.user.sub, id, req.abilities);
  }
}
