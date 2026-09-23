import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { PushService } from '../push/push.service';
import {
  ChatGateway,
  type ActiveCall,
  type AuthedSocket,
} from './chat.gateway';

interface GatewayTestable {
  server: { to: jest.Mock };
  presence: Map<string, { tenantId: string; sockets: Set<string> }>;
  activeCalls: Map<string, ActiveCall>;
  ring: (
    client: AuthedSocket,
    dto: { conversationId: string; kind: 'VOICE' | 'VIDEO' },
  ) => Promise<{ ok: boolean; callId?: string } | { error: string }>;
  acceptCall: (
    client: AuthedSocket,
    dto: { callId: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  declineCall: (
    client: AuthedSocket,
    dto: { callId: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  cancelCall: (
    client: AuthedSocket,
    dto: { callId: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  callOffer: (
    client: AuthedSocket,
    dto: { callId: string; sdp: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  callAnswer: (
    client: AuthedSocket,
    dto: { callId: string; sdp: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  callIce: (
    client: AuthedSocket,
    dto: { callId: string; candidate: string | null },
  ) => Promise<{ ok: boolean } | { error: string }>;
  endCall: (
    client: AuthedSocket,
    dto: { callId: string },
  ) => Promise<{ ok: boolean } | { error: string }>;
  handleDisconnect: (client: AuthedSocket) => void;
}

const USER_A = {
  id: 'u-a',
  firstName: 'Alice',
  lastName: 'Ade',
  avatarUrl: null,
};
const USER_B = {
  id: 'u-b',
  firstName: 'Bob',
  lastName: 'Bello',
  avatarUrl: null,
};

describe('ChatGateway call signaling', () => {
  let gateway: GatewayTestable;
  let prisma: {
    conversation: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  const emit = jest.fn();
  const to = jest.fn();

  const client = (userId: string, socketId: string): AuthedSocket =>
    ({
      id: socketId,
      handshake: {},
      data: { userId, tenantId: 't1' },
      join: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as AuthedSocket;

  const online = (userId: string, sockets: string[] = ['s']) => {
    gateway.presence.set(userId, { tenantId: 't1', sockets: new Set(sockets) });
  };

  beforeEach(async () => {
    emit.mockReset();
    to.mockReset();
    to.mockReturnValue({ emit });

    prisma = {
      conversation: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ChatService, useValue: {} },
        { provide: PushService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    gateway = moduleRef.get(ChatGateway);
    gateway.server = { to };
  });

  describe('chat:call:ring', () => {
    it('registers an active call and rings the online callee', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);

      const res = await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      });

      expect(res).toMatchObject({ ok: true });
      const callId = (res as { callId: string }).callId;
      expect(callId).toBeTruthy();
      expect(to).toHaveBeenCalledWith(`user:${USER_B.id}`);
      expect(emit).toHaveBeenCalledWith(
        'chat:call:ring',
        expect.objectContaining({
          callId,
          conversationId: 'c1',
          kind: 'VOICE',
          caller: USER_A,
        }),
      );
      expect(gateway.activeCalls.get(callId)).toMatchObject({
        callerId: USER_A.id,
        calleeId: USER_B.id,
      });
    });

    it('rejects when the callee is offline', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);

      const res = await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VIDEO',
      });

      expect(res).toEqual({ error: 'The recipient is not online' });
      expect(gateway.activeCalls.size).toBe(0);
    });

    it('rejects when the conversation does not exist or is not a direct conversation', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue(null);

      const res = await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'nope',
        kind: 'VOICE',
      });

      expect(res).toEqual({ error: 'This conversation cannot receive calls' });
    });

    it('rejects a second call from the same caller', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);

      await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      });
      const res = await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      });

      expect(res).toEqual({ error: 'You already have an active call' });
    });
  });

  describe('chat:call:accept', () => {
    it('relays acceptance to the caller and rejects non-callees', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      })) as { callId: string };

      const ok = await gateway.acceptCall(client(USER_B.id, 's-b'), {
        callId: ring.callId,
      });
      expect(ok).toEqual({ ok: true });
      expect(to).toHaveBeenCalledWith(`user:${USER_A.id}`);
      expect(emit).toHaveBeenLastCalledWith('chat:call:accepted', {
        callId: ring.callId,
      });

      const denied = await gateway.acceptCall(client(USER_A.id, 's-a'), {
        callId: ring.callId,
      });
      expect(denied).toEqual({ error: 'No such call' });
    });
  });

  describe('chat:call:decline', () => {
    it('notifies the caller and tears the call down', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      })) as { callId: string };

      const res = await gateway.declineCall(client(USER_B.id, 's-b'), {
        callId: ring.callId,
      });
      expect(res).toEqual({ ok: true });
      expect(emit).toHaveBeenLastCalledWith('chat:call:declined', {
        callId: ring.callId,
      });
      expect(gateway.activeCalls.size).toBe(0);

      const denied = await gateway.acceptCall(client(USER_B.id, 's-b'), {
        callId: ring.callId,
      });
      expect(denied).toEqual({ error: 'No such call' });
    });
  });

  describe('chat:call:cancel', () => {
    it('notifies the callee and tears the call down', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      })) as { callId: string };

      const res = await gateway.cancelCall(client(USER_A.id, 's-a'), {
        callId: ring.callId,
      });
      expect(res).toEqual({ ok: true });
      expect(emit).toHaveBeenLastCalledWith('chat:call:cancelled', {
        callId: ring.callId,
      });
      expect(gateway.activeCalls.size).toBe(0);
    });
  });

  describe('SDP and ICE relay', () => {
    const startCall = async (): Promise<string> => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VIDEO',
      })) as { callId: string };
      return ring.callId;
    };

    it('relays an offer from the caller to the callee', async () => {
      const callId = await startCall();
      const res = await gateway.callOffer(client(USER_A.id, 's-a'), {
        callId,
        sdp: 'v=0 offer',
      });
      expect(res).toEqual({ ok: true });
      expect(to).toHaveBeenCalledWith(`user:${USER_B.id}`);
      expect(emit).toHaveBeenLastCalledWith('chat:call:offer', {
        callId,
        sdp: 'v=0 offer',
      });
    });

    it('relays an answer from the callee to the caller', async () => {
      const callId = await startCall();
      const res = await gateway.callAnswer(client(USER_B.id, 's-b'), {
        callId,
        sdp: 'v=0 answer',
      });
      expect(res).toEqual({ ok: true });
      expect(emit).toHaveBeenLastCalledWith('chat:call:answer', {
        callId,
        sdp: 'v=0 answer',
      });
    });

    it('relays ICE candidates (including null) between the peers', async () => {
      const callId = await startCall();
      await gateway.callIce(client(USER_A.id, 's-a'), {
        callId,
        candidate: '{"candidate":"c","sdpMid":"0"}',
      });
      expect(emit).toHaveBeenLastCalledWith('chat:call:ice', {
        callId,
        candidate: '{"candidate":"c","sdpMid":"0"}',
      });

      await gateway.callIce(client(USER_B.id, 's-b'), {
        callId,
        candidate: null,
      });
      expect(emit).toHaveBeenLastCalledWith('chat:call:ice', {
        callId,
        candidate: null,
      });
    });

    it('rejects signaling for unknown calls or non-participants', async () => {
      const callId = await startCall();
      const outsider = await gateway.callOffer(client('u-c', 's-c'), {
        callId,
        sdp: 'v=0',
      });
      expect(outsider).toEqual({ error: 'No such call' });

      const unknown = await gateway.callOffer(client(USER_A.id, 's-a'), {
        callId: 'ghost',
        sdp: 'v=0',
      });
      expect(unknown).toEqual({ error: 'No such call' });
    });
  });

  describe('chat:call:end and disconnect cleanup', () => {
    it('ends an active call and notifies the peer', async () => {
      online(USER_B.id);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      })) as { callId: string };

      const res = await gateway.endCall(client(USER_B.id, 's-b'), {
        callId: ring.callId,
      });
      expect(res).toEqual({ ok: true });
      expect(emit).toHaveBeenLastCalledWith('chat:call:ended', {
        callId: ring.callId,
      });
      expect(gateway.activeCalls.size).toBe(0);

      const late = await gateway.callOffer(client(USER_A.id, 's-a'), {
        callId: ring.callId,
        sdp: 'v=0',
      });
      expect(late).toEqual({ error: 'No such call' });
    });

    it('ends calls involving a user whose socket disconnects', async () => {
      online(USER_A.id, ['s-a']);
      online(USER_B.id, ['s-b']);
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        members: [{ userId: USER_B.id }],
      });
      prisma.user.findUnique.mockResolvedValue(USER_A);
      const ring = (await gateway.ring(client(USER_A.id, 's-a'), {
        conversationId: 'c1',
        kind: 'VOICE',
      })) as { callId: string };

      gateway.handleDisconnect(client(USER_B.id, 's-b'));

      expect(gateway.activeCalls.size).toBe(0);
      expect(emit).toHaveBeenCalledWith('chat:call:ended_disconnect', {
        callId: ring.callId,
      });
    });
  });
});
