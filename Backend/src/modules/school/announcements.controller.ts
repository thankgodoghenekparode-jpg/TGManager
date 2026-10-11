import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { AnnouncementsService } from './announcements.service';
import {
  createAnnouncementSchema,
  queryAnnouncementsSchema,
  updateAnnouncementSchema,
  type CreateAnnouncementDto,
  type QueryAnnouncementsDto,
  type UpdateAnnouncementDto,
} from './dto/announcements.dto';

@ApiTags('School - Announcements')
@Controller('school/announcements')
@UseGuards(AccessGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @Permissions(PERMISSIONS.SCHOOL_VIEW)
  @ApiOperation({ summary: 'List school announcements (paginated)' })
  async list(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(queryAnnouncementsSchema))
    query: QueryAnnouncementsDto,
  ) {
    return this.announcementsService.list(req.tenant.id, query);
  }

  @Post()
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Create a school announcement' })
  async create(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createAnnouncementSchema))
    dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(
      req.tenant.id,
      req.user.sub,
      dto,
    );
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Update a school announcement' })
  async update(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAnnouncementSchema))
    dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(req.tenant.id, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.SCHOOL_MANAGE)
  @ApiOperation({ summary: 'Delete a school announcement' })
  async remove(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.announcementsService.remove(req.tenant.id, id);
  }
}