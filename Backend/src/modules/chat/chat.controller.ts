import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
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
import { AccessGuard } from '../../common/guards/access.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { schemaRef } from '../../common/swagger/zod-to-openapi';
import type { PermissionRequest } from '../../common/types/permission-request.interface';
import { PERMISSIONS } from '../rbac/permissions/permissions.constants';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  addMembersSchema,
  createConversationSchema,
  editMessageSchema,
  messageHistorySchema,
  reactionSchema,
  searchChatSchema,
  sendMessageSchema,
  updateConversationSchema,
  type AddMembersDto,
  type CreateConversationDto,
  type EditMessageDto,
  type MessageHistoryDto,
  type ReactionDto,
  type SearchChatDto,
  type SendMessageDto,
  type UpdateConversationDto,
} from './dto/chat.dto';

const FILE_LIMIT = 25 * 1024 * 1024;

@ApiTags('Chat')
@Controller('chat')
@UseGuards(AccessGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Post('conversations')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Create a conversation',
    description:
      'Creates a DIRECT or GROUP conversation and notifies other members via WebSocket.',
  })
  @ApiBody({ schema: schemaRef('CreateConversationDto') })
  @ApiCreatedResponse({ description: 'Conversation created.' })
  async createConversation(
    @Req() req: PermissionRequest,
    @Body(new ZodValidationPipe(createConversationSchema))
    dto: CreateConversationDto,
  ) {
    const conversation = await this.chat.createConversation(
      req.tenant.id,
      req.user.sub,
      dto,
    );
    for (const member of conversation.members ?? []) {
      if (member.userId !== req.user.sub) {
        this.gateway.emitToUser(
          member.userId,
          'chat:conversation',
          conversation,
        );
      }
    }
    return conversation;
  }

  @Get('conversations')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'List conversations',
    description: 'Lists conversations the current user participates in.',
  })
  @ApiOkResponse({ description: 'List of conversations.' })
  async listConversations(@Req() req: PermissionRequest) {
    return this.chat.listConversations(req.tenant.id, req.user.sub);
  }

  @Get('conversations/:id')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Get a conversation',
    description: 'Returns a single conversation by ID.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Conversation ID (UUID)',
  })
  @ApiOkResponse({ description: 'The requested conversation.' })
  async getConversation(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
  ) {
    return this.chat.getConversation(req.tenant.id, req.user.sub, id);
  }

  @Get('unread-count')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Get unread message count',
    description: 'Returns the total unread message count for the current user.',
  })
  @ApiOkResponse({ description: 'Unread message count.' })
  async unreadCount(@Req() req: PermissionRequest) {
    return this.chat.unreadCount(req.tenant.id, req.user.sub);
  }

  @Get('search')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Search chat',
    description:
      'Searches messages, conversations and users within the tenant.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['messages', 'conversations', 'users'],
    description: 'Scope of the search',
  })
  @ApiOkResponse({ description: 'Search results.' })
  async search(
    @Req() req: PermissionRequest,
    @Query(new ZodValidationPipe(searchChatSchema)) query: SearchChatDto,
  ) {
    return this.chat.search(req.tenant.id, req.user.sub, query);
  }

  @Get('presence')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Get online users',
    description: 'Returns the user ids currently connected within the tenant.',
  })
  @ApiOkResponse({ description: 'Online user ids.' })
  presence(@Req() req: PermissionRequest) {
    return { onlineUserIds: this.gateway.getOnlineUserIds(req.tenant.id) };
  }

  @Get('conversations/:id/messages')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Get message history',
    description:
      'Returns paginated message history for a conversation (cursor based).',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Conversation ID (UUID)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum messages to return (1-100, default 50)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Opaque pagination cursor',
  })
  @ApiOkResponse({ description: 'Message history.' })
  async messageHistory(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(messageHistorySchema))
    query: MessageHistoryDto,
  ) {
    return this.chat.messageHistory(req.tenant.id, req.user.sub, id, query);
  }

  @Post('conversations/:id/messages')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Sends a message in a conversation and broadcasts it via WebSocket.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Conversation ID (UUID)',
  })
  @ApiBody({ schema: schemaRef('SendMessageDto') })
  @ApiCreatedResponse({ description: 'Message sent.' })
  async sendMessage(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    const message = await this.chat.sendMessage(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
    );
    this.gateway.emitToConversation(id, 'chat:message', message);
    await this.gateway.dispatchNotifications(
      req.tenant.id,
      id,
      req.user.sub,
      message,
    );
    return message;
  }

  @Post('conversations/:id/attachments')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_LIMIT } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a chat attachment',
    description:
      'Uploads a file as a chat attachment. Any conversation member can upload attachments without document permissions.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Conversation ID (UUID)',
  })
  @ApiCreatedResponse({ description: 'Attachment uploaded.' })
  async uploadAttachment(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new NotFoundException('File is required');
    }
    return this.chat.uploadAttachment(req.tenant.id, req.user.sub, id, file);
  }

  @Get('attachments/:documentId')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Download a chat attachment',
    description:
      'Streams a chat attachment to any participant of a conversation that references it.',
  })
  @ApiParam({
    name: 'documentId',
    type: String,
    description: 'Document ID (UUID)',
  })
  @ApiOkResponse({ description: 'The attachment file as a stream.' })
  async downloadAttachment(
    @Req() req: PermissionRequest,
    @Param('documentId') documentId: string,
  ) {
    const file = await this.chat.getAttachmentBytes(
      req.tenant.id,
      req.user.sub,
      documentId,
    );
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
    });
  }

  @Patch('messages/:id')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Edit a message',
    description: "Updates a message's text (only the sender can edit).",
  })
  @ApiParam({ name: 'id', type: String, description: 'Message ID' })
  @ApiBody({ schema: schemaRef('EditMessageDto') })
  @ApiOkResponse({ description: 'Message updated.' })
  async editMessage(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(editMessageSchema)) dto: EditMessageDto,
  ) {
    const message = await this.chat.editMessage(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
    );
    this.gateway.emitToConversation(
      message.conversationId,
      'chat:message_edited',
      message,
    );
    return message;
  }

  @Delete('messages/:id')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Delete a message',
    description:
      'Deletes a message for the sender only (default) or for everyone.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Message ID' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ['me', 'all'],
    description: 'Delete for me only, or for everyone',
  })
  @ApiOkResponse({ description: 'Message deleted.' })
  async deleteMessage(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Query('scope') scope?: string,
  ) {
    const message = await this.chat.deleteMessage(
      req.tenant.id,
      req.user.sub,
      id,
      scope === 'all' ? 'all' : 'me',
    );
    if (scope === 'all') {
      this.gateway.emitToConversation(
        message.conversationId,
        'chat:message_deleted',
        {
          conversationId: message.conversationId,
          messageId: message.id,
          deletedAt: message.deletedAt,
        },
      );
    } else {
      this.gateway.emitToUser(req.user.sub, 'chat:message_deleted_for_me', {
        conversationId: message.conversationId,
        messageId: message.id,
      });
    }
    return message;
  }

  @Post('messages/:id/reactions')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'React to a message',
    description: 'Adds or removes (toggles) an emoji reaction on a message.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Message ID' })
  @ApiBody({ schema: schemaRef('ReactionDto') })
  @ApiOkResponse({ description: 'Reaction state.' })
  async addReaction(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reactionSchema)) dto: ReactionDto,
  ) {
    const result = await this.chat.toggleReaction(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
    );
    const conversationId = await this.conversationIdFor(req.tenant.id, id);
    this.gateway.emitToConversation(conversationId, 'chat:reaction', {
      conversationId,
      messageId: id,
      emoji: dto.emoji,
      added: result.added,
      reactions: result.reactions,
    });
    return result;
  }

  @Delete('messages/:id/reactions/:emoji')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a reaction',
    description: 'Removes an emoji reaction the current user added.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Message ID' })
  @ApiParam({ name: 'emoji', type: String, description: 'Emoji to remove' })
  @ApiOkResponse({ description: 'Reaction removed.' })
  async removeReaction(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('emoji') emoji: string,
  ) {
    const result = await this.chat.removeReaction(
      req.tenant.id,
      req.user.sub,
      id,
      emoji,
    );
    const conversationId = await this.conversationIdFor(req.tenant.id, id);
    this.gateway.emitToConversation(conversationId, 'chat:reaction', {
      conversationId,
      messageId: id,
      emoji,
      added: false,
      reactions: result.reactions,
    });
    return result;
  }

  @Patch('conversations/:id')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Update a conversation',
    description:
      'Renames a group (admins) or mutes the conversation for the current user.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation ID' })
  @ApiBody({ schema: schemaRef('UpdateConversationDto') })
  @ApiOkResponse({ description: 'Conversation updated.' })
  async updateConversation(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConversationSchema))
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.chat.updateConversation(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
    );
    for (const member of conversation.members ?? []) {
      if (member.userId !== req.user.sub) {
        this.gateway.emitToUser(
          member.userId,
          'chat:conversation',
          conversation,
        );
      }
    }
    return conversation;
  }

  @Post('conversations/:id/leave')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Leave a group conversation',
    description: 'Removes the current user from a group conversation.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation ID' })
  @ApiOkResponse({ description: 'Left the conversation.' })
  async leaveConversation(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
  ) {
    const result = await this.chat.leaveConversation(
      req.tenant.id,
      req.user.sub,
      id,
    );
    if (!result.deleted) {
      this.gateway.emitToConversation(id, 'chat:member_left', {
        conversationId: id,
        userId: req.user.sub,
      });
    }
    return result;
  }

  @Post('conversations/:id/members')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Add group members',
    description: 'Adds members to a group conversation (admins only).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation ID' })
  @ApiBody({ schema: schemaRef('AddMembersDto') })
  @ApiCreatedResponse({ description: 'Members added.' })
  async addMembers(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addMembersSchema)) dto: AddMembersDto,
  ) {
    const conversation = await this.chat.addMembers(
      req.tenant.id,
      req.user.sub,
      id,
      dto,
    );
    for (const member of conversation.members ?? []) {
      if (member.userId !== req.user.sub) {
        this.gateway.emitToUser(
          member.userId,
          'chat:conversation',
          conversation,
        );
      }
    }
    return conversation;
  }

  @Delete('conversations/:id/members/:userId')
  @Permissions(PERMISSIONS.CHAT_CREATE)
  @ApiOperation({
    summary: 'Remove a group member',
    description: 'Removes a member from a group conversation (admins only).',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation ID' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID' })
  @ApiOkResponse({ description: 'Member removed.' })
  async removeMember(
    @Req() req: PermissionRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const conversation = await this.chat.removeMember(
      req.tenant.id,
      req.user.sub,
      id,
      userId,
    );
    for (const member of conversation.members ?? []) {
      if (member.userId !== req.user.sub) {
        this.gateway.emitToUser(
          member.userId,
          'chat:conversation',
          conversation,
        );
      }
    }
    return conversation;
  }

  @Post('conversations/:id/read')
  @Permissions(PERMISSIONS.CHAT_VIEW)
  @ApiOperation({
    summary: 'Mark conversation as read',
    description:
      'Marks all messages in a conversation as read for the current user.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Conversation ID (UUID)',
  })
  @ApiOkResponse({ description: 'Conversation marked as read.' })
  async markRead(@Req() req: PermissionRequest, @Param('id') id: string) {
    const result = await this.chat.markRead(req.tenant.id, req.user.sub, id);
    this.gateway.emitToConversation(id, 'chat:read', {
      conversationId: id,
      userId: req.user.sub,
      messageIds: result.messageIds,
    });
    return result;
  }

  private async conversationIdFor(tenantId: string, messageId: string) {
    const message = await this.chat.messageConversationId(tenantId, messageId);
    return message.conversationId;
  }
}
