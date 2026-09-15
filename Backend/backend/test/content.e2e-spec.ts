import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

interface StaffSession {
  staffRecordId: string;
  userId: string;
  cookie: string;
}

describe('Content modules (e2e): documents, inventory, memos, forms, reports', () => {
  let app: INestApplication;
  let unique: string;

  let adminCookie: string;
  let tenantId: string;
  let branchId: string;
  let departmentId: string;

  let staffRoleId: string;
  let managerRoleId: string;

  let groupAId: string;
  let groupBId: string;

  let staff1: StaffSession;
  let staff2: StaffSession;
  let manager: StaffSession;

  const adminHdr = () => ({ Cookie: adminCookie, 'x-tenant-id': tenantId });
  const userHdr = (s: StaffSession) => ({
    Cookie: s.cookie,
    'x-tenant-id': tenantId,
  });

  const createStaff = async (
    tag: string,
    extra: Record<string, unknown> = {},
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
        roleIds: [staffRoleId],
        ...extra,
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
      cookie: extractCookies(login),
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Content',
        lastName: 'Admin',
        email: `content-admin-${unique}@test.com`,
        password: 'password123',
        companyName: `Content Co ${unique}`,
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

    const groupA = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(adminHdr())
      .send({ branchId, name: 'Team Alpha' })
      .expect(201);
    groupAId = groupA.body.id;
    const groupB = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set(adminHdr())
      .send({ branchId, name: 'Team Beta' })
      .expect(201);
    groupBId = groupB.body.id;

    staff1 = await createStaff('stf1', { groupIds: [groupAId] });
    staff2 = await createStaff('stf2', { groupIds: [groupBId] });
    manager = await createStaff('mgr', { roleIds: [managerRoleId] });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('memos', () => {
    let publishedMemoId: string;
    let groupMemoId: string;

    it('admin creates a draft memo invisible to staff', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memos')
        .set(adminHdr())
        .send({ title: 'Draft notice', body: 'Coming soon', publish: false })
        .expect(201);
      expect(res.body.publishedAt).toBeNull();

      const staffList = await request(app.getHttpServer())
        .get('/api/v1/memos')
        .set(userHdr(staff1))
        .expect(200);
      expect(staffList.body).toHaveLength(0);
    });

    it('publishes a memo visible to all staff with read tracking', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/memos')
        .set(adminHdr())
        .send({
          title: 'Company notice',
          body: 'Welcome everyone',
          audience: { all: true },
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/memos/${created.body.id}/publish`)
        .set(adminHdr())
        .expect(201);
      publishedMemoId = created.body.id;

      const staffList = await request(app.getHttpServer())
        .get('/api/v1/memos')
        .set(userHdr(staff1))
        .expect(200);
      expect(staffList.body).toHaveLength(1);
      expect(staffList.body[0]).toMatchObject({
        id: publishedMemoId,
        read: false,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/memos/${publishedMemoId}/read`)
        .set(userHdr(staff1))
        .expect(201);

      const afterRead = await request(app.getHttpServer())
        .get('/api/v1/memos')
        .set(userHdr(staff1))
        .expect(200);
      expect(afterRead.body[0].read).toBe(true);
    });

    it('scopes memos to the target group audience', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/memos')
        .set(adminHdr())
        .send({
          title: 'Team Beta only',
          body: 'Beta-specific info',
          audience: { groupIds: [groupBId] },
        })
        .expect(201);
      groupMemoId = created.body.id;
      await request(app.getHttpServer())
        .post(`/api/v1/memos/${groupMemoId}/publish`)
        .set(adminHdr())
        .expect(201);

      const staff1List = await request(app.getHttpServer())
        .get('/api/v1/memos')
        .set(userHdr(staff1))
        .expect(200);
      expect(
        staff1List.body.some((m: { id: string }) => m.id === groupMemoId),
      ).toBe(false);

      const staff2List = await request(app.getHttpServer())
        .get('/api/v1/memos')
        .set(userHdr(staff2))
        .expect(200);
      expect(
        staff2List.body.some((m: { id: string }) => m.id === groupMemoId),
      ).toBe(true);
    });

    it('denies memo creation to staff and hides unpublished drafts', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/memos')
        .set(userHdr(staff1))
        .send({ title: 'nope', body: 'nope' })
        .expect(403);
    });
  });

  describe('forms', () => {
    let formId: string;

    const submit = (s: StaffSession, data: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post(`/api/v1/forms/${formId}/submissions`)
        .set(userHdr(s))
        .send({ data })
        .expect(201);

    it('admin creates and publishes a schema-driven form', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/forms')
        .set(adminHdr())
        .send({
          name: 'Equipment check',
          description: 'Daily safety checklist',
          fields: [
            {
              key: 'equipment',
              label: 'Equipment',
              type: 'TEXT',
              required: true,
            },
            {
              key: 'condition',
              label: 'Condition',
              type: 'SELECT',
              options: ['Good', 'Damaged'],
              required: true,
            },
            { key: 'quantity', label: 'Quantity', type: 'NUMBER' },
          ],
        })
        .expect(201);
      formId = res.body.id;
      expect(res.body.fields).toHaveLength(3);

      await request(app.getHttpServer())
        .post(`/api/v1/forms/${formId}/publish`)
        .set(adminHdr())
        .expect(201);
    });

    it('rejects submissions to an unpublished form', async () => {
      const draft = await request(app.getHttpServer())
        .post('/api/v1/forms')
        .set(adminHdr())
        .send({
          name: 'Draft',
          fields: [{ key: 'a', label: 'A', type: 'TEXT' }],
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/forms/${draft.body.id}/submissions`)
        .set(userHdr(staff1))
        .send({ data: { a: 'x' } })
        .expect(404);
    });

    it('accepts valid submissions and rejects invalid ones', async () => {
      await submit(staff1, {
        equipment: 'Ladder',
        condition: 'Good',
        quantity: 2,
      });
      await submit(staff2, { equipment: 'Extinguisher', condition: 'Damaged' });

      await request(app.getHttpServer())
        .post(`/api/v1/forms/${formId}/submissions`)
        .set(userHdr(staff1))
        .send({ data: { equipment: 'Ladder', condition: 'Broken' } })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/v1/forms/${formId}/submissions`)
        .set(userHdr(staff1))
        .send({ data: { condition: 'Good' } })
        .expect(400);
    });

    it('scopes submission visibility to managers only', async () => {
      const adminList = await request(app.getHttpServer())
        .get(`/api/v1/forms/${formId}/submissions`)
        .set(adminHdr())
        .expect(200);
      expect(adminList.body).toHaveLength(2);

      const managerList = await request(app.getHttpServer())
        .get(`/api/v1/forms/${formId}/submissions`)
        .set(userHdr(manager))
        .expect(200);
      expect(managerList.body).toHaveLength(0);
    });

    it('denies form creation to staff', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/forms')
        .set(userHdr(staff1))
        .send({
          name: 'nope',
          fields: [{ key: 'a', label: 'A', type: 'TEXT' }],
        })
        .expect(403);
    });
  });

  describe('inventory', () => {
    let itemId: string;

    it('admin creates an item flagged as low stock', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventory')
        .set(adminHdr())
        .send({
          branchId,
          name: 'Printer paper',
          sku: 'PAP-001',
          quantity: 3,
          unit: 'box',
          minQuantity: 5,
          location: 'A1',
        })
        .expect(201);
      itemId = res.body.id;

      const lowStock = await request(app.getHttpServer())
        .get('/api/v1/inventory?lowStock=true')
        .set(adminHdr())
        .expect(200);
      expect(lowStock.body.some((i: { id: string }) => i.id === itemId)).toBe(
        true,
      );
    });

    it('adjusts stock and prevents negative quantities', async () => {
      const adjusted = await request(app.getHttpServer())
        .post(`/api/v1/inventory/${itemId}/adjust`)
        .set(adminHdr())
        .send({ delta: 5, reason: 'restock' })
        .expect(201);
      expect(adjusted.body.quantity).toBe(8);

      await request(app.getHttpServer())
        .post(`/api/v1/inventory/${itemId}/adjust`)
        .set(adminHdr())
        .send({ delta: -20, reason: 'write-off' })
        .expect(400);
    });

    it('updates item metadata', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/${itemId}`)
        .set(adminHdr())
        .send({ minQuantity: 10 })
        .expect(200);
      expect(updated.body.minQuantity).toBe(10);
    });

    it('denies inventory access to staff', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory')
        .set(userHdr(staff1))
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/v1/inventory')
        .set(userHdr(staff1))
        .send({ branchId, name: 'nope' })
        .expect(403);
    });
  });

  describe('documents', () => {
    let documentId: string;

    it('admin uploads a document and staff can view it', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(adminHdr())
        .attach('file', Buffer.from('welcome aboard'), {
          filename: 'welcome.txt',
          contentType: 'text/plain',
        })
        .field('title', 'Welcome guide')
        .field('type', 'GENERAL')
        .expect(201);
      documentId = res.body.id;
      expect(res.body).toMatchObject({ title: 'Welcome guide', version: 1 });

      const list = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set(userHdr(staff1))
        .expect(200);
      expect(list.body.some((d: { id: string }) => d.id === documentId)).toBe(
        true,
      );

      const download = await request(app.getHttpServer())
        .get(`/api/v1/documents/${documentId}/download`)
        .set(userHdr(staff1))
        .expect(200);
      expect(download.text).toBe('welcome aboard');
    });

    it('uploads a new version', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/documents/${documentId}/versions`)
        .set(adminHdr())
        .attach('file', Buffer.from('updated content'), {
          filename: 'welcome.txt',
          contentType: 'text/plain',
        })
        .expect(201);
      expect(res.body.version).toBe(2);
    });

    it('soft-deletes documents', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/documents/${documentId}`)
        .set(adminHdr())
        .expect(204);
      await request(app.getHttpServer())
        .get(`/api/v1/documents/${documentId}`)
        .set(userHdr(staff1))
        .expect(404);
    });

    it('denies document upload to staff', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/documents')
        .set(userHdr(staff1))
        .attach('file', Buffer.from('x'), {
          filename: 'x.txt',
          contentType: 'text/plain',
        })
        .field('title', 'nope')
        .expect(403);
    });
  });

  describe('reports', () => {
    it('returns attendance, staff and inventory aggregations', async () => {
      const attendance = await request(app.getHttpServer())
        .get('/api/v1/reports/attendance')
        .set(adminHdr())
        .expect(200);
      expect(attendance.body.summary.totalRecords).toBe(0);

      const staffReport = await request(app.getHttpServer())
        .get('/api/v1/reports/staff')
        .set(adminHdr())
        .expect(200);
      expect(staffReport.body.summary.totalStaff).toBe(3);

      const inventory = await request(app.getHttpServer())
        .get('/api/v1/reports/inventory')
        .set(adminHdr())
        .expect(200);
      expect(inventory.body.summary.totalItems).toBe(1);
      expect(inventory.body.items[0]).toMatchObject({
        name: 'Printer paper',
        quantity: 8,
      });
    });

    it('exports CSV reports', async () => {
      const csv = await request(app.getHttpServer())
        .get('/api/v1/reports/staff/export')
        .set(adminHdr())
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('name,email,branch');

      const invCsv = await request(app.getHttpServer())
        .get('/api/v1/reports/inventory/export')
        .set(adminHdr())
        .expect(200);
      expect(invCsv.text).toContain('name,sku,branch');
    });

    it('denies reports to staff', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/staff')
        .set(userHdr(staff1))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/reports/inventory/export')
        .set(userHdr(staff1))
        .expect(403);
    });
  });
});
