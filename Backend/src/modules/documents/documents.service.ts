import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { basename } from 'path';
import { randomUUID } from 'crypto';
import type { AbilitiesContext } from '../../common/types/permission-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, DocumentType } from '../../generated/prisma/client';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { StorageService } from '../storage/storage.service';
import type {
  CreateDocumentDto,
  GrantDocumentDto,
  ListDocumentsDto,
  UpdateDocumentDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    abilities: AbilitiesContext,
  ) {
    if (dto.branchId) {
      await this.assertBranchAccess(tenantId, dto.branchId, abilities);
    }

    const metadata = this.parseMetadata(dto.metadata);
    const key = this.buildKey(tenantId, file.originalname);
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const sizeBytes = BigInt(file.size);
    try {
      await this.planLimits.enforceDocumentLimits(tenantId, sizeBytes);
    } catch (err) {
      await this.storage.deleteObject(key);
      throw err;
    }

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        createdByUserId: userId,
        type: dto.type ?? 'GENERAL',
        title: dto.title,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return this.toResponse(doc);
  }

  async list(
    tenantId: string,
    userId: string,
    abilities: AbilitiesContext,
    query: ListDocumentsDto,
  ) {
    const where: {
      tenantId: string;
      deletedAt: null;
      branchId?: string | { in: string[] };
      type?: DocumentType;
      OR?: object[];
    } = { tenantId, deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.type) where.type = query.type;
    if (abilities.accessibleBranchIds !== null) {
      where.branchId = { in: abilities.accessibleBranchIds };
    }

    if (
      !abilities.isCompanyAdmin &&
      !abilities.permissions.includes('document.update')
    ) {
      where.OR = [
        { createdByUserId: userId },
        { grants: { some: { userId } } },
      ];
      if (abilities.accessibleBranchIds !== null) {
        where.OR.push({ branchId: { in: abilities.accessibleBranchIds } });
      }
    }

    const docs = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return docs.map((d) => this.toResponse(d));
  }

  async getOne(
    tenantId: string,
    userId: string,
    documentId: string,
    abilities: AbilitiesContext,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      include: {
        createdByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    await this.assertDocumentAccess(doc, userId, abilities);
    return this.toResponse(doc);
  }

  async getBytes(
    tenantId: string,
    userId: string,
    documentId: string,
    abilities: AbilitiesContext,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc || !doc.storageKey) {
      throw new NotFoundException('Document not found');
    }
    await this.assertDocumentAccess(doc, userId, abilities);
    const buffer = await this.storage.getObject(doc.storageKey);
    return {
      buffer,
      mimeType: doc.mimeType ?? 'application/octet-stream',
      name: doc.title,
    };
  }

  async presignDownload(
    tenantId: string,
    userId: string,
    documentId: string,
    abilities: AbilitiesContext,
  ): Promise<string | null> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc || !doc.storageKey) {
      throw new NotFoundException('Document not found');
    }
    await this.assertDocumentAccess(doc, userId, abilities);
    return this.storage.createDownloadUrl(doc.storageKey);
  }

  async uploadVersion(
    tenantId: string,
    userId: string,
    documentId: string,
    file: Express.Multer.File,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    await this.assertDocumentWriteAccess(existing, userId, abilities);

    const key = this.buildKey(tenantId, file.originalname);
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const sizeBytes = BigInt(file.size);
    try {
      await this.planLimits.enforceStorageLimit(tenantId, sizeBytes);
    } catch (err) {
      await this.storage.deleteObject(key);
      throw err;
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes,
        version: { increment: 1 },
      },
    });
    return this.toResponse(updated);
  }

  async update(
    tenantId: string,
    userId: string,
    documentId: string,
    dto: UpdateDocumentDto,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    await this.assertDocumentWriteAccess(existing, userId, abilities);
    if (dto.branchId) {
      await this.assertBranchAccess(tenantId, dto.branchId, abilities);
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        title: dto.title,
        branchId: dto.branchId === null ? null : dto.branchId,
        type: dto.type,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    return this.toResponse(updated);
  }

  async remove(
    tenantId: string,
    documentId: string,
    abilities: AbilitiesContext,
  ) {
    const existing = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }
    this.assertDocAccess(existing.branchId, abilities);
    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  }

  async grantAccess(
    tenantId: string,
    userId: string,
    documentId: string,
    dto: GrantDocumentDto,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.createdByUserId !== userId) {
      throw new ForbiddenException('Only the document owner can grant access');
    }
    if (dto.userId === userId) {
      throw new BadRequestException('Cannot grant access to yourself');
    }

    const userInTenant = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: dto.userId } },
    });
    if (!userInTenant) {
      throw new BadRequestException('User is not a member of this tenant');
    }

    const existingGrant = await this.prisma.documentGrant.findUnique({
      where: { documentId_userId: { documentId, userId: dto.userId } },
    });
    if (existingGrant) {
      throw new ConflictException(
        'Grant already exists for this user. Use PATCH to update.',
      );
    }

    return this.prisma.documentGrant.create({
      data: {
        documentId,
        userId: dto.userId,
        permission: dto.permission,
        grantedByUserId: userId,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        grantedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async revokeAccess(
    tenantId: string,
    userId: string,
    documentId: string,
    targetUserId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.createdByUserId !== userId) {
      throw new ForbiddenException('Only the document owner can revoke access');
    }

    const grant = await this.prisma.documentGrant.findUnique({
      where: { documentId_userId: { documentId, userId: targetUserId } },
    });
    if (!grant) throw new NotFoundException('Grant not found');

    await this.prisma.documentGrant.delete({
      where: { documentId_userId: { documentId, userId: targetUserId } },
    });
    return { deleted: true };
  }

  async listGrants(tenantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.documentGrant.findMany({
      where: { documentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        grantedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async assertDocumentAccess(
    doc: { id: string; createdByUserId: string; branchId: string | null },
    userId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (abilities.isCompanyAdmin) return;
    if (abilities.permissions.includes('document.update')) {
      this.assertDocAccess(doc.branchId, abilities);
      return;
    }
    if (doc.createdByUserId === userId) return;

    const grant = await this.prisma.documentGrant.findUnique({
      where: { documentId_userId: { documentId: doc.id, userId } },
    });
    if (grant) return;

    throw new ForbiddenException('You do not have access to this document');
  }

  async assertDocumentWriteAccess(
    doc: { id: string; createdByUserId: string; branchId: string | null },
    userId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (abilities.isCompanyAdmin) return;
    if (abilities.permissions.includes('document.update')) {
      this.assertDocAccess(doc.branchId, abilities);
      return;
    }
    if (doc.createdByUserId === userId) return;

    const grant = await this.prisma.documentGrant.findUnique({
      where: { documentId_userId: { documentId: doc.id, userId } },
    });
    if (grant && grant.permission === 'WRITE') return;

    throw new ForbiddenException(
      'You do not have write access to this document',
    );
  }

  private parseMetadata(raw?: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      throw new BadRequestException('metadata must be a valid JSON object');
    }
  }

  private buildKey(tenantId: string, originalName: string): string {
    const safe = basename(originalName).replace(/[^\w.-]+/g, '_') || 'file';
    return `documents/${tenantId}/${randomUUID()}/${safe}`;
  }

  private async assertBranchAccess(
    tenantId: string,
    branchId: string,
    abilities: AbilitiesContext,
  ): Promise<void> {
    if (
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException('You do not have access to this branch');
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private assertDocAccess(
    branchId: string | null,
    abilities: AbilitiesContext,
  ): void {
    if (
      branchId !== null &&
      abilities.accessibleBranchIds !== null &&
      !abilities.accessibleBranchIds.includes(branchId)
    ) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }

  private toResponse(doc: {
    id: string;
    tenantId: string;
    branchId: string | null;
    createdByUserId: string;
    type: string;
    title: string;
    storageKey: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    version: number;
    metadata: unknown;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: doc.id,
      branchId: doc.branchId,
      createdByUserId: doc.createdByUserId,
      type: doc.type,
      title: doc.title,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes?.toString() ?? null,
      version: doc.version,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
