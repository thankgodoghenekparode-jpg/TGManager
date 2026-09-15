import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookies } from './utils/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueEmail = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.com`;
  const registerBody = (email: string, companyName = 'Auth Test Co') => ({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email,
    password: 'password123',
    companyName,
  });

  describe('POST /auth/register', () => {
    it('creates a user, a company and the COMPANY_ADMIN role', async () => {
      const email = uniqueEmail('reg');
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email, 'Analytical Engines'))
        .expect(201);

      expect(res.body.user.email).toBe(email);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.role).toBe('USER');
      expect(res.body.tenant.name).toBe('Analytical Engines');
      expect(res.body.tenant.slug).toMatch(/^analytical-engines/);
      expect(res.body.tenant.onboardingStatus).toBe('PENDING_BRANCH');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects a duplicate email with 409', async () => {
      const email = uniqueEmail('dup');
      const body = registerBody(email);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(body)
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(body)
        .expect(409);
    });

    it('rejects invalid payloads with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ firstName: 'A', email: 'not-an-email', password: 'x' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials and sets cookies', async () => {
      const email = uniqueEmail('login');
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email))
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);

      expect(res.body.user.email).toBe(email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects wrong password with 401', async () => {
      const email = uniqueEmail('badpw');
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email))
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });

    it('rejects unknown email with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the profile and company memberships', async () => {
      const email = uniqueEmail('me');
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email, 'Me Co'))
        .expect(201);
      const cookie = extractCookies(reg);

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.user.email).toBe(email);
      expect(res.body.memberships).toHaveLength(1);
      expect(res.body.memberships[0].name).toBe('Me Co');
      expect(res.body.memberships[0].roles).toContainEqual(
        expect.objectContaining({ name: 'COMPANY_ADMIN' }),
      );
    });

    it('returns 401 without a valid access token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('POST /auth/refresh + /auth/logout', () => {
    it('rotates the refresh token and re-issues cookies', async () => {
      const email = uniqueEmail('refresh');
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email))
        .expect(201);
      const cookie = extractCookies(reg);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.user.email).toBe(email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('clears session cookies and revokes the refresh token on logout', async () => {
      const email = uniqueEmail('logout');
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerBody(email))
        .expect(201);
      const cookie = extractCookies(reg);

      const logout = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      const cleared = (
        logout.headers['set-cookie'] as unknown as string[]
      ).join(';');
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
      expect(cleared).toContain('zarox_access');
      expect(cleared).toContain('zarox_refresh');

      // the revoked refresh session can no longer be rotated
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });
  });
});
