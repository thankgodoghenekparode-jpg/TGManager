import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

interface StaffSession {
  staffRecordId: string;
  userId: string;
  email: string;
  cookie: string;
}

describe('Workflows (e2e): templates, instances, approvals', () => {
  let app: INestApplication;
  let unique: string;

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

  const createStaff = async (
    tag: string,
    roleIds: string[],
  ): Promise<StaffSession> => {
    const res = await request(app.getHttpServer())
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
    const { staffRecord, user, temporaryPassword } = res.body as {
      staffRecord: { id: string };
      user: { id: string };
      temporaryPassword: string;
    };
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `${tag}-${unique}@test.com`, password: temporaryPassword })
      .expect(200);
    return {
      staffRecordId: staffRecord.id,
      userId: user.id,
      email: `${tag}-${unique}@test.com`,
      cookie: extractCookies(login),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Flow',
        lastName: 'Admin',
        email: `flow-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `Flow Co ${unique}`,
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

    staff1 = await createStaff('wf1', [staffRoleId]);
    staff2 = await createStaff('wf2', [staffRoleId]);
    manager = await createStaff('mgr', [managerRoleId]);

    await request(app.getHttpServer())
      .patch(`/api/v1/departments/${departmentId}`)
      .set(adminHdr())
      .send({ managerUserId: manager.userId })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('templates', () => {
    it('admin creates a template with ordered steps', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows/templates')
        .set(adminHdr())
        .send({
          name: 'Leave request',
          description: 'Two-step approval',
          steps: [
            {
              name: 'Manager approval',
              order: 0,
              action: 'APPROVE',
              assigneeRuleType: 'ORIGINATOR_MANAGER',
            },
            {
              name: 'HR approval',
              order: 1,
              action: 'APPROVE',
              assigneeRuleType: 'COMPANY_ROLE',
              assigneeCompanyRoleId: managerRoleId,
              isFinal: true,
            },
          ],
        })
        .expect(201);
      templateId = res.body.id;
      expect(res.body.steps).toHaveLength(2);
      expect(res.body.steps[0].assigneeRuleType).toBe('ORIGINATOR_MANAGER');
    });

    it('rejects templates with duplicate step orders', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows/templates')
        .set(adminHdr())
        .send({
          name: 'Broken',
          steps: [
            {
              name: 'A',
              order: 0,
              assigneeRuleType: 'COMPANY_ROLE',
              assigneeCompanyRoleId: managerRoleId,
            },
            {
              name: 'B',
              order: 0,
              assigneeRuleType: 'COMPANY_ROLE',
              assigneeCompanyRoleId: managerRoleId,
            },
          ],
        })
        .expect(400);
    });

    it('lists and retrieves the template', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/v1/workflows/templates')
        .set(adminHdr())
        .expect(200);
      expect(list.body.some((t: { id: string }) => t.id === templateId)).toBe(
        true,
      );

      const one = await request(app.getHttpServer())
        .get(`/api/v1/workflows/templates/${templateId}`)
        .set(adminHdr())
        .expect(200);
      expect(one.body.steps).toHaveLength(2);
    });

    it('denies template creation to staff', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/workflows/templates')
        .set(userHdr(staff1))
        .send({
          name: 'Nope',
          steps: [
            {
              name: 'A',
              order: 0,
              assigneeRuleType: 'COMPANY_ROLE',
              assigneeCompanyRoleId: managerRoleId,
            },
          ],
        })
        .expect(403);
    });
  });

  describe('instances', () => {
    let instanceId: string;

    it('staff starts an instance assigned to the department manager', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(staff1))
        .send({
          templateId,
          title: 'WF1 annual leave',
          payload: { days: 5, reason: 'vacation' },
        })
        .expect(201);
      instanceId = res.body.id;
      expect(res.body.status).toBe('PENDING');
      expect(res.body.stepInstances).toHaveLength(2);
      expect(res.body.stepInstances[0].assignedToUser.email).toBe(
        manager.email,
      );
      expect(res.body.currentStepId).toBe(res.body.stepInstances[0].id);
    });

    it('manager sees the pending approval', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workflows/approvals')
        .set(userHdr(manager))
        .expect(200);
      expect(
        res.body.some(
          (a: { instance: { id: string } }) => a.instance.id === instanceId,
        ),
      ).toBe(true);
    });

    it('manager approves each step until approved', async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${instanceId}/approve`)
        .set(userHdr(manager))
        .send({ note: 'Looks good' })
        .expect(201);
      expect(first.body.status).toBe('PENDING');
      expect(first.body.currentStepId).toBe(first.body.stepInstances[1].id);
      expect(first.body.stepInstances[0].status).toBe('COMPLETED');

      const second = await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${instanceId}/approve`)
        .set(userHdr(manager))
        .expect(201);
      expect(second.body.status).toBe('APPROVED');
      expect(second.body.currentStepId).toBeNull();
      expect(second.body.stepInstances[1].status).toBe('COMPLETED');
    });

    it('approving the same instance again fails', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${instanceId}/approve`)
        .set(userHdr(manager))
        .expect(404);
    });

    it('manager rejects an instance', async () => {
      const started = await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(staff2))
        .send({ templateId, title: 'WF2 purchase request' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${started.body.id}/reject`)
        .set(userHdr(manager))
        .send({ note: 'Not approved' })
        .expect(201);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.stepInstances[0].status).toBe('REJECTED');
      expect(res.body.stepInstances[0].actionedBy.email).toBe(manager.email);
    });

    it('initiator can cancel their own instance', async () => {
      const started = await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(staff1))
        .send({ templateId, title: 'WF1 to cancel' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${started.body.id}/cancel`)
        .set(userHdr(staff1))
        .expect(201);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('staff cannot cancel someone else instance', async () => {
      const started = await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(manager))
        .send({ templateId, title: 'Manager request' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/instances/${started.body.id}/cancel`)
        .set(userHdr(staff1))
        .expect(403);
    });

    it('staff cannot list or read instances', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/workflows/instances')
        .set(userHdr(staff1))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/workflows/instances/whatever')
        .set(userHdr(staff1))
        .expect(403);
    });

    it('rejects starting when a step has no resolvable assignee', async () => {
      const ghostRole = await request(app.getHttpServer())
        .post('/api/v1/company-roles')
        .set(adminHdr())
        .send({ name: 'Nobody Role', permissions: [] })
        .expect(201);

      const ghost = await request(app.getHttpServer())
        .post('/api/v1/workflows/templates')
        .set(adminHdr())
        .send({
          name: 'Unassignable',
          steps: [
            {
              name: 'Approve',
              order: 0,
              assigneeRuleType: 'COMPANY_ROLE',
              assigneeCompanyRoleId: ghostRole.body.id,
            },
          ],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/workflows/instances')
        .set(userHdr(staff1))
        .send({ templateId: ghost.body.id, title: 'Will fail' })
        .expect(400);
    });
  });
});
