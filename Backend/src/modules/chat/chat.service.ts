import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import {
  decodeCursor,
  paginate,
} from '../../common/pagination/pagination.util';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanLimitsService } from '../plans/plan-limits.service';
import { StorageService } from '../storage/storage.service';
import type {
  AddMembersDto,
  CreateConversationDto,
  EditMessageDto,
  MessageHistoryDto,
  ReactionDto,
  SearchChatDto,
  SendMessageDto,
  UpdateConversationDto,
} from './dto/chat.dto';

export interface ConversationListItem {
  id: string;
  tenantId: string;
  type: string;
  name: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: { id: string; createdAt: Date }[];
  members: { userId: string }[];
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Short-window dedupe for identical sends from the same user/conversation
   * (double-clicks, Enter auto-repeat, network retries). Prevents a message
   * from being created more than once per ~1.5s burst.
   */
  private readonly recentSends = new Map<
    string,
    { createdAt: number; message: ReturnType<ChatService['messagePayload']> }
  >();

  /**
   * WebRTC ICE server configuration for live calls. Set CALL_ICE_SERVERS to a
   * JSON array of servers (e.g. TURN credentials); otherwise falls back to a
   * public Google STUN server for host/reflexive candidates.
   */
  getCallConfig(): { iceServers: unknown[] } {
    const raw = this.config.get<string>('CALL_ICE_SERVERS');
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return { iceServers: parsed as unknown[] };
      } catch {
        // fall through to the default below
      }
    }
    return {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
  }

  async createConversation(
    tenantId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    if (dto.type === 'DIRECT') {
      const otherUserId = dto.otherUserId as string;
      if (otherUserId === userId) {
        throw new BadRequestException('Cannot chat with yourself');
      }
      await this.assertUserInTenant(tenantId, otherUserId);

      const existing = await this.findDirectConversation(
        tenantId,
        userId,
        otherUserId,
      );
      if (existing) {
        return this.getConversation(tenantId, userId, existing.id);
      }

      const conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          type: 'DIRECT',
          createdByUserId: userId,
          members: {
            create: [{ userId }, { userId: otherUserId }],
          },
        },
        include: this.conversationInclude(),
      });
      return this.withUnread(conversation, userId);
    }

    const memberIds = [...new Set([userId, ...(dto.memberIds ?? [])])];
    const existingUsers = await this.prisma.tenantUser.findMany({
      where: { tenantId, userId: { in: memberIds } },
      select: { userId: true },
    });
    const validIds = new Set(existingUsers.map((u) => u.userId));
    for (const id of memberIds) {
      if (!validIds.has(id)) {
        throw new BadRequestException(
          'One or more members are not in this tenant',
        );
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        type: 'GROUP',
        name: dto.name as string,
        createdByUserId: userId,
        members: {
          create: memberIds.map((id) => ({
            userId: id,
            role: id === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: this.conversationInclude(),
    });
    return this.withUnread(conversation, userId);
  }

  async listConversations(tenantId: string, userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const results = [];
    for (const member of memberships) {
      const { conversation } = member;
      const item = await this.withUnread(conversation, userId);
      results.push({ ...item, muted: member.muted, myRole: member.role });
    }
    results.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.createdAt;
      const bTime = b.lastMessage?.createdAt ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    return results;
  }

  async getConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: this.conversationInclude(),
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const membership = await this.assertMemberReturn(conversationId, userId);
    const base = await this.withUnread(conversation, userId);
    return { ...base, muted: membership.muted, myRole: membership.role };
  }

  async sendMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    await this.assertConversation(tenantId, conversationId);
    await this.assertMember(conversationId, userId);

    const dedupeKey = [
      userId,
      conversationId,
      dto.body?.trim() ?? '',
      dto.documentIds?.[0] ?? '',
      dto.parentId ?? '',
    ].join('|');
    const prior = this.recentSends.get(dedupeKey);
    if (prior && Date.now() - prior.createdAt < 1500) {
      return prior.message;
    }

    await this.planLimits.enforceChatMessagesLimit(tenantId);

    let documentId: string | null = null;
    let kind: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'VOICE' = 'TEXT';
    if (dto.documentIds && dto.documentIds.length > 0) {
      const docId = dto.documentIds[0];
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, tenantId, deletedAt: null },
      });
      if (!doc) throw new BadRequestException('Document not found');
      documentId = docId;
      if (doc.mimeType?.startsWith('image/')) kind = 'IMAGE';
      else if (doc.mimeType?.startsWith('video/')) kind = 'VIDEO';
      else if (doc.mimeType?.startsWith('audio/')) kind = 'AUDIO';
      else kind = 'FILE';
    }

    if (dto.parentId) {
      const parent = await this.prisma.message.findFirst({
        where: {
          id: dto.parentId,
          conversationId,
          deletedAt: null,
          OR: [{ deletedForSender: false }, { senderId: userId }],
        },
        select: { id: true },
      });
      if (!parent)
        throw new BadRequestException('Replied-to message not found');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        kind,
        body: dto.body?.trim() || null,
        documentId,
        parentId: dto.parentId ?? null,
      },
      include: this.messageInclude(),
    });

    const payload = this.messagePayload(message, userId);
    this.recentSends.set(dedupeKey, {
      createdAt: Date.now(),
      message: payload,
    });
    if (this.recentSends.size > 2000) {
      const now = Date.now();
      for (const [key, entry] of this.recentSends) {
        if (now - entry.createdAt > 5000) this.recentSends.delete(key);
      }
    }
    return payload;
  }

  async uploadAttachment(
    tenantId: string,
    userId: string,
    conversationId: string,
    file: Express.Multer.File,
  ) {
    await this.assertConversation(tenantId, conversationId);
    await this.assertMember(conversationId, userId);

    const key = this.attachmentKey(tenantId, conversationId, file.originalname);
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const sizeBytes = BigInt(file.size);
    try {
      await this.planLimits.enforceStorageLimit(tenantId, sizeBytes);
    } catch (err) {
      await this.storage.deleteObject(key);
      throw err;
    }

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        branchId: null,
        createdByUserId: userId,
        type: 'GENERAL',
        title: file.originalname,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes,
        metadata: { source: 'chat', conversationId },
      },
    });

    return {
      id: doc.id,
      tenantId: doc.tenantId,
      branchId: doc.branchId,
      createdByUserId: doc.createdByUserId,
      type: doc.type,
      title: doc.title,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes?.toString() ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async getAttachmentBytes(
    tenantId: string,
    userId: string,
    documentId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      select: {
        id: true,
        title: true,
        storageKey: true,
        mimeType: true,
        createdByUserId: true,
      },
    });
    if (!doc || !doc.storageKey) {
      throw new NotFoundException('Attachment not found');
    }
    if (doc.createdByUserId !== userId) {
      const inConversation = await this.prisma.message.findFirst({
        where: {
          documentId,
          deletedAt: null,
          conversation: { members: { some: { userId } } },
        },
        select: { id: true },
      });
      if (!inConversation) {
        throw new ForbiddenException(
          'You do not have access to this attachment',
        );
      }
    }
    const buffer = await this.storage.getObject(doc.storageKey);
    return {
      buffer,
      mimeType: doc.mimeType ?? 'application/octet-stream',
      name: doc.title,
    };
  }

  private attachmentKey(
    tenantId: string,
    conversationId: string,
    originalName: string,
  ): string {
    const safe = basename(originalName).replace(/[^\w.-]+/g, '_') || 'file';
    return `chat/${tenantId}/${conversationId}/${randomUUID()}/${safe}`;
  }

  async messageHistory(
    tenantId: string,
    userId: string,
    conversationId: string,
    query: MessageHistoryDto,
  ) {
    await this.assertConversation(tenantId, conversationId);
    await this.assertMember(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        NOT: { senderId: userId, deletedForSender: true },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: decodeCursor(query.cursor)! },
            skip: 1,
          }
        : {}),
      include: this.messageInclude(),
    });

    return paginate(
      messages.map((m) => this.messagePayload(m, userId)),
      query.limit,
    );
  }

  async markRead(tenantId: string, userId: string, conversationId: string) {
    await this.assertConversation(tenantId, conversationId);
    await this.assertMember(conversationId, userId);

    const unread = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        NOT: { reads: { some: { userId } } },
      },
      select: { id: true },
    });

    if (unread.length > 0) {
      await this.prisma.messageRead.createMany({
        data: unread.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }
    return { marked: unread.length, messageIds: unread.map((m) => m.id) };
  }

  async unreadCount(tenantId: string, userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const ids = memberships.map((m) => m.conversationId);
    if (ids.length === 0) return { count: 0 };

    const count = await this.prisma.message.count({
      where: {
        conversationId: { in: ids },
        senderId: { not: userId },
        deletedAt: null,
        NOT: { reads: { some: { userId } } },
      },
    });
    return { count };
  }

  async editMessage(
    tenantId: string,
    userId: string,
    messageId: string,
    dto: EditMessageDto,
  ) {
    const message = await this.findMessage(tenantId, messageId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit a message');
    }
    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body: dto.body.trim(), editedAt: new Date() },
      include: this.messageInclude(),
    });
    return this.messagePayload(updated, userId);
  }

  async deleteMessage(
    tenantId: string,
    userId: string,
    messageId: string,
    scope: 'me' | 'all' = 'me',
  ) {
    const message = await this.findMessage(tenantId, messageId);
    const mayDeleteAll =
      scope === 'all' &&
      (message.senderId === userId ||
        (await this.isAdmin(tenantId, message.conversationId, userId)));
    if (scope === 'all' && !mayDeleteAll) {
      throw new ForbiddenException(
        'Only the sender or a group admin can delete for everyone',
      );
    }
    if (scope === 'me' && message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own message');
    }

    const data =
      scope === 'all'
        ? { deletedAt: new Date(), body: null }
        : { deletedForSender: true };
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data,
      include: this.messageInclude(),
    });
    return this.messagePayload(updated, userId);
  }

  async toggleReaction(
    tenantId: string,
    userId: string,
    messageId: string,
    dto: ReactionDto,
  ) {
    const message = await this.findMessage(tenantId, messageId);
    await this.assertMember(message.conversationId, userId);

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
      },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      return {
        messageId,
        emoji: dto.emoji,
        added: false,
        reactions: await this.reactionsFor(messageId, userId),
      };
    }
    await this.prisma.messageReaction.create({
      data: { messageId, userId, emoji: dto.emoji },
    });
    return {
      messageId,
      emoji: dto.emoji,
      added: true,
      reactions: await this.reactionsFor(messageId, userId),
    };
  }

  async removeReaction(
    tenantId: string,
    userId: string,
    messageId: string,
    emoji: string,
  ) {
    const message = await this.findMessage(tenantId, messageId);
    await this.assertMember(message.conversationId, userId);
    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });
    return {
      messageId,
      emoji,
      removed: true,
      reactions: await this.reactionsFor(messageId, userId),
    };
  }

  async search(tenantId: string, userId: string, query: SearchChatDto) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const convIds = memberships.map((m) => m.conversationId);

    const [messages, conversations, users] = await Promise.all([
      query.kind === undefined || query.kind === 'messages'
        ? convIds.length
          ? this.prisma.message.findMany({
              where: {
                conversationId: { in: convIds },
                deletedAt: null,
                NOT: { senderId: userId, deletedForSender: true },
                body: { contains: query.q, mode: 'insensitive' },
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: this.messageInclude(),
            })
          : Promise.resolve([])
        : Promise.resolve([]),
      query.kind === undefined || query.kind === 'conversations'
        ? this.prisma.conversation.findMany({
            where: {
              tenantId,
              type: 'GROUP',
              name: { contains: query.q, mode: 'insensitive' },
              members: { some: { userId } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
            include: this.conversationInclude(),
          })
        : Promise.resolve([]),
      query.kind === undefined || query.kind === 'users'
        ? this.prisma.user.findMany({
            where: {
              tenantUsers: { some: { tenantId } },
              NOT: { id: userId },
              OR: [
                { firstName: { contains: query.q, mode: 'insensitive' } },
                { lastName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            },
            take: 20,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          })
        : Promise.resolve([]),
    ]);

    return {
      messages: messages.map((m) => this.messagePayload(m, userId)),
      conversations: conversations.map((c) => this.withUnread(c, userId)),
      users,
    };
  }

  async updateConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.assertConversationReturn(
      tenantId,
      conversationId,
    );
    const membership = await this.assertMemberReturn(conversationId, userId);

    const data: Prisma.ConversationUncheckedUpdateInput = {};
    if (dto.muted !== undefined) {
      await this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { muted: dto.muted },
      });
    }
    if (dto.name !== undefined && dto.name !== null) {
      if (conversation.type !== 'GROUP') {
        throw new BadRequestException('Only groups can be renamed');
      }
      const canManage =
        membership.role === 'ADMIN' ||
        membership.role === 'OWNER' ||
        conversation.createdByUserId === userId;
      if (!canManage) {
        throw new ForbiddenException('Only admins can rename the group');
      }
      data.name = dto.name.trim();
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { name: data.name },
      });
    }

    const updated = await this.getConversation(
      tenantId,
      userId,
      conversationId,
    );
    return updated;
  }

  async leaveConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ) {
    const conversation = await this.assertConversationReturn(
      tenantId,
      conversationId,
    );
    await this.assertMember(conversationId, userId);
    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('You cannot leave a direct chat');
    }

    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });
    const remaining = await this.prisma.conversationMember.count({
      where: { conversationId },
    });
    if (remaining === 0) {
      await this.prisma.conversation.delete({ where: { id: conversationId } });
      return { left: true, deleted: true };
    }
    return { left: true, deleted: false };
  }

  async addMembers(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: AddMembersDto,
  ) {
    const conversation = await this.assertConversationReturn(
      tenantId,
      conversationId,
    );
    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Members can only be added to groups');
    }
    await this.assertCanManage(userId, conversation);

    const existingUsers = await this.prisma.tenantUser.findMany({
      where: { tenantId, userId: { in: dto.memberIds } },
      select: { userId: true },
    });
    const validIds = new Set(existingUsers.map((u) => u.userId));
    const missing = dto.memberIds.find((id) => !validIds.has(id));
    if (missing) {
      throw new BadRequestException(
        'One or more members are not in this tenant',
      );
    }

    const current = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const existing = new Set(current.map((m) => m.userId));
    const toAdd = dto.memberIds.filter((id) => !existing.has(id));
    if (toAdd.length > 0) {
      await this.prisma.conversationMember.createMany({
        data: toAdd.map((id) => ({ conversationId, userId: id })),
        skipDuplicates: true,
      });
    }

    return this.getConversation(tenantId, userId, conversationId);
  }

  async removeMember(
    tenantId: string,
    userId: string,
    conversationId: string,
    memberUserId: string,
  ) {
    const conversation = await this.assertConversationReturn(
      tenantId,
      conversationId,
    );
    if (conversation.type !== 'GROUP') {
      throw new BadRequestException('Members can only be removed from groups');
    }
    await this.assertCanManage(userId, conversation);
    if (conversation.createdByUserId === memberUserId) {
      throw new BadRequestException('The group owner cannot be removed');
    }

    await this.prisma.conversationMember.delete({
      where: {
        conversationId_userId: { conversationId, userId: memberUserId },
      },
    });
    return this.getConversation(tenantId, userId, conversationId);
  }

  /**
   * Creates in-app notifications for a newly sent message: mention targets
   * (including @everyone) and the other non-muted members. Returns the created
   * notifications so the caller can emit them over the socket.
   */
  async notifyForMessage(
    tenantId: string,
    conversationId: string,
    senderId: string,
    message: {
      id: string;
      body: string | null;
    },
  ) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    const sender = members.find((m) => m.userId === senderId)?.user;
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`.trim()
      : 'Someone';
    const body = message.body;
    const preview = body
      ? body.length > 120
        ? `${body.slice(0, 120)}…`
        : body
      : 'Sent an attachment';

    const mentioned = this.extractMentions(body, members);
    const targets = members.filter(
      (m) =>
        m.userId !== senderId && (mentioned.has(m.userId) ? true : !m.muted),
    );
    if (targets.length === 0) return { count: 0, notifications: [] };

    const notifications = await Promise.all(
      targets.map((m) =>
        this.prisma.notification.create({
          data: {
            tenantId,
            userId: m.userId,
            type: mentioned.has(m.userId) ? 'CHAT_MENTION' : 'CHAT_MESSAGE',
            title: mentioned.has(m.userId)
              ? `${senderName} mentioned you`
              : senderName,
            body: preview,
            data: {
              conversationId,
              messageId: message.id,
              senderId,
            },
          },
        }),
      ),
    );
    return { count: notifications.length, notifications };
  }

  async assertMember(conversationId: string, userId: string): Promise<void> {
    await this.assertMemberReturn(conversationId, userId);
  }

  async messageConversationId(tenantId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversation: { tenantId } },
      select: { id: true, conversationId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  private async assertMemberReturn(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { userId: true, muted: true, role: true },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
    return member;
  }

  private async assertConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<void> {
    await this.assertConversationReturn(tenantId, conversationId);
  }

  private async assertConversationReturn(
    tenantId: string,
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, type: true, createdByUserId: true, tenantId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async assertUserInTenant(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { userId: true },
    });
    if (!membership) {
      throw new BadRequestException('User is not a member of this tenant');
    }
  }

  private async findMessage(tenantId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { tenantId },
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        deletedAt: true,
      },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  private async isAdmin(
    tenantId: string,
    conversationId: string,
    userId: string,
  ) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { role: true },
    });
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { createdByUserId: true },
    });
    return (
      membership?.role === 'ADMIN' ||
      membership?.role === 'OWNER' ||
      conversation?.createdByUserId === userId
    );
  }

  private async assertCanManage(
    userId: string,
    conversation: { id: string; createdByUserId: string },
  ) {
    if (conversation.createdByUserId === userId) return;
    const membership = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId,
        },
      },
      select: { role: true },
    });
    if (membership?.role !== 'ADMIN' && membership?.role !== 'OWNER') {
      throw new ForbiddenException('Only group admins can manage members');
    }
  }

  private extractMentions(
    body: string | null,
    members: Array<{
      userId: string;
      user: { id: string; firstName: string; lastName: string; email: string };
    }>,
  ): Set<string> {
    const result = new Set<string>();
    if (!body) return result;
    if (body.toLowerCase().includes('@everyone')) {
      for (const m of members) result.add(m.userId);
      return result;
    }
    for (const m of members) {
      const full = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
      if (
        full &&
        new RegExp(`@${full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(
          body,
        )
      ) {
        result.add(m.userId);
      }
    }
    return result;
  }

  private findDirectConversation(
    tenantId: string,
    userA: string,
    userB: string,
  ) {
    return this.prisma.conversation
      .findFirst({
        where: {
          tenantId,
          type: 'DIRECT',
          members: { some: { userId: userA } },
          AND: { members: { some: { userId: userB } } },
        },
        include: { members: { select: { userId: true } } },
      })
      .then((c) => c ?? null);
  }

  private conversationInclude() {
    return {
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    } satisfies Prisma.ConversationInclude;
  }

  private messageInclude() {
    return {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      document: {
        select: {
          id: true,
          title: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
      parent: {
        select: {
          id: true,
          kind: true,
          body: true,
          senderId: true,
          createdAt: true,
          sender: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      reactions: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      reads: { select: { userId: true, readAt: true } },
    } satisfies Prisma.MessageInclude;
  }

  private async reactionsFor(messageId: string, userId: string) {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const byEmoji = new Map<
      string,
      {
        emoji: string;
        count: number;
        reactedByMe: boolean;
        users: Array<{ id: string; firstName: string; lastName: string }>;
      }
    >();
    for (const r of reactions) {
      const cur = byEmoji.get(r.emoji) ?? {
        emoji: r.emoji,
        count: 0,
        reactedByMe: false,
        users: [],
      };
      cur.count += 1;
      cur.users.push(r.user);
      if (r.userId === userId) cur.reactedByMe = true;
      byEmoji.set(r.emoji, cur);
    }
    return Array.from(byEmoji.values());
  }

  private messagePayload(
    m: {
      id: string;
      conversationId: string;
      senderId: string;
      kind: string;
      body: string | null;
      documentId: string | null;
      document?: unknown;
      parentId: string | null;
      parent?: unknown;
      editedAt: Date | null;
      deletedAt: Date | null;
      createdAt: Date;
      sender?: unknown;
      reactions?: unknown[];
      reads?: { userId: string; readAt: Date }[];
    },
    userId: string,
  ) {
    const reactions =
      (m.reactions as Array<{
        userId: string;
        emoji: string;
        user: { id: string; firstName: string; lastName: string };
      }>) ?? [];
    const byEmoji = new Map<
      string,
      { emoji: string; count: number; reactedByMe: boolean }
    >();
    for (const r of reactions) {
      const cur = byEmoji.get(r.emoji) ?? {
        emoji: r.emoji,
        count: 0,
        reactedByMe: false,
      };
      cur.count += 1;
      if (r.userId === userId) cur.reactedByMe = true;
      byEmoji.set(r.emoji, cur);
    }
    const reads = m.reads ?? [];
    const parent = m.parent as
      | {
          id: string;
          kind: string;
          body: string | null;
          senderId: string;
          createdAt: Date;
          sender?: { id: string; firstName: string; lastName: string };
        }
      | undefined;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      kind: m.kind,
      body: m.deletedAt ? null : m.body,
      documentId: m.documentId,
      document: m.document
        ? {
            ...(m.document as Record<string, unknown>),
            sizeBytes:
              (
                m.document as { sizeBytes: bigint | null }
              ).sizeBytes?.toString() ?? null,
          }
        : null,
      parentId: m.parentId,
      parent: parent
        ? {
            id: parent.id,
            kind: parent.kind,
            body: parent.body,
            senderId: parent.senderId,
            createdAt: parent.createdAt,
            senderName: parent.sender
              ? `${parent.sender.firstName} ${parent.sender.lastName}`.trim()
              : 'Message',
          }
        : null,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
      sender: m.sender ?? null,
      reactions: Array.from(byEmoji.values()),
      readByMe: m.senderId === userId || reads.some((r) => r.userId === userId),
      readBy: reads,
    };
  }

  private async withUnread(conversation: ConversationListItem, userId: string) {
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        deletedAt: null,
        NOT: { reads: { some: { userId } } },
      },
    });
    const { messages, ...rest } = conversation;
    return {
      ...rest,
      lastMessage: messages[0] ?? null,
      unreadCount,
    };
  }
}
