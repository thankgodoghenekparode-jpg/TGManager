import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, extractCookies } from './utils/test-app';

interface Session {
  cookie: string;
  userId: string;
}

jest.setTimeout(30000);

describe('Phase 7 (e2e): platform administration & plan limits', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let unique: string;

  let admin: Session;
  let tenantId: string;

  let superAdmin: Session;
  let support: Session;

  let microPlanId: string;
  let startupPlanId: string;

  const hdr = (cookie: string) => ({
    Cookie: cookie,
    'x-tenant-id': tenantId,
  });

  const registerPlatformUser = async (
    tag: string,
    role: UserRole,
  ): Promise<Session> => {
    const email = `p7-${tag}-${unique}@test.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 10),
        firstName: tag,
        lastName: 'Admin',
        role,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { cookie: extractCookies(login), userId: user.id };
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await app.listen(0);
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Tenant',
        lastName: 'Admin',
        email: `p7-tenant-${unique}@test.com`,
        password: 'password123',
        companyName: `P7 Co ${unique}`,
      })
      .expect(201);
    admin = { cookie: extractCookies(reg), userId: reg.body.user.id };
    tenantId = reg.body.tenant.id;

    await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set(hdr(admin.cookie))
      .send({
        name: 'HQ',
        address: '1 Main St',
        latitude: 40.7128,
        longitude: -74.006,
      })
      .expect(201);

    superAdmin = await registerPlatformUser('super', UserRole.SUPER_ADMIN);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('access control', () => {
    it('blocks a regular USER from platform endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/plans')
        .set('Cookie', admin.cookie)
        .expect(403);
      expect(res.body.message).toBe('Insufficient platform role');
    });

    it('lets SUPER_ADMIN list plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/plans')
        .set('Cookie', superAdmin.cookie)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('plan management', () => {
    it('creates a plan with limits', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/platform/plans')
        .set('Cookie', superAdmin.cookie)
        .send({
          name: 'Micro',
          code: `micro-${unique}`,
          priceCents: 0,
          maxBranches: 1,
          maxStaff: 5,
          maxDocuments: 10,
          maxStorageBytes: 1_048_576,
          maxChatMessages: 50,
        })
        .expect(201);
      microPlanId = res.body.id;
      expect(res.body.code).toBe(`micro-${unique}`);
      expect(res.body.maxBranches).toBe(1);
    });

    it('rejects a duplicate plan code with 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/platform/plans')
        .set('Cookie', superAdmin.cookie)
        .send({
          name: 'Micro Dupe',
          code: `micro-${unique}`,
          priceCents: 0,
        })
        .expect(409);
      expect(res.body.message).toMatch(/already exists/);
    });

    it('updates a plan limit', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/platform/plans/${microPlanId}`)
        .set('Cookie', superAdmin.cookie)
        .send({ maxStaff: 10, name: 'Micro Plus' })
        .expect(200);
      expect(res.body.maxStaff).toBe(10);
      expect(res.body.name).toBe('Micro Plus');
    });

    it('creates a PLATFORM_SUPPORT user', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/platform/users')
        .set('Cookie', superAdmin.cookie)
        .send({
          email: `p7-support-${unique}@test.com`,
          firstName: 'Sup',
          lastName: 'Port',
          role: 'PLATFORM_SUPPORT',
        })
        .expect(201);
      expect(created.body.tempPassword).toBeTruthy();
      expect(created.body.user.role).toBe('PLATFORM_SUPPORT');

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: `p7-support-${unique}@test.com`,
          password: created.body.tempPassword,
        })
        .expect(200);
      support = {
        cookie: extractCookies(login),
        userId: login.body.user.id,
      };
    });

    it('blocks PLATFORM_SUPPORT from creating plans', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/platform/plans')
        .set('Cookie', support.cookie)
        .send({ name: 'Nope', code: 'nope' })
        .expect(403);
    });
  });

  describe('tenant administration', () => {
    it('lists tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/platform/tenants')
        .set('Cookie', superAdmin.cookie)
        .expect(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(
        res.body.items.some((t: { id: string }) => t.id === tenantId),
      ).toBe(true);
    });

    it('gets tenant detail with counts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/platform/tenants/${tenantId}`)
        .set('Cookie', superAdmin.cookie)
        .expect(200);
      expect(res.body._count.branches).toBe(1);
    });

    it('gets tenant usage', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/platform/tenants/${tenantId}/usage`)
        .set('Cookie', superAdmin.cookie)
        .expect(200);
      expect(res.body.usage.branches).toBe(1);
      expect(typeof res.body.usage.storageBytes).toBe('string');
    });

    it('overrides the onboarding status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/platform/tenants/${tenantId}`)
        .set('Cookie', superAdmin.cookie)
        .send({ onboardingStatus: 'COMPLETED' })
        .expect(200);
      expect(res.body.onboardingStatus).toBe('COMPLETED');
    });

    it('suspends a tenant and blocks its members', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/platform/tenants/${tenantId}/suspend`)
        .set('Cookie', superAdmin.cookie)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr(admin.cookie))
        .expect(403);
      expect(res.body.message).toMatch(/suspended/i);
    });

    it('reactivates the tenant and restores access', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/platform/tenants/${tenantId}/activate`)
        .set('Cookie', superAdmin.cookie)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr(admin.cookie))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('blocks PLATFORM_SUPPORT from suspending tenants', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/platform/tenants/${tenantId}/suspend`)
        .set('Cookie', support.cookie)
        .expect(403);
    });
  });

  describe('plan-limit enforcement', () => {
    const branchPayload = {
      name: 'Branch 2',
      address: '2 Main St',
      latitude: 41.7128,
      longitude: -75.006,
    };

    it('switches the tenant to a 1-branch plan', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/platform/tenants/${tenantId}`)
        .set('Cookie', superAdmin.cookie)
        .send({ planId: microPlanId })
        .expect(200);
      expect(res.body.planId).toBe(microPlanId);
    });

    it('blocks creating a branch over the plan limit with an upgrade hint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set(hdr(admin.cookie))
        .send(branchPayload)
        .expect(403);
      expect(res.body.message).toMatch(/up to 1 branches/);
      expect(res.body.message).toMatch(/Upgrade your plan/);
    });

    it('cannot deactivate a plan while tenants are on it', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/platform/plans/${microPlanId}`)
        .set('Cookie', superAdmin.cookie)
        .expect(400);
      expect(res.body.message).toMatch(/tenant/);
    });

    it('upgrades the tenant and branch creation succeeds', async () => {
      const plan = await request(app.getHttpServer())
        .post('/api/v1/platform/plans')
        .set('Cookie', superAdmin.cookie)
        .send({
          name: 'Startup',
          code: `startup-${unique}`,
          priceCents: 4900,
          maxBranches: 5,
          maxStaff: 100,
        })
        .expect(201);
      startupPlanId = plan.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/platform/tenants/${tenantId}`)
        .set('Cookie', superAdmin.cookie)
        .send({ planId: startupPlanId })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set(hdr(admin.cookie))
        .send(branchPayload)
        .expect(201);
    });

    it('deactivates the now-unused micro plan', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/platform/plans/${microPlanId}`)
        .set('Cookie', superAdmin.cookie)
        .expect(200);
      expect(res.body.ok).toBe(true);
    });

    it('blocks creating a second staff member over a staff cap', async () => {
      const capped = await request(app.getHttpServer())
        .post('/api/v1/platform/plans')
        .set('Cookie', superAdmin.cookie)
        .send({
          name: 'Tiny',
          code: `tiny-${unique}`,
          priceCents: 0,
          maxStaff: 1,
        })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/platform/tenants/${tenantId}`)
        .set('Cookie', superAdmin.cookie)
        .send({ planId: capped.body.id })
        .expect(200);

      const branchId = (
        await request(app.getHttpServer())
          .get('/api/v1/branches')
          .set(hdr(admin.cookie))
          .expect(200)
      ).body[0].id;

      await request(app.getHttpServer())
        .post('/api/v1/staff')
        .set(hdr(admin.cookie))
        .send({
          email: `p7-capped-${unique}@test.com`,
          firstName: 'Capped',
          lastName: 'Worker',
          branchId,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/staff')
        .set(hdr(admin.cookie))
        .send({
          email: `p7-capped2-${unique}@test.com`,
          firstName: 'Capped',
          lastName: 'Two',
          branchId,
        })
        .expect(403);
      expect(res.body.message).toMatch(/up to 1 staff members/);
      expect(res.body.message).toMatch(/Upgrade your plan/);
    });
  });
});
