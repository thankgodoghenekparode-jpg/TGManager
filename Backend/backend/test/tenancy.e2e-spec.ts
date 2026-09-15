import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

describe('Tenancy isolation (e2e)', () => {
  let app: INestApplication;

  let cookieA: string;
  let cookieB: string;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const emailA = `tenantA-${Date.now()}@test.com`;
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'A',
        lastName: 'Alpha',
        email: emailA,
        password: 'password123',
        companyName: 'Tenant A Co',
      })
      .expect(201);

    const emailB = `tenantB-${Date.now()}@test.com`;
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'B',
        lastName: 'Beta',
        email: emailB,
        password: 'password123',
        companyName: 'Tenant B Co',
      })
      .expect(201);

    cookieA = extractCookies(regA);
    cookieB = extractCookies(regB);
    tenantAId = regA.body.tenant.id;
    tenantBId = regB.body.tenant.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a member access their own tenant context', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/current')
      .set('Cookie', cookieA)
      .set('x-tenant-id', tenantAId)
      .expect(200);

    expect(res.body.name).toBe('Tenant A Co');
    expect(res.body.roles).toContainEqual(
      expect.objectContaining({ name: 'COMPANY_ADMIN' }),
    );
  });

  it('blocks a non-member from accessing another tenant', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/current')
      .set('Cookie', cookieB)
      .set('x-tenant-id', tenantAId)
      .expect(403);
  });

  it('blocks tenant access without the x-tenant-id header', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/current')
      .set('Cookie', cookieA)
      .expect(400);
  });

  it('only lists the tenants the user actually belongs to', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants')
      .set('Cookie', cookieA)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(tenantAId);
    expect(res.body[0].id).not.toBe(tenantBId);
  });

  it('denies tenant endpoints without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tenants/current')
      .set('x-tenant-id', tenantAId)
      .expect(401);
  });
});
