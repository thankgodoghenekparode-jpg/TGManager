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
  adjustInventorySchema,
  createInventoryItemSchema,
  listInventorySchema,
  updateInventoryItemSchema,
  type AdjustInventoryDto,
  type CreateInventoryItemDto,
  type ListInventoryDto,
  type UpdateInventoryItemDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(TenantGuard, AbilitiesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post()
  @Permissions(PERMISSIONS.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Create an inventory item',
    description: 'Creates a new inventory item for a branch.',
  })
  @ApiBody({ schema: schemaRef('CreateInventoryItemDto') })
  @ApiCreatedResponse({ description: 'Inventory item created.' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createInventoryItemSchema))
    dto: CreateInventoryItemDto,
  ) {
    return this.inventory.create(
      req.tenant.id,
      req.user.sub,
      dto,
      req.abilities,
    );
  }

  @Get()
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({
    summary: 'List inventory',
    description:
      'Lists inventory items the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter to low-stock items only',
  })
  @ApiOkResponse({ description: 'List of inventory items.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listInventorySchema)) query: ListInventoryDto,
  ) {
    return this.inventory.list(req.tenant.id, req.abilities, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({
    summary: 'Get an inventory item',
    description: 'Returns a single inventory item by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inventory item ID (UUID)',
  })
  @ApiOkResponse({ description: 'The requested inventory item.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.inventory.getOne(req.tenant.id, id, req.abilities);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Update an inventory item',
    description: 'Partially updates an inventory item by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inventory item ID (UUID)',
  })
  @ApiBody({ schema: schemaRef('UpdateInventoryItemDto') })
  @ApiOkResponse({ description: 'Inventory item updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInventoryItemSchema))
    dto: UpdateInventoryItemDto,
  ) {
    return this.inventory.update(req.tenant.id, id, dto, req.abilities);
  }

  @Post(':id/adjust')
  @Permissions(PERMISSIONS.INVENTORY_MANAGE)
  @ApiOperation({
    summary: 'Adjust inventory quantity',
    description:
      'Applies a quantity adjustment to an inventory item with a reason.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inventory item ID (UUID)',
  })
  @ApiBody({ schema: schemaRef('AdjustInventoryDto') })
  @ApiOkResponse({ description: 'Quantity adjusted.' })
  async adjust(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adjustInventorySchema)) dto: AdjustInventoryDto,
  ) {
    return this.inventory.adjust(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
      req.ip,
    );
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.INVENTORY_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an inventory item',
    description: 'Deletes an inventory item by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inventory item ID (UUID)',
  })
  @ApiNoContentResponse({ description: 'Inventory item deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.inventory.remove(req.tenant.id, id, req.abilities);
  }
}
