import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../../common/constants/cookies';
import type { JwtPayload } from '../../common/types/authenticated-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { ChatService } from './chat.service';
import {
  socketCallAckSchema,
  socketCallIceSchema,
  socketCallRingSchema,
  socketCallSdpSchema,
  socketJoinSchema,
  socketSendMessageSchema,
  socketTypingSchema,
} from './dto/chat.dto';

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    tenantId: string;
  };
}

export interface ActiveCall {
  callId: string;
  tenantId: string;
  conversationId: string;
  kind: 'VOICE' | 'VIDEO';
  callerId: string;
  calleeId: string;
  startedAt: number;
}

const CALL_RING_TIMEOUT_MS = 45_000;

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  /**
   * Presence tracker: maps userId -> per-user socket registry. A user is
   * considered online while at least one verified socket is connected.
   */
  private readonly presence = new Map<
    string,
    { tenantId: string; sockets: Set<string> }
  >();

  /**
   * In-memory registry of active (ringing or connected) calls, keyed by callId.
   * Signals are relayed between the caller and callee by resolving the peer.
   */
  private readonly activeCalls = new Map<string, ActiveCall>();

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const payload = await this.authenticate(client);
      const tenantId = String(
        client.handshake.auth?.tenantId ??
          client.handshake.query?.tenantId ??
          '',
      );
      if (!tenantId) throw new Error('Missing tenantId');

      const membership = await this.prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: payload.sub } },
        select: {
          id: true,
          tenant: { select: { status: true } },
        },
      });
      if (!membership) throw new Error('Not a tenant member');
      if (membership.tenant.status !== 'ACTIVE') {
        throw new Error('Tenant is not active');
      }

      client.data.userId = payload.sub;
      client.data.tenantId = tenantId;
      await client.join(`user:${payload.sub}`);
      await client.join(`tenant:${tenantId}`);

      const wasOnline = this.markOnline(payload.sub, tenantId, client.id);
      if (!wasOnline) {
        this.emitToTenant(tenantId, 'chat:presence', {
          userId: payload.sub,
          status: 'online',
        });
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    if (!client.data.userId) return;
    const nowOffline = this.markOffline(client.data.userId, client.id);
    if (nowOffline) {
      this.emitToTenant(client.data.tenantId, 'chat:presence', {
        userId: client.data.userId,
        status: 'offline',
      });
    }
    this.endCallsForUser(client.data.userId, 'chat:call:ended_disconnect');
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToConversation(
    conversationId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server.to(`conv:${conversationId}`).emit(event, payload);
  }

  private emitToTenant(
    tenantId: string,
    event: string,
    payload: unknown,
  ): void {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  /** Returns the user ids currently online within a tenant. */
  getOnlineUserIds(tenantId: string): string[] {
    const ids: string[] = [];
    for (const [userId, entry] of this.presence) {
      if (entry.tenantId === tenantId && entry.sockets.size > 0) {
        ids.push(userId);
      }
    }
    return ids;
  }

  @SubscribeMessage('chat:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean } | { error: string }> {
    const parsed = socketJoinSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const dto = parsed.data;

    try {
      await this.chat.assertMember(dto.conversationId, client.data.userId);
    } catch {
      return { error: 'Forbidden' };
    }
    await client.join(`conv:${dto.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; message?: unknown } | { error: string }> {
    const parsed = socketSendMessageSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const dto = parsed.data;

    try {
      const message = await this.chat.sendMessage(
        client.data.tenantId,
        client.data.userId,
        dto.conversationId,
        {
          body: dto.body,
          documentIds: dto.documentIds,
          parentId: dto.parentId,
        },
      );
      this.emitToConversation(dto.conversationId, 'chat:message', message);
      await this.dispatchNotifications(
        client.data.tenantId,
        dto.conversationId,
        client.data.userId,
        message,
      );
      return { ok: true, message };
    } catch {
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('chat:typing')
  async typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean } | { error: string }> {
    const parsed = socketTypingSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const dto = parsed.data;
    try {
      await this.chat.assertMember(dto.conversationId, client.data.userId);
    } catch {
      return { error: 'Forbidden' };
    }
    this.emitToConversation(dto.conversationId, 'chat:typing', {
      conversationId: dto.conversationId,
      userId: client.data.userId,
      isTyping: dto.isTyping,
    });
    return { ok: true };
  }

  @SubscribeMessage('chat:read')
  async readConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; marked?: number } | { error: string }> {
    const parsed = socketJoinSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const dto = parsed.data;

    try {
      const result = await this.chat.markRead(
        client.data.tenantId,
        client.data.userId,
        dto.conversationId,
      );
      this.emitToConversation(dto.conversationId, 'chat:read', {
        conversationId: dto.conversationId,
        userId: client.data.userId,
        messageIds: result.messageIds,
      });
      return { ok: true, ...result };
    } catch {
      return { error: 'Failed to mark read' };
    }
  }

  /** Wires a newly created message into member notifications over the socket. */
  async dispatchNotifications(
    tenantId: string,
    conversationId: string,
    senderId: string,
    message: { id: string; body: string | null },
  ): Promise<void> {
    const { notifications } = await this.chat.notifyForMessage(
      tenantId,
      conversationId,
      senderId,
      message,
    );
    const online = new Set(this.getOnlineUserIds(tenantId));
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    for (const notification of notifications) {
      this.emitToUser(notification.userId, 'notification:new', notification);
      if (online.has(notification.userId)) continue;
      await this.push.sendToUser(notification.userId, {
        title: notification.title,
        body: notification.body ?? undefined,
        data: {
          type: notification.type,
          conversationId,
          messageId: message.id,
          senderId,
          url: `${frontendUrl}/chat`,
        },
      });
    }
  }

  @SubscribeMessage('chat:call:ring')
  async ring(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; callId?: string } | { error: string }> {
    const parsed = socketCallRingSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const dto = parsed.data;

    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: dto.conversationId,
          tenantId: client.data.tenantId,
          type: 'DIRECT',
          members: { some: { userId: client.data.userId } },
        },
        select: {
          id: true,
          members: {
            select: { userId: true },
            where: { userId: { not: client.data.userId } },
          },
        },
      });
      if (!conversation || conversation.members.length === 0) {
        return {
          error: 'This conversation cannot receive calls',
        };
      }

      const calleeId = conversation.members[0].userId;
      this.pruneStaleCalls();
      if (this.hasActiveCallFor(client.data.userId)) {
        return { error: 'You already have an active call' };
      }
      if (this.hasActiveCallFor(calleeId)) {
        return { error: 'The recipient is already on a call' };
      }
      if (!this.isOnline(calleeId, client.data.tenantId)) {
        return { error: 'The recipient is not online' };
      }

      const caller = await this.prisma.user.findUnique({
        where: { id: client.data.userId },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      });

      const callId = randomUUID();
      this.activeCalls.set(callId, {
        callId,
        tenantId: client.data.tenantId,
        conversationId: conversation.id,
        kind: dto.kind,
        callerId: client.data.userId,
        calleeId,
        startedAt: Date.now(),
      });

      this.emitToUser(calleeId, 'chat:call:ring', {
        callId,
        conversationId: conversation.id,
        kind: dto.kind,
        caller: caller ?? null,
      });
      return { ok: true, callId };
    } catch {
      return { error: 'Failed to start the call' };
    }
  }

  @SubscribeMessage('chat:call:accept')
  acceptCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallAckSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || call.calleeId !== client.data.userId) {
      return { error: 'No such call' };
    }
    this.emitToUser(call.callerId, 'chat:call:accepted', {
      callId: call.callId,
    });
    return { ok: true };
  }

  @SubscribeMessage('chat:call:decline')
  declineCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallAckSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || call.calleeId !== client.data.userId) {
      return { error: 'No such call' };
    }
    this.activeCalls.delete(call.callId);
    this.emitToUser(call.callerId, 'chat:call:declined', {
      callId: call.callId,
    });
    return { ok: true };
  }

  @SubscribeMessage('chat:call:cancel')
  cancelCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallAckSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || call.callerId !== client.data.userId) {
      return { error: 'No such call' };
    }
    this.activeCalls.delete(call.callId);
    this.emitToUser(call.calleeId, 'chat:call:cancelled', {
      callId: call.callId,
    });
    return { ok: true };
  }

  @SubscribeMessage('chat:call:offer')
  callOffer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallSdpSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || !this.isParticipant(call, client.data.userId)) {
      return { error: 'No such call' };
    }
    const peer = this.peerFor(call, client.data.userId);
    if (peer) {
      this.emitToUser(peer, 'chat:call:offer', {
        callId: call.callId,
        sdp: parsed.data.sdp,
      });
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:call:answer')
  callAnswer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallSdpSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || !this.isParticipant(call, client.data.userId)) {
      return { error: 'No such call' };
    }
    const peer = this.peerFor(call, client.data.userId);
    if (peer) {
      this.emitToUser(peer, 'chat:call:answer', {
        callId: call.callId,
        sdp: parsed.data.sdp,
      });
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:call:ice')
  callIce(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallIceSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || !this.isParticipant(call, client.data.userId)) {
      return { error: 'No such call' };
    }
    const peer = this.peerFor(call, client.data.userId);
    if (peer) {
      this.emitToUser(peer, 'chat:call:ice', {
        callId: call.callId,
        candidate: parsed.data.candidate ?? null,
      });
    }
    return { ok: true };
  }

  @SubscribeMessage('chat:call:end')
  endCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() raw: unknown,
  ): { ok: boolean } | { error: string } {
    const parsed = socketCallAckSchema.safeParse(raw);
    if (!parsed.success) return { error: 'Invalid payload' };
    const call = this.activeCalls.get(parsed.data.callId);
    if (!call || !this.isParticipant(call, client.data.userId)) {
      return { error: 'No such call' };
    }
    this.activeCalls.delete(call.callId);
    const peer = this.peerFor(call, client.data.userId);
    if (peer) {
      this.emitToUser(peer, 'chat:call:ended', { callId: call.callId });
    }
    return { ok: true };
  }

  private isParticipant(call: ActiveCall, userId: string): boolean {
    return call.callerId === userId || call.calleeId === userId;
  }

  private peerFor(call: ActiveCall, userId: string): string | null {
    if (call.callerId === userId) return call.calleeId;
    if (call.calleeId === userId) return call.callerId;
    return null;
  }

  private hasActiveCallFor(userId: string): boolean {
    for (const call of this.activeCalls.values()) {
      if (this.isParticipant(call, userId)) return true;
    }
    return false;
  }

  private isOnline(userId: string, tenantId: string): boolean {
    const entry = this.presence.get(userId);
    return Boolean(
      entry && entry.tenantId === tenantId && entry.sockets.size > 0,
    );
  }

  /** Drops stale ringing calls so a timed-out ring does not linger. */
  private pruneStaleCalls(): void {
    const now = Date.now();
    for (const [callId, call] of this.activeCalls) {
      if (now - call.startedAt > CALL_RING_TIMEOUT_MS) {
        this.activeCalls.delete(callId);
      }
    }
  }

  /** Ends every active call a user is part of when one of their sockets drops. */
  private endCallsForUser(userId: string, event: string): void {
    const removed: ActiveCall[] = [];
    for (const call of this.activeCalls.values()) {
      if (this.isParticipant(call, userId)) {
        if (removed.length === 0) this.activeCalls.delete(call.callId);
        removed.push(call);
      }
    }
    if (removed.length === 0) return;
    const peers = new Set(
      removed
        .map((call) => this.peerFor(call, userId))
        .filter(Boolean) as string[],
    );
    for (const peer of peers) {
      this.emitToUser(peer, event, { callId: removed[0].callId });
    }
  }

  private markOnline(userId: string, tenantId: string, socketId: string) {
    const entry = this.presence.get(userId);
    if (entry) {
      entry.tenantId = tenantId;
      entry.sockets.add(socketId);
      return true;
    }
    this.presence.set(userId, {
      tenantId,
      sockets: new Set([socketId]),
    });
    return false;
  }

  private markOffline(userId: string, socketId: string) {
    const entry = this.presence.get(userId);
    if (!entry) return false;
    entry.sockets.delete(socketId);
    if (entry.sockets.size > 0) return false;
    this.presence.delete(userId);
    return true;
  }

  private async authenticate(client: AuthedSocket): Promise<JwtPayload> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      this.tokenFromCookie(client.handshake.headers.cookie);
    if (!token) throw new Error('Missing token');

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    return payload;
  }

  private tokenFromCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === ACCESS_TOKEN_COOKIE) return rest.join('=');
    }
    return undefined;
  }
}
