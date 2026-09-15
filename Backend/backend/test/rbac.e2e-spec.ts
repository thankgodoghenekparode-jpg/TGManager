import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

describe('RBAC & company roles (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let tenantId: string;
  let unique: string;
  let branchId: string;
  let viewerRoleId: string;
  let staffUserId: string;
  let staffEmail: string;
  let staffPassword: string;

  const hdr = () => ({ Cookie: cookie, 'x-tenant-id': tenantId });

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Rbac',
        lastName: 'Admin',
        email: `rbac-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `Rbac Co ${unique}`,
      })
      .expect(201);
    cookie = extractCookies(reg);
    tenantId = reg.body.tenant.id;

    const branch = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set(hdr())
      .send({ name: 'HQ', address: '9 HQ Ave', latitude: 1, longitude: 2 })
      .expect(201);
    branchId = branch.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the seeded system roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/company-roles')
      .set(hdr())
      .expect(200);

    const names = res.body.map((r: { name: string }) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'COMPANY_ADMIN',
        'BRANCH_ADMIN',
        'DEPARTMENT_MANAGER',
        'STAFF',
      ]),
    );
    expect(res.body.every((r: { isSystem: boolean }) => r.isSystem)).toBe(true);
  });

  it('creates a custom role with a restricted permission set', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/company-roles')
      .set(hdr())
      .send({ name: 'Branch Viewer', permissions: ['branch.view'] })
      .expect(201);

    viewerRoleId = res.body.id;
    expect(res.body.isSystem).toBe(false);
    expect(res.body.permissions).toEqual(['branch.view']);
  });

  it('rejects a role with an unknown permission', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/company-roles')
      .set(hdr())
      .send({ name: 'Broken', permissions: ['branch.hack'] })
      .expect(400);
    expect(res.body.message).toContain('branch.hack');
  });

  it('creates a staff member and captures the temporary password', async () => {
    staffEmail = `viewer-${unique}@test.com`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/staff')
      .set(hdr())
      .send({
        email: staffEmail,
        firstName: 'Viewer',
        lastName: 'User',
        branchId,
      })
      .expect(201);

    staffUserId = res.body.user.id;
    staffPassword = res.body.temporaryPassword;
    expect(staffPassword).toBeDefined();
  });

  it('assigns the custom role to the staff member', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/company-roles/${viewerRoleId}/assign`)
      .set(hdr())
      .send({ userId: staffUserId })
      .expect(201);

    expect(res.body.assignments).toContainEqual(
      expect.objectContaining({ userId: staffUserId }),
    );
  });

  it('lets the viewer list branches but not create them', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: staffPassword })
      .expect(200);
    const staffCookie = extractCookies(login);

    const list = await request(app.getHttpServer())
      .get('/api/v1/branches')
      .set('Cookie', staffCookie)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const res = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Cookie', staffCookie)
      .set('x-tenant-id', tenantId)
      .send({ name: 'Sneaky', address: 'X', latitude: 1, longitude: 2 })
      .expect(403);
    expect(res.body.message).toBe('Insufficient permissions');
  });

  it('blocks modification and deletion of system roles', async () => {
    const roles = await request(app.getHttpServer())
      .get('/api/v1/company-roles')
      .set(hdr())
      .expect(200);
    const staffRole = roles.body.find(
      (r: { name: string }) => r.name === 'STAFF',
    );

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/company-roles/${staffRole.id}`)
      .set(hdr())
      .send({ name: 'Hacked' })
      .expect(403);
    expect(patch.body.message).toContain('System roles cannot be modified');

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/company-roles/${staffRole.id}`)
      .set(hdr())
      .expect(403);
    expect(del.body.message).toContain('System roles cannot be deleted');
  });

  it('prevents removing the last COMPANY_ADMIN', async () => {
    const roles = await request(app.getHttpServer())
      .get('/api/v1/company-roles')
      .set(hdr())
      .expect(200);
    const adminRoleId = roles.body.find(
      (r: { name: string }) => r.name === 'COMPANY_ADMIN',
    ).id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/company-roles/${adminRoleId}`)
      .set(hdr())
      .expect(200);
    const adminAssignmentId = detail.body.assignments[0].id;

    const res = await request(app.getHttpServer())
      .delete(
        `/api/v1/company-roles/${adminRoleId}/assignments/${adminAssignmentId}`,
      )
      .set(hdr())
      .expect(400);
    expect(res.body.message).toContain('last company administrator');
  });

  it('unassigns a role and deletes the custom role', async () => {
    const role = await request(app.getHttpServer())
      .get(`/api/v1/company-roles/${viewerRoleId}`)
      .set(hdr())
      .expect(200);
    const assignmentId = role.body.assignments.find(
      (a: { userId: string }) => a.userId === staffUserId,
    ).id;

    await request(app.getHttpServer())
      .delete(
        `/api/v1/company-roles/${viewerRoleId}/assignments/${assignmentId}`,
      )
      .set(hdr())
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/company-roles/${viewerRoleId}`)
      .set(hdr())
      .expect(204);
  });
});
