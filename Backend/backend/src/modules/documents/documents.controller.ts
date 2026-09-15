import {
  ApiBody,
  ApiConsumes,
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
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { DocumentsService } from './documents.service';
import {
  createDocumentSchema,
  grantDocumentSchema,
  listDocumentsSchema,
  updateDocumentSchema,
  type CreateDocumentDto,
  type GrantDocumentDto,
  type ListDocumentsDto,
  type UpdateDocumentDto,
} from './dto/document.dto';

const FILE_LIMIT = 25 * 1024 * 1024;

@ApiTags('Documents')
@Controller('documents')
@UseGuards(TenantGuard, AbilitiesGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @Permissions(PERMISSIONS.DOCUMENT_CREATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a document',
    description:
      'Uploads a file and creates a document record with optional metadata.',
  })
  @ApiBody({ schema: schemaRef('CreateDocumentDto') })
  @ApiCreatedResponse({ description: 'Document created.' })
  async create(
    @Req() req: PermissionRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(createDocumentSchema)) dto: CreateDocumentDto,
  ) {
    if (!file) {
      throw new NotFoundException('File is required');
    }
    return this.documents.create(
      req.tenant.id,
      req.user.sub,
      file,
      dto,
      req.abilities,
    );
  }

  @Get()
  @Permissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List documents',
    description: 'Lists documents the current user can view, with filters.',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    type: String,
    description: 'Filter by branch ID',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['GENERAL', 'INVENTORY'],
    description: 'Filter by document type',
  })
  @ApiOkResponse({ description: 'List of documents.' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(listDocumentsSchema)) query: ListDocumentsDto,
  ) {
    return this.documents.list(
      req.tenant.id,
      req.user.sub,
      req.abilities,
      query,
    );
  }

  @Get(':id/presign')
  @Permissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'Get a download URL',
    description:
      'Returns a presigned download URL when using a cloud storage backend, or a stream hint for local storage.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiOkResponse({ description: 'Download URL or stream hint.' })
  async presign(@Req() req: PermissionRequest, @Param('id') id: string) {
    const url = await this.documents.presignDownload(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
    if (!url) {
      return { url: null, stream: true };
    }
    return { url, stream: false };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'Get a document',
    description: 'Returns a single document record by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiOkResponse({ description: 'The requested document.' })
  async getOne(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.documents.getOne(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
  }

  @Get(':id/download')
  @Permissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'Download a document',
    description: 'Streams the document file as an attachment download.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiOkResponse({ description: 'The document file as a stream.' })
  async download(@Req() req: PermissionRequest, @Param('id') id: string) {
    const file = await this.documents.getBytes(
      req.tenant.id,
      req.user.sub,
      id,
      req.abilities,
    );
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
    });
  }

  @Post(':id/versions')
  @Permissions(PERMISSIONS.DOCUMENT_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document version',
    description: 'Uploads a new file version for an existing document.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiBody({ schema: schemaRef('UploadDocumentVersionDto') })
  @ApiCreatedResponse({ description: 'Document version uploaded.' })
  async uploadVersion(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new NotFoundException('File is required');
    }
    return this.documents.uploadVersion(
      req.tenant.id,
      req.user.sub,
      id,
      file,
      req.abilities,
    );
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Update a document',
    description: 'Partially updates document metadata by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiBody({ schema: schemaRef('UpdateDocumentDto') })
  @ApiOkResponse({ description: 'Document updated.' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) dto: UpdateDocumentDto,
  ) {
    return this.documents.update(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
      req.abilities,
    );
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.DOCUMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a document',
    description: 'Deletes a document and its stored file by ID.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiNoContentResponse({ description: 'Document deleted.' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    await this.documents.remove(req.tenant.id, id, req.abilities);
  }

  @Post(':id/grants')
  @Permissions(PERMISSIONS.DOCUMENT_UPDATE)
  @ApiOperation({
    summary: 'Grant document access',
    description: 'Grants READ or WRITE access to a user for a document.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiBody({ schema: schemaRef('GrantDocumentDto') })
  @ApiCreatedResponse({ description: 'Grant created.' })
  async grantAccess(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(grantDocumentSchema)) dto: GrantDocumentDto,
  ) {
    return this.documents.grantAccess(req.tenant.id, req.user.sub, id, dto);
  }

  @Delete(':id/grants/:userId')
  @Permissions(PERMISSIONS.DOCUMENT_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke document access',
    description: "Revokes a user's access grant for a document.",
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID' })
  @ApiNoContentResponse({ description: 'Grant revoked.' })
  async revokeAccess(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.documents.revokeAccess(req.tenant.id, req.user.sub, id, userId);
  }

  @Get(':id/grants')
  @Permissions(PERMISSIONS.DOCUMENT_VIEW)
  @ApiOperation({
    summary: 'List document grants',
    description: 'Lists all access grants for a document.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Document ID (UUID)' })
  @ApiOkResponse({ description: 'List of grants.' })
  async listGrants(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.documents.listGrants(req.tenant.id, id);
  }
}
