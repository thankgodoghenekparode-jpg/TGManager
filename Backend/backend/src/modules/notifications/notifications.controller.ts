import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AbilitiesGuard } from '../../common/guards/abilities.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(TenantGuard, AbilitiesGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description: 'Lists notifications for the current user, most recent first.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of notifications to return',
  })
  @ApiOkResponse({ description: 'List of notifications.' })
  async list(@Req() req: PermissionRequest, @Query('limit') limit?: string) {
    return this.notifications.list(
      req.tenant.id,
      req.user.sub,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Returns the number of unread notifications for the user.',
  })
  @ApiOkResponse({ description: 'Unread notification count.' })
  async unreadCount(@Req() req: PermissionRequest) {
    return this.notifications.unreadCount(req.tenant.id, req.user.sub);
  }

  @Post('read-all')
  @ApiOperation({
    summary: 'Mark all as read',
    description: 'Marks every notification as read for the current user.',
  })
  @ApiOkResponse({ description: 'All notifications marked as read.' })
  async markAllRead(@Req() req: PermissionRequest) {
    return this.notifications.markAllRead(req.tenant.id, req.user.sub);
  }

  @Post(':id/read')
  @ApiOperation({
    summary: 'Mark a notification as read',
    description: 'Marks a single notification as read.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Notification ID (UUID)' })
  @ApiOkResponse({ description: 'Notification marked as read.' })
  async markRead(@Req() req: PermissionRequest, @Param('id') id: string) {
    return this.notifications.markRead(req.tenant.id, req.user.sub, id);
  }
}
