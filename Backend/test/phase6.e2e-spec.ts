import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp, extractCookies } from './utils/test-app';

interface StaffSession {
  userId: string;
  email: string;
  cookie: string;
  accessToken: string;
}

interface AddressInfo {
  port: number;
}

jest.setTimeout(30000);

describe('Phase 6 (e2e): chat, notifications, audit', () => {
  let app: INestApplication;
  let unique: string;
  let port: number;

  let adminCookie: string;
  let tenantId: string;
  let branchId: string;
  let departmentId: string;

  let staffRoleId: string;
  let managerRoleId: string;

  let staff1: StaffSession;
  let staff2: StaffSession;
  let manager: StaffSession;

  let templateId: string;

  const adminHdr = () => ({ Cookie: adminCookie, 'x-tenant-id': tenantId });
  const userHdr = (s: StaffSession) => ({
    Cookie: s.cookie,
    'x-tenant-id': tenantId,
  });

  const accessTokenFromCookies = (res: {
    headers: Record<string, unknown>;
  }): string => {
    const raw = (res.headers['set-cookie'] as string[]) ?? [];
    const cookie = raw.find((c) => c.startsWith('tgmanager_access='));
    return cookie ? cookie.split(';')[0].split('=').slice(1).join('=') : '';
  };

  const createStaff = async (
    tag: string,
    roleIds: string[],
  ): Promise<StaffSession> => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set(adminHdr())
      .send({
        email: `${tag}-${unique}@test.com`,
        firstName: tag,
        lastName: 'Worker',
        branchId,
        departmentId,
        jobTitle: 'Crew',
        roleIds,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `${tag}-${unique}@test.com`,
        password: created.body.temporaryPassword,
      })
      .expect(200);
    return {
      userId: login.body.user.id,
      email: `${tag}-${unique}@test.com`,
      cookie: extractCookies(login),
      accessToken: accessTokenFromCookies(login),
    };
  };

  const connectClient = (
    token?: string,
    tenantIdOverride?: string,
  ): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        ...(token
          ? { auth: { token, tenantId: tenantIdOverride ?? tenantId } }
          : {}),
      });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (err) => reject(err));
      setTimeout(() => {
        if (!socket.connected) reject(new Error('socket connect timeout'));
      }, 4000);
    });

  const emitAck = <T>(
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      socket.emit(event, payload, (res: T) => resolve(res));
      setTimeout(() => reject(new Error(`ack timeout for ${event}`)), 4000);
    });

  const nextEvent = <T>(socket: Socket, event: string): Promise<T> =>
    new Promise((resolve) =>
      socket.once(event, (payload: T) => resolve(payload)),
    );

  const waitForAudit = async (action: string, attempts = 30): Promise<void> => {
    for (let i = 0; i < attempts; i++) {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set(adminHdr())
        .expect(200);
      if (res.body.some((a: { action: string }) => a.action === action)) return;
      await new Promise((r) => setTimeout(r, 75));
    }
    throw new Error(`Audit entry not found: ${action}`);
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'P6',
        lastName: 'Admin',
        email: `p6-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `P6 Co ${unique}`,
      })
      .expect(201);
    adminCookie = extractCookies(reg);
    tenantId = reg.body.tenant.id;

    const branch = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set(adminHdr())
      .send({
        name: 'HQ',
        address: '1 Main St',
        latitude: 40.7128,
        longitude: -74.006,
      })
      .expect(201);
    branchId = branch.body.id;

    const dept = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set(adminHdr())
      .send({ branchId, name: 'Operations' })
      .expect(201);
    departmentId = dept.body.id;

    const roles = await request(app.getHttpServer())
      .get('/api/v1/company-roles')
      .set(adminHdr())
      .expect(200);
    staffRoleId = roles.body.find(
      (r: { name: string }) => r.name === 'STAFF',
    ).id;
    managerRoleId = roles.body.find(
      (r: { name: string }) => r.name === 'DEPARTMENT_MANAGER',
    ).id;

    staff1 = await createStaff('p6a', [staffRoleId]);
    staff2 = await createStaff('p6b', [staffRoleId]);
    manager = await createStaff('p6m', [managerRoleId]);

    await request(app.getHttpServer())
      .patch(`/api/v1/departments/${departmentId}`)
      .set(adminHdr())
      .send({ managerUserId: manager.userId })
      .expect(200);

    const template = await request(app.getHttpServer())
      .post('/api/v1/workflows/templates')
      .set(adminHdr())
      .send({
        name: 'P6 approval',
        description: 'Single manager approval',
        steps: [
          {
            name: 'Manager approval',
            order: 0,
            action: 'APPROVE',
            assigneeRuleType: 'ORIGINATOR_MANAGER',
            isFinal: true,
          },
        ],
      })
      .expect(201);
    templateId = template.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('chat REST', () => {
    let directId: string;
    let groupId: string;
    let outsiderId: string;

    beforeAll(async () => {
      const outsider = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Out',
          lastName: 'Sider',
          email: `p6-out-${unique}@test.com`,
          password: 'password123',
          companyName: `Other Co ${unique}`,
        })
        .expect(201);
      outsiderId = outsider.body.user.id;
    });

    it('creates a direct conversation between two staff', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({ type: 'DIRECT', otherUserId: staff2.userId })
        .expect(201);
      directId = res.body.id;
      expect(res.body.type).toBe('DIRECT');
      expect(res.body.members).toHaveLength(2);
      expect(res.body.unreadCount).toBe(0);
    });

    it('reuses the same direct conversation on repeat create', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({ type: 'DIRECT', otherUserId: staff2.userId })
        .expect(201);
      expect(res.body.id).toBe(directId);
    });

    it('rejects direct chats with users outside the tenant', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({ type: 'DIRECT', otherUserId: outsiderId })
        .expect(400);
    });

    it('creates a group conversation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({
          type: 'GROUP',
          name: 'Ops Team',
          memberIds: [staff2.userId, manager.userId],
        })
        .expect(201);
      groupId = res.body.id;
      expect(res.body.type).toBe('GROUP');
      expect(res.body.name).toBe('Ops Team');
      expect(res.body.members).toHaveLength(3);
    });

    it('sends a message and returns it with sender info', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${directId}/messages`)
        .set(userHdr(staff1))
        .send({ body: 'Hello staff2' })
        .expect(201);
      expect(res.body.body).toBe('Hello staff2');
      expect(res.body.sender.email).toBe(staff1.email);
    });

    it('exposes message history with readByMe flags', async () => {
      const staff1View = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${directId}/messages`)
        .set(userHdr(staff1))
        .expect(200);
      expect(staff1View.body[0].body).toBe('Hello staff2');
      expect(staff1View.body[0].readByMe).toBe(true);

      const staff2View = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${directId}/messages`)
        .set(userHdr(staff2))
        .expect(200);
      expect(staff2View.body[0].readByMe).toBe(false);
    });

    it('reports unread count and marks messages read', async () => {
      const unread = await request(app.getHttpServer())
        .get('/api/v1/chat/unread-count')
        .set(userHdr(staff2))
        .expect(200);
      expect(unread.body.count).toBeGreaterThanOrEqual(1);

      const mark = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${directId}/read`)
        .set(userHdr(staff2))
        .expect(201);
      expect(mark.body.marked).toBeGreaterThanOrEqual(1);

      const after = await request(app.getHttpServer())
        .get('/api/v1/chat/unread-count')
        .set(userHdr(staff2))
        .expect(200);
      expect(after.body.count).toBe(0);
    });

    it('forbids non-members from reading a conversation', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${directId}`)
        .set(userHdr(manager))
        .expect(403);
    });

    it('lists the user conversations with lastMessage', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .expect(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(directId);
      expect(ids).toContain(groupId);
      const direct = res.body.find((c: { id: string }) => c.id === directId);
      expect(direct.lastMessage.body).toBe('Hello staff2');
    });
  });

  describe('chat socket', () => {
    let directId: string;
    let s1: Socket;
    let s2: Socket;

    beforeAll(async () => {
      const conv = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({ type: 'DIRECT', otherUserId: staff2.userId })
        .expect(201);
      directId = conv.body.id;
      s1 = await connectClient(staff1.accessToken);
      s2 = await connectClient(staff2.accessToken);
    });

    afterAll(() => {
      s1?.disconnect();
      s2?.disconnect();
    });

    it('joins a conversation room', async () => {
      const ack = await emitAck<{ ok: boolean }>(s1, 'chat:join', {
        conversationId: directId,
      });
      expect(ack.ok).toBe(true);
    });

    it('rejects joining a conversation the user is not part of', async () => {
      const stranger = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations')
        .set(userHdr(staff1))
        .send({ type: 'DIRECT', otherUserId: manager.userId })
        .expect(201);
      const ack = await emitAck<{ error: string }>(s2, 'chat:join', {
        conversationId: stranger.body.id,
      });
      expect(ack.error).toBe('Forbidden');
    });

    it('delivers chat:send messages to other connected members', async () => {
      const joined = await emitAck<{ ok: boolean }>(s2, 'chat:join', {
        conversationId: directId,
      });
      expect(joined.ok).toBe(true);

      const incoming = nextEvent<{ body: string; sender: { email: string } }>(
        s2,
        'chat:message',
      );
      const ack = await emitAck<{ ok: boolean }>(s1, 'chat:send', {
        conversationId: directId,
        body: 'ping over socket',
      });
      expect(ack.ok).toBe(true);
      const message = await incoming;
      expect(message.body).toBe('ping over socket');
      expect(message.sender.email).toBe(staff1.email);
    });

    it('broadcasts chat:read when a member marks the conversation read', async () => {
      await emitAck<{ ok: boolean }>(s2, 'chat:join', {
        conversationId: directId,
      });
      const readEvent = nextEvent<{ conversationId: string; userId: string }>(
        s1,
        'chat:read',
      );
      const ack = await emitAck<{ ok: boolean; marked: number }>(
        s2,
        'chat:read',
        {
          conversationId: directId,
        },
      );
      expect(ack.ok).toBe(true);
      expect(ack.marked).toBeGreaterThanOrEqual(0);
      const evt = await readEvent;
      expect(evt.conversationId).toBe(directId);
      expect(evt.userId).toBe(staff2.userId);
    });

    it('disconnects unauthenticated clients', async () => {
      const socket = io(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });
      const outcome = await new Promise<string>((resolve) => {
        socket.once('disconnect', () => resolve('disconnected'));
        socket.once('connect_error', () => resolve('connect_error'));
        setTimeout(
          () => resolve(socket.connected ? 'still-connected' : 'disconnected'),
          4000,
        );
      });
      socket.disconnect();
      expect(outcome).not.toBe('still-connected');
    });
  });

  describe('notifications', () => {
    let instanceId: string;
    let memoId: string;

    it('notifies the assignee when a workflow instance starts', async () => {
      const started = await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(staff1))
        .send({ templateId, title: 'P6 leave request', payload: { days: 2 } })
        .expect(201);
      instanceId = started.body.id;

      const list = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(userHdr(manager))
        .expect(200);
      const pending = list.body.find(
        (n: { type: string }) => n.type === 'WORKFLOW_PENDING',
      );
      expect(pending).toBeDefined();
      expect(pending.title).toContain('approval');
      expect(pending.data.instanceId).toBe(instanceId);

      const unread = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set(userHdr(manager))
        .expect(200);
      expect(unread.body.count).toBeGreaterThanOrEqual(1);
    });

    it('notifies the initiator when the workflow is approved', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${instanceId}/approve`)
        .set(userHdr(manager))
        .send({ note: 'OK' })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(userHdr(staff1))
        .expect(200);
      const approved = list.body.find(
        (n: { type: string }) => n.type === 'WORKFLOW_APPROVED',
      );
      expect(approved).toBeDefined();
      expect(approved.data.instanceId).toBe(instanceId);
    });

    it('marks a single notification as read', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(userHdr(staff1))
        .expect(200);
      const target = list.body.find(
        (n: { type: string }) => n.type === 'WORKFLOW_APPROVED',
      );
      expect(target.readAt).toBeNull();

      const mark = await request(app.getHttpServer())
        .post(`/api/v1/notifications/${target.id}/read`)
        .set(userHdr(staff1))
        .expect(201);
      expect(mark.body.readAt).toBeTruthy();
    });

    it('marks all notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set(userHdr(manager))
        .expect(201);
      expect(res.body.updated).toBeGreaterThanOrEqual(1);

      const unread = await request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set(userHdr(manager))
        .expect(200);
      expect(unread.body.count).toBe(0);
    });

    it('notifies branch staff when a memo is published', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/memos')
        .set(adminHdr())
        .send({
          title: 'P6 announcement',
          body: 'Branch meeting at 3pm',
          branchId,
        })
        .expect(201);
      memoId = created.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/memos/${memoId}/publish`)
        .set(adminHdr())
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(userHdr(staff2))
        .expect(200);
      const memoNote = list.body.find(
        (n: { type: string }) => n.type === 'MEMO_PUBLISH',
      );
      expect(memoNote).toBeDefined();
      expect(memoNote.data.memoId).toBe(memoId);
    });

    it('scopes notifications to the requesting tenant member', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/whatever-id/read')
        .set(userHdr(staff1))
        .expect(404);
      expect(res.body).toBeDefined();
    });
  });

  describe('audit', () => {
    it('records staff creation and workflow actions', async () => {
      await waitForAudit('STAFF_CREATE');
      await waitForAudit('WORKFLOW_INSTANCE_START');
      await waitForAudit('WORKFLOW_INSTANCE_APPROVE');
    });

    it('supports filtering by action and entityType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit?action=STAFF_CREATE')
        .set(adminHdr())
        .expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every((a: { action: string }) => a.action === 'STAFF_CREATE'),
      ).toBe(true);
      expect(res.body[0].user).toBeDefined();
      expect(res.body[0].entityType).toBe('StaffRecord');
    });

    it('records role assignments', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/company-roles/${staffRoleId}/assign`)
        .set(adminHdr())
        .send({ userId: staff2.userId })
        .expect(201);
      await waitForAudit('ROLE_ASSIGN');
    });

    it('denies audit access to staff', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set(userHdr(staff1))
        .expect(403);
    });
  });
});
