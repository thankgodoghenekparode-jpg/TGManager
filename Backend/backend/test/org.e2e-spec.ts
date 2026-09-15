import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

describe('Org structure (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let tenantId: string;
  let adminUserId: string;
  let unique: string;

  const hdr = () => ({ Cookie: cookie, 'x-tenant-id': tenantId });

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Org',
        lastName: 'Admin',
        email: `org-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `Org Co ${unique}`,
      })
      .expect(201);
    cookie = extractCookies(reg);
    tenantId = reg.body.tenant.id;
    adminUserId = reg.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('branches', () => {
    it('creates a branch and advances onboarding', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set(hdr())
        .send({
          name: 'Downtown',
          address: '1 Main St',
          latitude: 40.7128,
          longitude: -74.006,
          radiusMeters: 150,
          phoneNumber: '+1-555-0100',
          openingTime: '09:00',
          closingTime: '18:00',
          workingDays: [1, 2, 3, 4, 5],
          timezone: 'America/New_York',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Downtown',
        radiusMeters: 150,
        openingTime: '09:00',
        timezone: 'America/New_York',
      });

      const me = await request(app.getHttpServer())
        .get('/api/v1/tenants/current')
        .set(hdr())
        .expect(200);
      expect(me.body.onboardingStatus).toBe('BRANCH_CREATED');
    });

    it('enforces the free plan branch limit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set(hdr())
        .send({
          name: 'Second Branch',
          address: '2 Other St',
          latitude: 40.0,
          longitude: -74.0,
        })
        .expect(403);
      expect(res.body.message).toContain('allows up to 1 branches');
    });

    it('lists and updates branches', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr())
        .expect(200);
      expect(list.body).toHaveLength(1);
      const id = list.body[0].id;

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${id}`)
        .set(hdr())
        .send({ phoneNumber: '+1-555-0199' })
        .expect(200);
      expect(updated.body.phoneNumber).toBe('+1-555-0199');
    });
  });

  describe('departments', () => {
    it('creates a department with a manager', async () => {
      const branches = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr())
        .expect(200);
      const branchId = branches.body[0].id;

      const res = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set(hdr())
        .send({ branchId, name: 'Engineering', managerUserId: adminUserId })
        .expect(201);

      expect(res.body).toMatchObject({
        branchId,
        name: 'Engineering',
        managerUserId: adminUserId,
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/departments?branchId=' + branchId)
        .set(hdr())
        .expect(200);
      expect(list.body).toHaveLength(1);
    });
  });

  describe('groups', () => {
    it('creates a group and lists it by branch', async () => {
      const branches = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr())
        .expect(200);
      const branchId = branches.body[0].id;

      const res = await request(app.getHttpServer())
        .post('/api/v1/groups')
        .set(hdr())
        .send({ branchId, name: 'Morning Shift', description: 'First shift' })
        .expect(201);
      expect(res.body).toMatchObject({ branchId, name: 'Morning Shift' });

      const list = await request(app.getHttpServer())
        .get('/api/v1/groups?branchId=' + branchId)
        .set(hdr())
        .expect(200);
      expect(list.body).toHaveLength(1);
    });
  });

  describe('staff', () => {
    let staffId: string;
    let staffUserId: string;
    let staffPassword: string;
    let staffRoleId: string;
    let groupId: string;
    let branchId: string;
    let departmentId: string;

    beforeAll(async () => {
      const roles = await request(app.getHttpServer())
        .get('/api/v1/company-roles')
        .set(hdr())
        .expect(200);
      staffRoleId = roles.body.find(
        (r: { name: string }) => r.name === 'STAFF',
      ).id;

      const branches = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(hdr())
        .expect(200);
      branchId = branches.body[0].id;

      const depts = await request(app.getHttpServer())
        .get('/api/v1/departments?branchId=' + branchId)
        .set(hdr())
        .expect(200);
      departmentId = depts.body[0].id;

      const groups = await request(app.getHttpServer())
        .get('/api/v1/groups?branchId=' + branchId)
        .set(hdr())
        .expect(200);
      groupId = groups.body[0].id;
    });

    it('creates a staff member with a temporary password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/staff')
        .set(hdr())
        .send({
          email: `staff-${unique}@test.com`,
          firstName: 'Grace',
          lastName: 'Hopper',
          branchId,
          departmentId,
          jobTitle: 'Engineer',
          roleIds: [staffRoleId],
        })
        .expect(201);

      staffId = res.body.staffRecord.id;
      staffUserId = res.body.user.id;
      staffPassword = res.body.temporaryPassword;
      expect(staffPassword).toBeDefined();
      expect(res.body.user.email).toBe(`staff-${unique}@test.com`);
    });

    it('lists and searches staff', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/staff')
        .set(hdr())
        .expect(200);
      expect(list.body).toHaveLength(1);

      const search = await request(app.getHttpServer())
        .get('/api/v1/staff?search=Grace')
        .set(hdr())
        .expect(200);
      expect(search.body).toHaveLength(1);
      expect(search.body[0].roles).toContainEqual(
        expect.objectContaining({ name: 'STAFF' }),
      );
    });

    it('adds the staff member to a group', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/members`)
        .set(hdr())
        .send({ staffRecordIds: [staffId] })
        .expect(201);

      const group = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}`)
        .set(hdr())
        .expect(200);
      expect(group.body.members).toHaveLength(1);
      expect(group.body.members[0].id).toBe(staffId);
    });

    it('updates a staff member', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/staff/${staffId}`)
        .set(hdr())
        .send({ jobTitle: 'Senior Engineer' })
        .expect(200);
      expect(res.body.jobTitle).toBe('Senior Engineer');
    });

    it('reassigns roles via /staff/:id/roles', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/${staffId}/roles`)
        .set(hdr())
        .send({ roleIds: [staffRoleId], branchId: null })
        .expect(201);
      expect(res.body.roles).toContainEqual(
        expect.objectContaining({ name: 'STAFF' }),
      );
    });

    it('lets the staff member log in with the temporary password', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `staff-${unique}@test.com`, password: staffPassword })
        .expect(200);
      expect(login.body.user.id).toBe(staffUserId);
    });

    it('denies staff the company admin privileges', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `staff-${unique}@test.com`, password: staffPassword })
        .expect(200);
      const staffCookie = extractCookies(login);

      // STAFF role lacks branch.create
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Cookie', staffCookie)
        .set('x-tenant-id', tenantId)
        .send({ name: 'Nope', address: 'X', latitude: 1, longitude: 2 })
        .expect(403);
    });
  });
});
