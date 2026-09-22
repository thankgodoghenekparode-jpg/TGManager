import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../../common/access/access-control.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AdjustInventoryDto,
  CreateInventoryItemDto,
  ListInventoryDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';

const INVENTORY_ENTITY = 'inventory_item';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly access: AccessControlService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateInventoryItemDto,
    abilities: AbilitiesContext,
  ) {
    await this.access.assertBranchAccess(tenantId, dto.branchId, abilities);
    return this.prisma.inventoryItem.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        sku: dto.sku ?? null,
        name: dto.name,
        quantity: dto.quantity,
        unit: dto.unit ?? null,
        minQuantity: dto.minQuantity,
        location: dto.location ?? null,
        createdByUserId: userId,
      },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async list(
    tenantId: string,
    abilities: AbilitiesContext,
    query: ListInventoryDto,
  ) {
    const where: {
      tenantId: string;
      branchId?: string | { in: string[] };
    } = { tenantId };
    if (query.branchId) where.branchId = query.branchId;
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { branch: { select: { id: true, name: true } } },
    });

    const lowStockFiltered =
      query.lowStock === 'true'
        ? items.filter((i) => i.quantity <= i.minQuantity)
        : items;
    return lowStockFiltered.map((i) => ({
      ...i,
      isLowStock: i.quantity <= i.minQuantity,
    }));
  }

  async getOne(tenantId: string, itemId: string, abilities: AbilitiesContext) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
      include: { branch: { select: { id: true, name: true } } },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    this.access.assertBranchScope(item.branchId, abilities);
    return { ...item, isLowStock: item.quantity <= item.minQuantity };
  }

  async update(
    tenantId: string,
    itemId: string,
    dto: UpdateInventoryItemDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');
    this.access.assertBranchScope(existing.branchId, abilities);

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        sku: dto.sku === undefined ? undefined : dto.sku,
        name: dto.name,
        unit: dto.unit === undefined ? undefined : dto.unit,
        minQuantity: dto.minQuantity,
        location: dto.location === undefined ? undefined : dto.location,
      },
    });
    return { ...updated, isLowStock: updated.quantity <= updated.minQuantity };
  }

  async adjust(
    tenantId: string,
    userId: string,
    itemId: string,
    dto: AdjustInventoryDto,
    abilities: AbilitiesContext,
    ip?: string,
  ) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');
    this.access.assertBranchScope(existing.branchId, abilities);

    const nextQuantity = existing.quantity + dto.delta;
    if (nextQuantity < 0) {
      throw new BadRequestException(
        'Adjustment would drive quantity below zero',
      );
    }

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: nextQuantity },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'INVENTORY_ADJUSTED',
        entityType: INVENTORY_ENTITY,
        entityId: itemId,
        metadata: {
          delta: dto.delta,
          reason: dto.reason,
          before: existing.quantity,
          after: nextQuantity,
        },
        ip: ip ?? null,
      },
    });

    const isLowStock = nextQuantity <= updated.minQuantity;
    if (isLowStock && existing.quantity > existing.minQuantity) {
      const managers = await this.inventoryManagers(tenantId);
      await this.notifications.createMany(
        tenantId,
        managers.map((managerId) => ({
          userId: managerId,
          type: 'INVENTORY_LOW_STOCK',
          title: `Low stock: ${updated.name}`,
          body: `Quantity is now ${nextQuantity} ${updated.unit ?? 'units'}`,
          data: { itemId: updated.id, quantity: nextQuantity },
        })),
      );
    }

    return { ...updated, isLowStock };
  }

  async remove(tenantId: string, itemId: string, abilities: AbilitiesContext) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId },
    });
    if (!existing) throw new NotFoundException('Inventory item not found');
    this.access.assertBranchScope(existing.branchId, abilities);
    await this.prisma.inventoryItem.delete({ where: { id: itemId } });
  }

  private async inventoryManagers(tenantId: string): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: {
        tenantId,
        companyRole: {
          permissions: { has: 'inventory.manage' },
        },
      },
      select: { userId: true },
    });
    return [...new Set(assignments.map((a) => a.userId))];
  }
}
